# JobifyCV Payment Server

Small Express backend that signs and creates ABA PayWay transactions. It
exists because ABA PayWay requires an HMAC-SHA512 hash computed with your
**secret API key** — that can never live in frontend code, so it has to be
computed on a real server, not the static site.

## Why this is separate from the main app

Your frontend (`CVV3`) is currently deployed on Render as a **Static Site**,
which can only serve pre-built files — it can't run this Express server.
You have two options:

1. **Deploy this folder as its own Render "Web Service"** (not Static Site):
   - New → Web Service → point at this repo, root directory `server`
   - Build command: `npm install`
   - Start command: `npm run payments-server` (or `node index.js` if you set root to `server`)
   - Add the environment variables from `.env.example` in Render's dashboard
   - Render will give you a URL like `https://jobifycv-payments.onrender.com`

2. Or convert it into a Firebase Cloud Function, since the app already uses
   Firebase — same logic in `payway.js`, just wrapped in an `onRequest` handler.

## Wiring it to the frontend

Once deployed, set this in your frontend's environment (Render → your
Static Site → Environment):

```
VITE_PAYMENTS_API_URL=https://jobifycv-payments.onrender.com/api
```

Rebuild/redeploy the static site after adding it.

## Local development

```bash
cd server
cp .env.example .env   # fill in your real ABA PayWay sandbox credentials
npm install
npm run payments-server
```

Then in the main app's `.env`:
```
VITE_PAYMENTS_API_URL=http://localhost:8787/api
```

## Before accepting real payments

- [ ] Confirm the hash field order in `payway.js` against the current
      sample code in your ABA PayWay merchant dashboard (it has changed
      across API versions — the comment in the file explains this).
- [ ] Test a full sandbox transaction end to end and confirm PayWay returns
      success, not "invalid hash".
- [ ] Wire up `firebase-admin` in the `/api/payments/callback` handler so a
      verified payment actually grants the plan tier in Firestore — right
      now it only logs to the console (see the TODO in `index.js`).
- [ ] Switch `ABA_PAYWAY_BASE_URL` to the production URL and use your live
      merchant credentials.
