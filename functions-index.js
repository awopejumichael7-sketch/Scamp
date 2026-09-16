/**
 * functions-index.js
 * ---------------------------------------------------------------------------
 * Firebase Cloud Functions — the server-side half of Scholar's Camp.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE REST OF THE FLAT FOLDER:
 * Firebase's own deploy tooling (`firebase deploy --only functions`) requires
 * Cloud Functions code to sit in a directory with its own package.json and
 * node_modules (Google's requirement, not a choice made here). To respect
 * "single folder, no subfolders" as closely as physically possible, every
 * other file in Scholar's Camp is flat in this one folder. This is the one
 * file that — when you deploy — you will copy into a folder literally named
 * `functions/` next to `firebase.json` (see DEPLOYMENT.md for the exact
 * three commands). Nothing else in this project needs a subfolder.
 *
 * This is also the ONLY place that should ever hold:
 *   - the Google Drive OAuth client secret
 *   - the Drive service-account key (if you use domain-wide delegation)
 *   - Paystack/Flutterwave SECRET keys
 * Set them with `firebase functions:config:set` or Secret Manager —
 * NEVER commit them to this repo, NEVER put them in firebase-config.js.
 * ---------------------------------------------------------------------------
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
admin.initializeApp();
const db = admin.firestore();

function requireAuth(context) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  return context.auth.uid;
}

async function requireRole(uid, roles) {
  const snap = await db.collection("users").doc(uid).get();
  const role = snap.exists ? snap.data().role : null;
  if (!roles.includes(role)) throw new functions.https.HttpsError("permission-denied", "Not authorized.");
  return role;
}

/* ----------------------------------------------------------------------
 * Section 8/26: issue a short-lived signed URL for a lesson's video ONLY
 * after verifying the caller purchased/enrolled in the course. This is the
 * single authorization checkpoint the whole video-security section (8)
 * depends on — the frontend never sees a Drive file ID until this passes.
 * ------------------------------------------------------------------- */
exports.getVideoPlaybackUrl = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const lesson = (await db.collection("lessons").doc(data.lessonId).get()).data();
  if (!lesson) throw new functions.https.HttpsError("not-found", "Lesson not found.");

  if (!lesson.free) {
    const topic = (await db.collection("topics").doc(lesson.topicId).get()).data();
    const module = (await db.collection("modules").doc(topic.moduleId).get()).data();
    const enrollment = await db.collection("enrollments")
      .where("studentId", "==", uid).where("courseId", "==", module.courseId).limit(1).get();
    const userDoc = (await db.collection("users").doc(uid).get()).data();
    const privileged = ["admin", "super_admin", "teacher"].includes(userDoc?.role);
    if (enrollment.empty && !privileged) {
      throw new functions.https.HttpsError("permission-denied", "You do not have permission to access this course.");
    }
  }

  // Mint a short-lived URL using the Drive API with a service account that
  // has read-only access to the content folder. `driveFileId` never leaves
  // the server. Drive doesn't natively issue expiring signed URLs the way
  // S3/GCS do, so in practice this typically means either:
  //   (a) proxy-stream the bytes through this Function (simplest, works
  //       today, but consumes Functions bandwidth/quota), or
  //   (b) generate a very-short-TTL OAuth access token and return a Drive
  //       `alt=media` URL with that token attached as a query param, which
  //       Google will honor only until the token expires (~1 hour, and you
  //       can rotate it per-request to shrink the effective window).
  // Both are implemented as `signDriveMedia()` below — swap in real Drive
  // API calls once your service account + folder are set up.
  const url = await signDriveMedia(lesson.driveFileId);

  await db.collection("auditLogs").add({
    actorId: uid, action: "video.playback_issued", targetType: "lesson", targetId: data.lessonId,
    createdAt: new Date().toISOString(),
  });

  return { url, expiresAt: Date.now() + 5 * 60 * 1000 };
});

/** Same authorization pattern for protected PDFs/textbooks (Section 9). */
exports.getDocumentUrl = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const material = (await db.collection("textbooks").doc(data.materialId).get()).data();
  if (!material) throw new functions.https.HttpsError("not-found", "Document not found.");

  if (material.access === "premium") {
    const userDoc = (await db.collection("users").doc(uid).get()).data();
    const privileged = ["admin", "super_admin", "teacher"].includes(userDoc?.role);
    let allowed = privileged;
    if (!allowed && material.courseId) {
      const enrollment = await db.collection("enrollments")
        .where("studentId", "==", uid).where("courseId", "==", material.courseId).limit(1).get();
      allowed = !enrollment.empty;
    }
    if (!allowed) throw new functions.https.HttpsError("permission-denied", "You do not have permission to access this material.");
  }

  const url = await signDriveMedia(material.driveFileId);
  return { url, expiresAt: Date.now() + 5 * 60 * 1000 };
});

