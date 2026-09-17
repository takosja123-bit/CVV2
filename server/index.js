import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { createPaywayTransaction, verifyPaywayPushback, checkPaywayTransactionStatus } from './payway.js';
import {
  grantPlanTier,
  recordPendingPayment,
  getPendingPayment,
  markPendingPaymentGranted,
} from './firebaseAdmin.js';

// Load server/.env explicitly by path — plain `import 'dotenv/config'` only
// looks in process.cwd(), which breaks when this is started from the repo
// root (e.g. `npm run payments-server`, or the README's own instructions)
// instead of from inside server/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // PayWay pushbacks are form-encoded

const PORT = process.env.PORT || 8787;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
// Where PayWay sends the browser after a successful payment. This must be
// the actual website (e.g. your Render Static Site), NOT this backend's own
// URL — this server has no page to show, only API routes.
const FRONTEND_URL = process.env.FRONTEND_URL || APP_URL;

// 1. Create a signed PayWay transaction. The frontend takes the returned
//    {action, fields} and submits them as a real form POST, which is what
//    navigates the browser to PayWay's hosted checkout page.
app.post('/api/payments/create-transaction', async (req, res) => {
  const { planId, paymentOption, customer } = req.body || {};

  if (!planId || !customer?.email) {
    return res.status(400).json({ error: 'planId and customer.email are required.' });
  }

  try {
    const { action, fields, tranId } = createPaywayTransaction({
      planId,
      paymentOption,
      customer,
      appUrl: APP_URL,
      frontendUrl: FRONTEND_URL,
    });
    // Record what this transaction is FOR before handing it to the
    // browser — this is what verify-and-grant (below) checks against later,
    // rather than trusting whatever plan/uid the client claims at that point.
    try {
      await recordPendingPayment(tranId, customer.uid, planId, fields.amount);
    } catch (err) {
      console.error(`[payments] Failed to record pending payment ${tranId}:`, err.message);
      // Not fatal — the webhook path can still grant it if it ever arrives.
    }
    res.json({ action, fields });
  } catch (err) {
    console.error('[payments] create-transaction failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. PayWay calls this after the customer finishes paying (configured via
//    return_url above). Verify the signature, then grant the plan tier —
//    this is the ONLY place a plan upgrade should actually be trusted from.
app.post('/api/payments/callback', async (req, res) => {
  // Per ABA's docs, the signature rides in a header, not the JSON body.
  const signature = req.headers['x-payway-hmac-sha512'];
  const isValid = verifyPaywayPushback(req.body, signature);

  if (!isValid) {
    console.warn('[payments] Rejected pushback with invalid/missing signature.');
    return res.status(401).send('invalid signature');
  }

  const { tran_id, status, return_params } = req.body;
  let planId = null;
  let uid = null;
  try {
    const parsed = JSON.parse(Buffer.from(return_params, 'base64').toString('utf8'));
    planId = parsed.planId;
    uid = parsed.uid;
  } catch {
    // ignore parse errors
  }

  if (status === '0') {
    console.log(`[payments] ✅ Transaction ${tran_id} paid successfully for plan ${planId}.`);
    if (!uid) {
      console.error(`[payments] ⚠️ Transaction ${tran_id} paid but had no uid — cannot grant plan.`);
    } else {
      try {
        await grantPlanTier(uid, planId);
        console.log(`[payments] Granted ${planId} to user ${uid}.`);
      } catch (err) {
        // Don't fail the HTTP response to PayWay over this — the payment is
        // real either way — but this needs someone to notice and fix it
        // manually (grant the plan by hand from the admin dashboard).
        console.error(`[payments] ⚠️ Failed to grant plan for transaction ${tran_id}:`, err.message);
      }
    }
  } else {
    console.log(`[payments] Transaction ${tran_id} reported status=${status}.`);
  }

  res.status(200).send('OK');
});

app.get('/api/payments/health', (_req, res) => res.json({ ok: true }));

// 3. Fallback for when the webhook (above) never arrives — e.g. this
//    server's domain isn't whitelisted yet on the merchant profile, so
//    PayWay silently never calls it. The frontend calls this right after
//    the customer lands back from PayWay's checkout. Unlike the webhook,
//    the browser calling this isn't itself proof of anything, so this
//    NEVER trusts a client-supplied plan/uid — it looks up what the
//    transaction was actually created for (recordPendingPayment, above)
//    and independently asks PayWay's own Check Transaction API whether it
//    really was paid before granting anything.
app.post('/api/payments/verify-and-grant', async (req, res) => {
  const { tranId } = req.body || {};
  if (!tranId) {
    return res.status(400).json({ error: 'tranId is required.' });
  }

  const pending = await getPendingPayment(tranId).catch((err) => {
    console.error(`[payments] Failed to read pending payment ${tranId}:`, err.message);
    return null;
  });
  if (!pending) {
    return res.status(404).json({ error: 'No matching transaction on record.' });
  }
  if (pending.status === 'granted') {
    return res.json({ granted: true, planId: pending.planId, alreadyGranted: true });
  }

  let checkResult;
  try {
    checkResult = await checkPaywayTransactionStatus(tranId);
  } catch (err) {
    console.error(`[payments] check-transaction failed for ${tranId}:`, err.message);
    return res.status(502).json({ error: 'Could not reach PayWay to verify this transaction.' });
  }

  const paymentStatusCode = checkResult?.data?.payment_status_code;
  // 0 = APPROVED per the docs.
  if (paymentStatusCode !== 0) {
    return res.json({
      granted: false,
      paymentStatus: checkResult?.data?.payment_status || 'UNKNOWN',
    });
  }

  try {
    await grantPlanTier(pending.uid, pending.planId);
    await markPendingPaymentGranted(tranId);
    console.log(`[payments] (via verify-and-grant) Granted ${pending.planId} to user ${pending.uid}.`);
    res.json({ granted: true, planId: pending.planId });
  } catch (err) {
    console.error(`[payments] Failed to grant plan for ${tranId}:`, err.message);
    res.status(500).json({ error: 'Payment verified but granting the plan failed. Contact support.' });
  }
});

app.listen(PORT, () => {
  console.log(`Payment server listening on http://localhost:${PORT}`);
});
