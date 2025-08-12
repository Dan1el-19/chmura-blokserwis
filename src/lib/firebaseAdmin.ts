import admin from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

// Try to initialize admin SDK from either:
// 1) FIREBASE_SERVICE_ACCOUNT (full JSON as single-line string), or
// 2) individual env vars FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// This allows older .env setups with the three vars to work as well.
const initFromServiceAccount = () => {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
      console.log('Initialized Firebase Admin from FIREBASE_SERVICE_ACCOUNT');
    }
    db = admin.firestore();
    auth = admin.auth();
    return true;
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT or initialize admin:', err);
    return false;
  }
};

const initFromIndividualVars = () => {
  const pid = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!pid || !clientEmail || !privateKey) return false;
  // If private key stored with escaped newlines ("\n"), convert to actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  try {
    const cert = {
      projectId: pid,
      clientEmail: clientEmail,
      privateKey: privateKey,
    } as admin.ServiceAccount;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(cert),
      });
      console.log('Initialized Firebase Admin from individual env vars (FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY)');
    }
    db = admin.firestore();
    auth = admin.auth();
    return true;
  } catch (err) {
    console.error('Failed to initialize admin from individual env vars:', err);
    return false;
  }
};

let initialized = false;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  initialized = initFromServiceAccount();
}
if (!initialized) {
  initialized = initFromIndividualVars();
}

if (!initialized) {
  console.warn('Firebase Admin SDK not initialized. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in .env.local to enable admin features.');
}

export { db, auth };
export default admin;
