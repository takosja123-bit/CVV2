import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { createPaywayTransaction, verifyPaywayPushback } from './payway.js';
import { grantPlanTier } from './firebaseAdmin.js';

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
app.post('/api/payments/create-transaction', (req, res) => {
  const { planId, paymentOption, customer } = req.body || {};

  if (!planId || !customer?.email) {
    return res.status(400).json({ error: 'planId and customer.email are required.' });
  }

  try {
    const { action, fields } = createPaywayTransaction({
      planId,
      paymentOption,
      customer,
      appUrl: APP_URL,
      frontendUrl: FRONTEND_URL,
    });
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

app.listen(PORT, () => {
  console.log(`Payment server listening on http://localhost:${PORT}`);
});
