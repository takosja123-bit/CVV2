import { PlanTier } from '../types';

// URL of the small payment backend in /server. That backend is a separate
// deployable (it can't run on a static host) — see server/README.md.
// Set VITE_PAYMENTS_API_URL in your .env when the backend lives on another
// domain (e.g. a Render "Web Service" or a Cloud Function URL). If it's
// served from the same domain as the app, leave it unset and it will use
// a relative "/api" path.
const PAYMENTS_API_URL =
  (import.meta as any).env?.VITE_PAYMENTS_API_URL || '/api';

export type PaywayPaymentOption = 'abapay' | 'cards';

export interface CheckoutCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export class PaymentServiceError extends Error {}

/**
 * Asks our backend to build a signed ABA PayWay "create transaction" request,
 * then submits it as a real HTML form POST — which is what makes the browser
 * navigate to PayWay's own hosted checkout page (checkout.payway.com.kh) to
 * finish the payment. Nothing about card numbers ever touches our frontend
 * or backend: PayWay collects that on their page.
 */
export async function startPaywayCheckout(
  planId: PlanTier,
  paymentOption: PaywayPaymentOption,
  customer: CheckoutCustomer
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${PAYMENTS_API_URL}/payments/create-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, paymentOption, customer }),
    });
  } catch (err) {
    throw new PaymentServiceError(
      'Could not reach the payment server. Make sure the /server backend is deployed and VITE_PAYMENTS_API_URL is set.'
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new PaymentServiceError(body.error || 'Payment server rejected the request.');
  }

  const { action, fields } = (await response.json()) as {
    action: string;
    fields: Record<string, string>;
  };

  // Build and submit a real <form> so the browser performs a top-level
  // navigation to PayWay's checkout page (required — it can't be done with
  // fetch/XHR since PayWay needs to render its own hosted UI).
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.style.display = 'none';

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
