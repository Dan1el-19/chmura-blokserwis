import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";

function generateTempPassword(length = 20) {
  return randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}

const [, , uidArg, email, displayNameArg, limitGbStr] = process.argv;
if (!email) {
  console.error(
    "Usage: node scripts/set-admin.mjs <UID|AUTO> <EMAIL> [DISPLAY_NAME] [LIMIT_GB]"
  );
  process.exit(1);
}

const displayName = displayNameArg || email;
const limitGb = Number(limitGbStr ?? 10);

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error("Missing env FIREBASE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
});

const auth = getAuth();
const db = getFirestore();

async function resolveUidAndEnsureUser() {
  // Spróbuj użyć przekazanego UID (po oczyszczeniu), potem wyszukaj po emailu, a na końcu utwórz użytkownika
  const cleanedUid = (uidArg || "").replace(/["'<>]/g, "").trim();

  if (cleanedUid) {
    try {
      const u = await auth.getUser(cleanedUid);
      return u.uid;
    } catch {
      // kontynuuj niżej
    }
  }

  // Spróbuj znaleźć po emailu
  try {
    const u = await auth.getUserByEmail(email);
    return u.uid;
  } catch {
    // nie istnieje – utwórz
  }

  const tempPassword = generateTempPassword();
  const created = await auth.createUser({
    email,
    displayName,
    password: tempPassword,
    emailVerified: false,
    disabled: false,
  });
  console.log("Created user:", created.uid);
  console.log(
    "Temp password (share securely, ask user to change):",
    tempPassword
  );
  return created.uid;
}

const uid = await resolveUidAndEnsureUser();

await auth.setCustomUserClaims(uid, { role: "admin" });

await db.doc(`users/${uid}`).set(
  {
    uid,
    email,
    displayName,
    role: "admin",
    storageLimit: limitGb * 1024 * 1024 * 1024,
    storageUsed: 0,
    createdAt: FieldValue.serverTimestamp(),
    lastLogin: FieldValue.serverTimestamp(),
  },
  { merge: true }
);

console.log("Admin configured for UID:", uid);
