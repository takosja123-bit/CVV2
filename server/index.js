import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createPaywayTransaction, verifyPaywayPushback } from './payway.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // PayWay pushbacks are form-encoded

const PORT = process.env.PORT || 8787;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

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
  const isValid = verifyPaywayPushback(req.body);

  if (!isValid) {
    console.warn('[payments] Rejected pushback with invalid hash.');
    return res.status(401).send('invalid signature');
  }

  const { tran_id, status, return_params } = req.body;
  let planId = null;
  try {
    planId = JSON.parse(Buffer.from(return_params, 'base64').toString('utf8')).planId;
  } catch {
    // ignore parse errors
  }

  if (status === '0') {
    // TODO: grant `planId` to the paying user in Firestore. This backend
    // currently has no Firebase Admin credentials wired up — add the
    // firebase-admin SDK with a service account key, look up the user by
    // the email/tran_id you stored when creating the transaction, and set
    // their planTier field. Do this here, not in the frontend, since this
    // is the only step that's been cryptographically verified as paid.
    console.log(`[payments] ✅ Transaction ${tran_id} paid successfully for plan ${planId}.`);
  } else {
    console.log(`[payments] Transaction ${tran_id} reported status=${status}.`);
  }

  res.status(200).send('OK');
});

app.get('/api/payments/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Payment server listening on http://localhost:${PORT}`);
});
