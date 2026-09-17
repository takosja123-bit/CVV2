import crypto from 'crypto';

// Source of truth for what customers are actually charged. Keep this in sync
// with src/data/pricingPlans.ts (that file drives the UI, this one drives
// what gets billed — never trust a price sent from the browser).
export const PLAN_PRICES_USD = {
  'Free Plan': 0,
  'Basic Plan': 2.99,
  'Pro Plan': 6.99,
  'Premium Plan': 14.99,
};

export const PAYWAY_BASE_URL =
  process.env.ABA_PAYWAY_BASE_URL || 'https://checkout-sandbox.payway.com.kh';
// Use https://checkout.payway.com.kh for production once ABA has activated
// your live merchant account.

function base64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function nowReqTime() {
  // PayWay wants req_time as YYYYMMDDHHmmss in UTC+7 (Phnom Penh time).
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

/**
 * Builds the field set + HMAC-SHA512 hash for PayWay's "Create Transaction"
 * (/api/payment-gateway/v1/payments/purchase) endpoint.
 *
 * Field order confirmed against ABA's current official docs
 * (https://developer.payway.com.kh/purchase-14530820e0.md), from their PHP
 * sample:
 *   $b4hash = $req_time . $merchant_id . $tran_id . $amount . $items .
 *     $shipping . $firstname . $lastname . $email . $phone . $type .
 *     $payment_option . $return_url . $cancel_url . $continue_success_url .
 *     $return_deeplink . $currency . $custom_fields . $return_params .
 *     $payout . $lifetime . $additional_params . $google_pay_token .
 *     $skip_success_page
 * Every field in that formula must be included in the hash (as an empty
 * string if unused) even if it isn't otherwise sent as a form field.
 */
const FIELD_ORDER = [
  'req_time',
  'merchant_id',
  'tran_id',
  'amount',
  'items',
  'shipping',
  'firstname',
  'lastname',
  'email',
  'phone',
  'type',
  'payment_option',
  'return_url',
  'cancel_url',
  'continue_success_url',
  'return_deeplink',
  'currency',
  'custom_fields',
  'return_params',
  'payout',
  'lifetime',
  'additional_params',
  'google_pay_token',
  'skip_success_page',
];

export function createPaywayTransaction({ planId, paymentOption, customer, appUrl, frontendUrl }) {
  const merchantId = process.env.ABA_PAYWAY_MERCHANT_ID;
  const apiKey = process.env.ABA_PAYWAY_API_KEY;

  if (!merchantId || !apiKey) {
    throw new Error(
      'ABA_PAYWAY_MERCHANT_ID / ABA_PAYWAY_API_KEY are not set. Add them to server/.env — get them from your ABA PayWay merchant dashboard.'
    );
  }

  const price = PLAN_PRICES_USD[planId];
  if (price === undefined) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  if (price <= 0) {
    throw new Error('This plan is free and does not require checkout.');
  }
  if (!customer.uid) {
    // Not a PayWay requirement — but without it we can't credit anyone once
    // they've paid, so refuse rather than take money we can't fulfill.
    throw new Error('customer.uid is required (user must be logged in to upgrade).');
  }

  const reqTime = nowReqTime();
  const tranId = `JCV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const amount = price.toFixed(2);

  const items = base64(
    JSON.stringify([{ name: `JobifyCV ${planId}`, quantity: 1, price: amount }])
  );

  // customer.uid identifies which Firestore userProfiles doc to credit once
  // PayWay confirms payment — without it the callback has no way to know
  // whose plan to upgrade. It rides along in custom_fields (echoed back
  // as-is by PayWay) and return_params (also echoed back), base64-encoded
  // JSON in both cases like the existing planId payloads.
  const uid = customer.uid || null;

  const fields = {
    req_time: reqTime,
    merchant_id: merchantId,
    tran_id: tranId,
    amount,
    items,
    shipping: '0',
    firstname: customer.firstName || 'Jobify',
    lastname: customer.lastName || 'Customer',
    email: customer.email || '',
    phone: customer.phone || '',
    type: 'purchase',
    // 'abapay' shows ABA Pay / KHQR / ABA mobile app on PayWay's checkout page.
    // 'cards' shows the Visa/Mastercard card-entry form instead.
    payment_option: paymentOption === 'cards' ? 'cards' : 'abapay',
    return_url: `${appUrl}/api/payments/callback`,
    cancel_url: '',
    continue_success_url: `${frontendUrl}/?upgrade=success&plan=${encodeURIComponent(planId)}#dashboard`,
    return_deeplink: '',
    currency: 'USD',
    custom_fields: base64(JSON.stringify({ planId, uid })),
    return_params: base64(JSON.stringify({ planId, tranId, uid })),
    payout: '',
    lifetime: '',
    additional_params: '',
    google_pay_token: '',
    skip_success_page: '',
    // Not part of the hash formula (confirmed against the docs — it's
    // absent from the PHP $b4hash sample). Some merchant profiles have
    // both the Checkout service AND the standalone QR Payment API enabled;
    // without this, PayWay defaults to the QR API and returns raw JSON
    // (qrString/qrImage/etc.) instead of an HTML checkout page — which is
    // useless for a plain form-POST web flow like this one.
    payment_gate: '0',
  };

  const hashInput = FIELD_ORDER.map((key) => fields[key] ?? '').join('');
  const hash = crypto.createHmac('sha512', apiKey).update(hashInput).digest('base64');

  return {
    action: `${PAYWAY_BASE_URL}/api/payment-gateway/v1/payments/purchase`,
    fields: { ...fields, hash },
    tranId,
  };
}

/**
 * Verifies a pushback/webhook notification from PayWay.
 *
 * Per ABA's official docs (ecommerce-checkout-3158159f0.md), the signature
 * is NOT a field inside the JSON body — it arrives in the
 * `X-PAYWAY-HMAC-SHA512` request header. The body itself (e.g.
 * { tran_id, apv, status, return_params, merchant_ref }) is signed by:
 *   1. Sorting its fields by key, ascending (PHP ksort).
 *   2. Concatenating just the values, in that sorted order (JSON-encoding
 *      any value that's itself an array/object).
 *   3. HMAC-SHA512 with the API key, base64-encoded.
 */
export function verifyPaywayPushback(body, signature) {
  const apiKey = process.env.ABA_PAYWAY_API_KEY;
  if (!apiKey || !signature || !body) return false;

  const hashInput = Object.keys(body)
    .sort()
    .map((k) => {
      const v = body[k];
      if (v === undefined || v === null) return '';
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    })
    .join('');
  const expected = crypto.createHmac('sha512', apiKey).update(hashInput).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