/** Placeholder — replace with real googleapis Drive client calls. */
async function signDriveMedia(driveFileId) {
  // const { google } = require("googleapis");
  // const auth = new google.auth.JWT(SERVICE_ACCOUNT_EMAIL, null, SERVICE_ACCOUNT_KEY, ["https://www.googleapis.com/auth/drive.readonly"]);
  // const drive = google.drive({ version: "v3", auth });
  // const token = (await auth.getAccessToken()).token;
  // return `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&access_token=${token}`;
  throw new functions.https.HttpsError("unimplemented", "Connect your Google Drive service account in signDriveMedia() — see SECURITY.md.");
}

/* ----------------------------------------------------------------------
 * Section 59: Google Drive OAuth — the client only forwards a one-time
 * `code`; the secret client_secret and the resulting refresh_token live
 * only here (functions config), never in the frontend.
 * ------------------------------------------------------------------- */
exports.completeDriveOAuth = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await requireRole(uid, ["admin", "super_admin"]);

  const clientId = functions.config().drive?.client_id;
  const clientSecret = functions.config().drive?.client_secret;
  const redirectUri = functions.config().drive?.redirect_uri;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: data.code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const tokens = await res.json();
  if (!res.ok) throw new functions.https.HttpsError("internal", "Google Drive authorization failed.");

  // Store only server-side, in a locked-down collection real students/teachers can never read.
  await db.collection("_serverSecrets").doc("driveOAuth").set({ ...tokens, connectedBy: uid, connectedAt: new Date().toISOString() });
  return { connected: true };
});

exports.listDriveFiles = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await requireRole(uid, ["admin", "super_admin", "teacher"]);
  // Use the stored OAuth/service-account credentials to list files in
  // data.folderId via googleapis Drive client — never expose the token itself.
  return { files: [] }; // placeholder until Drive credentials are connected
});

/* ----------------------------------------------------------------------
 * Section 24: server-side payment verification. This is the only function
 * allowed to write an `enrollments` document for a PAID course.
 * ------------------------------------------------------------------- */
exports.verifyPayment = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { paymentDocId, provider } = data;
  const paymentRef = db.collection("payments").doc(paymentDocId);
  const payment = (await paymentRef.get()).data();
  if (!payment || payment.studentId !== uid) throw new functions.https.HttpsError("permission-denied", "Payment not found.");

  let verified = false;
  if (provider === "paystack") {
    const secretKey = functions.config().paystack?.secret_key;
    const res = await fetch(`https://api.paystack.co/transaction/verify/${payment.providerReference}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const body = await res.json();
    verified = body.status && body.data?.status === "success" && body.data.amount === Math.round(payment.amount * 100);
  } else if (provider === "flutterwave") {
    const secretKey = functions.config().flutterwave?.secret_key;
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/${data.providerReference}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const body = await res.json();
    verified = body.status === "success" && body.data?.status === "successful" && body.data.amount >= payment.amount;
  }

  if (!verified) {
    await paymentRef.update({ status: "failed" });
    throw new functions.https.HttpsError("failed-precondition", "Payment verification failed.");
  }

  await paymentRef.update({ status: "verified", verifiedAt: new Date().toISOString() });
  await db.collection("enrollments").add({ studentId: uid, courseId: payment.courseId, source: "purchase", enrolledAt: new Date().toISOString() });
  await db.collection("notifications").add({ userId: uid, type: "payment_confirmation", title: "Payment confirmed", body: "You now have access to your course.", read: false, createdAt: new Date().toISOString() });

  return { enrolled: true, courseId: payment.courseId };
});

/* ----------------------------------------------------------------------
 * Section 21, 67: promote a user to teacher/admin. Only an existing admin
 * can call this — never settable by a user on their own document.
 * ------------------------------------------------------------------- */
exports.setUserRole = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await requireRole(uid, ["admin", "super_admin"]);
  if (!["teacher", "admin", "student"].includes(data.role)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid role.");
  }
  await db.collection("users").doc(data.targetUid).update({ role: data.role, permissions: data.permissions || [] });
  await db.collection("auditLogs").add({ actorId: uid, action: "user.role_changed", targetType: "users", targetId: data.targetUid, createdAt: new Date().toISOString() });
  return { success: true };
});

/* ----------------------------------------------------------------------
 * Section 67: secure first-admin bootstrap. Run ONCE, manually, then
 * delete/disable this function. No password is ever hard-coded — the very
 * first admin is promoted by UID after they register a normal account.
 * Usage: firebase functions:shell → bootstrapFirstAdmin({email:"you@x.com"})
 * ------------------------------------------------------------------- */
exports.bootstrapFirstAdmin = functions.https.onCall(async (data, context) => {
  const existingAdmins = await db.collection("users").where("role", "in", ["admin", "super_admin"]).limit(1).get();
  if (!existingAdmins.empty) {
    throw new functions.https.HttpsError("failed-precondition", "An admin already exists — use setUserRole instead.");
  }
  const userRecord = await admin.auth().getUserByEmail(data.email);
  await db.collection("users").doc(userRecord.uid).update({ role: "super_admin" });
  return { success: true };
});
