import admin from 'firebase-admin';

// Mirrors src/utils/planAccess.ts's SUBSCRIPTION_DURATION_DAYS — keep in sync.
const SUBSCRIPTION_DURATION_DAYS = 30;

// Same collection name the frontend uses in src/firebase/cvService.ts
// (USERS_COLLECTION = 'userProfiles') — must match or grants silently land
// in the wrong place.
const USERS_COLLECTION = 'userProfiles';

let attempted = false;
let firestoreInstance = null;

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn(
      '[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON is not set — verified PayWay ' +
        'payments will be logged but NOT written to Firestore. See server/README.md ' +
        'for how to generate and set a service account.'
    );
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.firestore();
  } catch (err) {
    console.error(
      '[firebaseAdmin] Failed to parse/initialize FIREBASE_SERVICE_ACCOUNT_JSON:',
      err.message
    );
    return null;
  }
}

function getFirestoreAdmin() {
  if (!attempted) {
    attempted = true;
    firestoreInstance = admin.apps.length ? admin.firestore() : initAdmin();
  }
  return firestoreInstance;
}

const PENDING_PAYMENTS_COLLECTION = 'pendingPayments';

/**
 * Records what a transaction is FOR at the moment we create it — which uid
 * gets which plan. This is the source of truth the verify-and-grant
 * endpoint checks against; it never trusts a client-supplied uid/planId
 * directly, only a client-supplied tran_id used to look this up.
 */
export async function recordPendingPayment(tranId, uid, planId, amount) {
  const db = getFirestoreAdmin();
  if (!db) return; // Same graceful-degradation as grantPlanTier.
  await db.collection(PENDING_PAYMENTS_COLLECTION).doc(tranId).set({
    uid,
    planId,
    amount,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

export async function getPendingPayment(tranId) {
  const db = getFirestoreAdmin();
  if (!db) return null;
  const snap = await db.collection(PENDING_PAYMENTS_COLLECTION).doc(tranId).get();
  return snap.exists ? snap.data() : null;
}

export async function markPendingPaymentGranted(tranId) {
  const db = getFirestoreAdmin();
  if (!db) return;
  await db
    .collection(PENDING_PAYMENTS_COLLECTION)
    .doc(tranId)
    .set({ status: 'granted', grantedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Grants (or resets) a plan tier for a user, mirroring what
 * updateUserPlanTier() in src/firebase/cvService.ts does client-side — but
 * this runs with admin privileges, bypassing Firestore security rules,
 * because it's only ever called after verifyPaywayPushback() has confirmed
 * the payment is real.
 */
export async function grantPlanTier(uid, planId) {
  if (!uid) throw new Error('grantPlanTier: missing uid.');

  const db = getFirestoreAdmin();
  if (!db) {
    throw new Error(
      'Firestore admin is not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing or invalid).'
    );
  }

  const planExpiresAt =
    planId === 'Free Plan'
      ? null
      : new Date(Date.now() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db
    .collection(USERS_COLLECTION)
    .doc(uid)
    .set({ planTier: planId, planExpiresAt, updatedAt: new Date().toISOString() }, { merge: true });

  return { planTier: planId, planExpiresAt };
}
