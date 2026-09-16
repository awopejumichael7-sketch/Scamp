# Scholar's Camp — Security Documentation

This document explains how Scholar's Camp protects accounts, content, and
payments, and — just as important — what it honestly **cannot** protect
against. Section 68 of the specification requires this document to never
overstate what browser-based protection can do, and this document complies
with that requirement throughout.

## 1. Authentication
- Firebase Authentication (email/password) handles credential storage,
  hashing, and session tokens — Scholar's Camp never stores or sees raw
  passwords.
- Email verification is sent on registration (`auth.js: register()`).
- Password reset uses Firebase's built-in reset-link flow.
- Sessions persist via Firebase's SDK (IndexedDB), automatically refreshed;
  `Auth.logout()` revokes the local session immediately.

## 2. Authorization
- **The frontend is not the authority.** Every `admin.js`/`student.js`
  screen checks `Auth.role()` only to decide what to *show* — the real
  decision is made twice more, both server-side:
  1. **Firestore Security Rules** (`firestore.rules`) — reject any read/write
     a role shouldn't perform, no matter what the browser sends.
  2. **Cloud Functions** (`functions-index.js`) — re-verify enrollment/role
     before ever touching a Google Drive file or a payment record.
- Teachers never receive admin rights automatically (Section 20); their
  `permissions[]` array is checked by `Auth.hasPermission()` and by
  Firestore rules (`isTeacher()`), and only an admin can change it
  (`setUserRole` Cloud Function).

## 3. Google Drive content security (Section 8)
- No Google Drive file ID or URL is ever placed in this repository's HTML,
  CSS, or client JavaScript. `driveFileId` lives only in Firestore documents
  the client never reads directly for lessons flagged non-free — see
  `getVideoPlaybackUrl` in `functions-index.js`.
- Every video/document request is authorized server-side against the
  student's actual enrollment before a Drive resource is ever touched.
- The player and viewer omit download buttons and disable the right-click
  context menu (`video-player.js`, `pdf-viewer.js`).
- Access is logged to `auditLogs` for every playback/view.

### Honest limitation — read this before promising "undownloadable" to anyone
No web application — Scholar's Camp included — can prevent:
- screenshots or the OS-level screen-recording tools built into every
  modern phone, tablet, and computer;
- someone pointing a second camera or phone at their screen;
- a sufficiently technical user intercepting network traffic while a video
  is actively playing (this is true of Netflix, YouTube, and every other
  streaming service too, which is why they accept this as a residual risk
  rather than claiming otherwise).

What this architecture *does* stop is the realistic, high-volume threat:
casual downloading, link-sharing of a permanent Drive URL, and browsing the
raw content folder. If your risk tolerance requires stronger protection
than that (e.g. broadcast-grade DRM with hardware-backed decryption), the
video storage layer should be swapped for a purpose-built provider — Bunny
Stream, Cloudflare Stream, VdoCipher, or Vimeo OTT all support this without
requiring any change to the rest of Scholar's Camp; only
`getPlaybackSource()`/`getVideoPlaybackUrl` would change.

## 4. Payment security (Section 24)
- Course access is granted **only** after `verifyPayment` (a Cloud
  Function) independently re-checks the transaction against Paystack's or
  Flutterwave's own servers using a secret key that never leaves Cloud
  Functions config.
- A client-side "payment successful" callback is never trusted on its own;
  Firestore rules additionally forbid the client from writing to
  `enrollments` at all (`allow write: if false`).

## 5. Secrets management
Never present in this frontend folder, ever:
- Firebase Admin SDK service-account keys
- Google Drive OAuth client secret / service-account key
- Paystack/Flutterwave secret keys
These are configured only via `firebase functions:config:set` (or Secret
Manager) and read inside `functions-index.js` on the server.

The values in `firebase-config.js` (apiKey, authDomain, etc.) are the
public **web app config** Google explicitly documents as safe to ship to
browsers — access is enforced by Security Rules, not by hiding this file.

## 6. API security & rate limiting
- All Cloud Functions require a valid Firebase Auth ID token
  (`requireAuth()`), and role-sensitive ones additionally call
  `requireRole()`.
- Firebase's platform-level quotas provide baseline rate limiting;
  for stricter per-user limits (e.g. exam-attempt abuse), add
  `functions.runWith({ ... })` throttling or App Check.
- Enable **Firebase App Check** in production to block requests that don't
  originate from your real app (free tier available).

## 7. Audit logging (Section 46)
Every admin/teacher CRUD action, video/document access, and role change is
written to the `auditLogs` collection (`store.js: AuditLog.record()`,
`video-player.js`, `functions-index.js`). Only admins can read this
collection; clients can never edit or delete entries.

## 8. Known limitations (complete list)
1. Screenshots/screen-recording cannot be prevented (see §3).
2. Google Drive is not a purpose-built DRM host — see the honest
   limitation note above and in `drive-service.js`.
3. `signDriveMedia()` in `functions-index.js` is a placeholder until you
   connect real Drive API credentials — it deliberately throws
   `unimplemented` rather than pretending to work.
4. Offline PWA caching covers only the app shell, never premium
   video/PDF bytes (`sw.js` explicitly excludes Drive/Functions domains).
5. Essay/short-answer questions cannot be auto-marked and are queued for
   manual grading by design (Section 15).
