# Scholar's Camp — Deployment Guide (for beginners)

This assumes zero prior experience with Firebase or Node.js. Follow the
steps in order.

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com → **Add project** → name it
   "Scholar's Camp" (or anything) → finish the wizard (Google Analytics is
   optional, free either way).
2. In the project, click **Build → Authentication → Get started** → enable
   **Email/Password**.
3. Click **Build → Firestore Database → Create database** → start in
   **production mode** → pick a region close to Nigeria (e.g. `europe-west1`).
4. Click the gear icon → **Project settings → General**, scroll to
   "Your apps" → click the `</>` (web) icon → register app "Scholar's Camp
   Web" → copy the `firebaseConfig` object it shows you.

## 2. Install dependencies (one-time, on your computer)
You need Node.js installed (https://nodejs.org, LTS version). Then:
```bash
npm install -g firebase-tools
firebase login
```

## 3. Configure environment variables (the config, not secrets)
Open `firebase-config.js` in this folder and paste the values Firebase gave
you in Step 1.4 into the `firebaseConfig` object (apiKey, authDomain,
projectId, etc.). These are safe to have in the frontend — see SECURITY.md
§5 for why.

## 4. Set up Firebase in this folder
From inside this `scholars-camp` folder:
```bash
firebase init
```
When prompted, choose:
- **Firestore** — accept the default `firestore.rules` file location, then
  afterwards overwrite its contents with this project's `firestore.rules`.
- **Hosting** — set the public directory to `.` (this folder itself, since
  everything is flat here) and answer **No** to "configure as a
  single-page app" prompt — actually answer **Yes**, since this is a
  hash-router SPA and all routes should fall back to `index.html`.
- **Functions** — choose JavaScript, and when it creates a `functions/`
  folder, replace the generated `functions/index.js` with the contents of
  this project's `functions-index.js`, and replace `functions/package.json`
  with `functions-package.json`'s contents. This is the one unavoidable
  subfolder — the Firebase CLI itself requires Cloud Functions code to live
  in a directory named `functions/`; nothing else in this project needs one.

Deploy the Firestore rules:
```bash
firebase deploy --only firestore:rules
```

## 5. Configure Google Drive OAuth (Section 59)
1. In https://console.cloud.google.com, select the same project Firebase
   created for you.
2. **APIs & Services → Library** → enable "Google Drive API".
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type: **Web application** → add an authorized redirect
   URI matching what you set in `drive-service.js`
   (`https://YOUR_DOMAIN/#/admin/settings/drive-callback`).
4. Copy the Client ID into `drive-service.js` (`beginGoogleDriveOAuth`).
5. Set the client secret and redirect URI as Functions config (never in
   this frontend folder):
```bash
firebase functions:config:set drive.client_id="YOUR_ID" drive.client_secret="YOUR_SECRET" drive.redirect_uri="YOUR_REDIRECT_URI"
```
6. Implement the real Drive API calls in `signDriveMedia()` inside
   `functions/index.js` (marked clearly with a TODO-style comment) — this
   requires the `googleapis` npm package, already listed in
   `functions-package.json`.

## 6. Configure Payments (Paystack/Flutterwave — Section 24)
1. Create a free account at https://paystack.com (or flutterwave.com).
2. Copy your **Public Key** into `payments.js` / `student.js` wherever
   `publicKey: "REPLACE_WITH_..."` appears.
3. Set the **Secret Key** as Functions config (never in the frontend):
```bash
firebase functions:config:set paystack.secret_key="sk_live_or_test_xxx"
```
4. Add the Paystack inline script tag to `index.html` if you enable it:
   `<script src="https://js.paystack.co/v1/inline.js"></script>`

## 7. Deploy environment + functions + hosting
```bash
firebase deploy --only functions
firebase deploy --only hosting
```
Your app is now live at `https://YOUR-PROJECT.web.app`.

## 8. Create the first admin (Section 67 — no hard-coded password)
1. Register a normal account through the live site (`#/register`).
2. From your terminal, in this folder:
```bash
firebase functions:shell
> bootstrapFirstAdmin({email: "you@example.com"})
```
3. Log out and back in on the site — you'll now land on `#/admin`.

## 9. Create your first course
1. As admin: **Subjects** → add "Mathematics".
2. **Classes** → add "Year 10".
3. **Courses** → "+ New" → fill in title, subject, class, price, status
   `published`.
4. (Full Module/Topic/Lesson builder UI is the next build phase — see
   README.md roadmap; for now these are created directly as Firestore
   documents with matching `courseId`/`moduleId`/`topicId` fields, or via
   the Firebase Console's Firestore data tab.)

## 10. Upload your first video
1. Upload the video file to a folder in your connected Google Drive
   account.
2. Copy its File ID (from the Drive share link:
   `.../d/`**`THIS_PART`**`/view`).
3. Create a `lessons` document with `contentType: "video"` and
   `driveFileId` set to that ID.

## 11. Create your first exam
Use **Admin → Exam Builder** to create an exam, then add question IDs to
`manualQuestionIds` (or set up a `randomRule`) directly in Firestore until
the visual question-picker (roadmap) ships.

## 12. Test a payment
Use Paystack/Flutterwave's **test mode** keys and their published test
card numbers before switching to live keys.

## 13. Publish the application
Once satisfied, switch Paystack/Flutterwave to live keys
(`functions:config:set` again with the live secret, and the live public
key in the frontend), then `firebase deploy` once more.

## 14. Install the PWA on a device
- **Android (Chrome)**: visit the site → menu (⋮) → "Install app".
- **iPhone (Safari)**: visit the site → Share icon → "Add to Home Screen".
- **Desktop (Chrome/Edge)**: an install icon (⊕) appears in the address bar.
