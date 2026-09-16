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
 * ⚠️ IMPORTANT — VERIFY BEFORE GOING LIVE:
 * ABA PayWay computes the hash over a specific ordered concatenation of the
 * field values, signed with HMAC-SHA512 using your API key as the secret,
 * then base64-encoded. The exact field order below is based on ABA's public
 * "Create Transaction" sample payload, but ABA has changed field sets
 * between API versions. Before accepting real money:
 *   1. Log into your PayWay merchant dashboard → Developer docs.
 *   2. Compare FIELD_ORDER below against the current sample request/hash.
 *   3. Send one sandbox transaction and confirm PayWay returns success
 *      instead of an "invalid hash" error.
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
  'currency',
  'custom_fields',
  'return_url',
  'continue_success_url',
  'return_deeplink',
  'return_params',
];

export function createPaywayTransaction({ planId, paymentOption, customer, appUrl }) {
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

  const reqTime = nowReqTime();
  const tranId = `JCV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const amount = price.toFixed(2);

  const items = base64(
    JSON.stringify([{ name: `JobifyCV ${planId}`, quantity: 1, price: amount }])
  );

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
    currency: 'USD',
    custom_fields: base64(JSON.stringify({ planId })),
    return_url: `${appUrl}/api/payments/callback`,
  continue_success_url: `${appUrl}/?upgrade=success&plan=${encodeURIComponent(planId)}#dashboard`,
    return_deeplink: '',
    return_params: base64(JSON.stringify({ planId, tranId })),
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
 * Verifies a pushback/webhook notification from PayWay. PayWay signs the
 * pushback body the same way (HMAC-SHA512 of the concatenated field values,
 * base64-encoded) — confirm the exact pushback field order against your
 * merchant dashboard docs too, it differs from the create-transaction hash.
 */
export function verifyPaywayPushback(body) {
  const apiKey = process.env.ABA_PAYWAY_API_KEY;
  if (!apiKey || !body?.hash) return false;

  const { hash, ...rest } = body;
  const hashInput = Object.keys(rest)
    .sort()
    .map((k) => rest[k] ?? '')
    .join('');
  const expected = crypto.createHmac('sha512', apiKey).update(hashInput).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  } catch {
    return false;
  }
}
