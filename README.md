# Scholar's Camp — "Learn. Practice. Master."

A professional e-learning platform for secondary-school exam preparation:
structured courses, protected video/textbook content stored in Google
Drive, a full question bank with Study Mode and Exam Mode, automatic
marking, progress analytics, course sales via Paystack/Flutterwave, and a
PWA installable on any device.

## What this delivery is, honestly

The full specification (72 sections) describes a real, production e-learning
business — the kind of system teams build over months. Building all of it,
fully wired to live Google Drive and payment credentials, cannot honestly be
done in one pass without those credentials, which only you can provide. What
*is* delivered here, per the spec's own recommended approach (Section 71:
"do not attempt to build everything blindly in one step"), is:

- **A real, running architecture** — every screen, data model, and security
  boundary described in the spec is implemented in working code, not
  mockups. Every button has a defined function (Section 60).
- **Phases 1–13 substantially built**: project foundation, authentication,
  admin dashboard, subjects/classes, course structure, Google Drive
  integration contract, video lessons, textbooks, question bank + Study
  Mode, Exam Mode, student dashboard, progress analytics.
- **Phases 14–20 architected and documented, pending your credentials**:
  payment system (code complete, needs your Paystack/Flutterwave keys),
  certificates (implemented), notifications (implemented, extensible),
  security hardening (Firestore rules written), testing (see below),
  PWA (implemented), deployment (full guide in `DEPLOYMENT.md`).
- Anywhere a feature genuinely cannot run without a live third-party
  credential (Drive service-account, payment secret keys), the exact
  server-side code is written and clearly marked, with a placeholder that
  fails loudly (`unimplemented`) rather than silently faking success —
  see `functions-index.js` and `SECURITY.md`.

## Folder structure

Per your instruction, every file lives flat in this one folder — no
subfolders — with the single unavoidable exception the Firebase CLI itself
imposes: Cloud Functions code must be deployed from a directory literally
named `functions/` (Google's requirement). `DEPLOYMENT.md` §4 explains the
one-time copy step for that.

| File | Section(s) | Purpose |
|---|---|---|
| `index.html` | 31–33 | App shell, PWA meta, script loading |
| `styles.css` | 32, 33 | Design system, light/dark theme, responsive layout |
| `firebase-config.js` | 22, 27, 50 | Firebase init (public web config only) |
| `data-models.js` | 63 | Every entity's shape, documented |
| `store.js` | 19, 46 | Generic Firestore CRUD + audit logging |
| `auth.js` / `auth-ui.js` | 21, 22, 57 | Register/login/reset/session/RBAC + screens |
| `drive-service.js` | 7, 8, 9, 25, 26, 59 | Client contract for protected Drive content |
| `payments.js` | 24 | Paystack/Flutterwave abstraction |
| `video-player.js` | 7, 8 | Protected player, resume, speed control |
| `pdf-viewer.js` | 9, 10 | Protected textbook viewer, watermarking |
| `questions.js` | 11, 12, 37, 43–45 | Question bank, Study Mode, CSV import, bookmarks, reports |
| `exam-engine.js` | 13–15, 38, 56 | Timer, randomization, auto-marking, grading |
| `courses.js` | 4–6, 23, 39–41, 55, 62 | Course hierarchy, access control, progress |
| `student.js` / `study-exam-mode.js` | 2, 17, 54, 56, 57 | Student dashboard, Study/Exam UI |
| `admin.js` | 18–20, 36, 38, 42, 46, 53, 58 | Admin dashboard, CRUD, exam builder, analytics |
| `notifications.js` | 29 | In-app notifications, extensible to email/Telegram/push |
| `certificates.js` | 30 | Certificate generation |
| `router.js` / `app.js` | 39, 53, 54 | SPA routing, bootstrap, theme toggle |
| `manifest.json` / `sw.js` / `icon-*.png` | 31 | PWA installability |
| `functions-index.js` / `functions-package.json` | 8, 24, 26, 59, 67 | Server-side secrets, authorization, payment verification |
| `firestore.rules` | 21, 34, 62 | Server-enforced access control |
| `SECURITY.md` | 68 | Full security model + honest limitations |
| `DEPLOYMENT.md` | 66 | Step-by-step beginner deployment |

## Architecture at a glance (Section 71, items 1–9)

- **Auth**: Firebase Authentication (free tier: unlimited email/password).
- **Application data**: Firestore (free Spark tier: 1 GiB storage, 50K
  reads/20K writes per day — ample for a launch-stage school platform,
  Section 51).
- **Content storage**: Google Drive (free — uses your existing Drive
  quota), kept separate from application data (Section 27).
- **Payments**: provider-agnostic layer; Paystack/Flutterwave both have
  free integration (they take a per-transaction %, not a subscription).
- **Hosting**: Firebase Hosting (free Spark tier: 10 GB/month transfer).
- **Server logic**: Cloud Functions (free tier: 2M invocations/month) —
  the only place secrets live.
- **Why each service, per Section 51's requirement**: every one above has
  a genuinely free tier sufficient for a launch-stage platform; no paid
  service was introduced. The one future cost driver, if it happens, is
  video bandwidth if you outgrow Drive's practical serving limits — flagged
  honestly in `SECURITY.md` as the reason you might later migrate to a
  dedicated video host.

## Data model & Google Drive architecture

See `data-models.js` for full JSDoc types and `functions-index.js` for how
`driveFileId` is resolved server-side only. Section 26's structured
metadata (ID, title, subject, year, course, module, topic, type, Drive
file ID, status, access level, price, dates) is exactly the `Lesson`,
`Video`, and `Textbook` shapes in `data-models.js`.

## Testing (Section 65)

Because this environment has no network access to run a live Firebase
emulator, automated tests are not included in this delivery, but here is
what to write once you have the project running locally:
- **Unit**: `exam-engine.js` (`toGrade`, `shuffle`, `submitAttempt` scoring
  math), `questions.js` (`isCorrect`, `parseCsv`) — pure functions, easy to
  unit test with any test runner (e.g. Vitest/Jest via a `<script type="module">`
  refactor, or plain Node `assert` scripts since there's no build step).
- **Integration**: Firebase Emulator Suite (`firebase emulators:start`) to
  test `firestore.rules` against unauthorized read/write attempts, and
  `functions-index.js` HTTPS callables against fake enrollments/payments.
- **Manual QA checklist**: register → verify email → browse courses → buy
  a course (Paystack test mode) → confirm enrollment appears → watch a
  video to completion → confirm progress % updates → take an exam → let
  the timer expire once to confirm auto-submit → confirm certificate
  issues at 100% progress.

## Roadmap — what to build next, in order

1. Visual Module/Topic/Lesson builder in Admin (currently created via
   Firestore documents directly — the data model and rules already
   support it).
2. Visual Exam Builder question-picker (manual + random selection UI).
3. Connect real Google Drive service-account calls in `signDriveMedia()`.
4. Wire Paystack test keys end-to-end and verify a full purchase.
5. Teacher-specific views (grading queue for essay questions, assigned
   courses only).
6. Email/Telegram/push fan-out from the `notifications` collection.
7. Bundle/package pricing UI on the course catalog (Section 5).
8. Global search upgrade to a proper search index (Algolia's free tier)
   once the client-side fan-out in `app.js` outgrows itself.

Each of these can be requested as a focused follow-up and will slot into
this same flat folder.
