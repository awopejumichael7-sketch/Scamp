/**
 * firebase-config.js
 * ---------------------------------------------------------------------------
 * Section 22, 27, 34, 50: Authentication + Application Database (Firestore).
 *
 * IMPORTANT — SECRETS:
 * The values below are Firebase **client-side web config** (apiKey, authDomain,
 * etc.). These are NOT secret — Google's own docs confirm the web config is
 * safe to ship to the browser, because Firebase enforces access with
 * Firestore Security Rules (server-side) and Firebase Auth, not by hiding
 * this config. See firestore.rules (documented in DEPLOYMENT.md) — THAT is
 * where real authorization is enforced, never trust the frontend alone
 * (Section 34, 62).
 *
 * Real secrets — Google Drive service-account keys, Paystack/Flutterwave
 * secret keys — must NEVER be placed in this file or anywhere in this
 * frontend folder. They belong only in Firebase Cloud Functions environment
 * config / secrets manager. See functions-index.js and SECURITY.md.
 * ---------------------------------------------------------------------------
 */

const firebaseConfig = {
  apiKey: "AIzaSyBPW1nbDhLjhX7AM-czB_4r7IB5vStgFd4",
  authDomain: "scamp-e44bb.firebaseapp.com",
  projectId: "scamp-e44bb",
  storageBucket: "scamp-e44bb.firebasestorage.app",
  messagingSenderId: "586375503723",
  appId: "1:586375503723:web:44f8b814ebb7521d15762e"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence so exam answers / progress survive brief
// connection loss (Section 49) — this only caches non-protected app data,
// never premium video/PDF bytes (Section 31, 49).
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Firestore offline persistence unavailable:", err.code);
});

// Cloud Functions base URL — server-side endpoints for anything that must
// never run in the browser: Drive OAuth token exchange, signed video URL
// issuance, payment verification. Replace after `firebase deploy --only functions`.
const FUNCTIONS_BASE_URL = "https://REGION-REPLACE_ME.cloudfunctions.net";
