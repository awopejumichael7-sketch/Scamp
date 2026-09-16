/**
 * sw.js
 * ---------------------------------------------------------------------------
 * Section 31: PWA installability + an offline-friendly app shell.
 *
 * CRITICAL (Section 31, 49): this service worker ONLY caches the static
 * app shell (HTML/CSS/JS/icons). It deliberately never intercepts or caches:
 *   - requests to FUNCTIONS_BASE_URL (signed video/document URLs)
 *   - any googlevideo.com / drive.google.com / *.googleusercontent.com request
 * because caching those would create an offline, downloadable copy of
 * premium content — exactly what Section 31 prohibits.
 * ---------------------------------------------------------------------------
 */

const CACHE_NAME = "scholars-camp-shell-v1";
const SHELL_FILES = [
  "./index.html", "./styles.css", "./manifest.json", "./icon-192.png", "./icon-512.png",
  "./firebase-config.js", "./data-models.js", "./store.js", "./auth.js", "./auth-ui.js",
  "./drive-service.js", "./payments.js", "./video-player.js", "./pdf-viewer.js",
  "./questions.js", "./exam-engine.js", "./courses.js", "./notifications.js",
  "./certificates.js", "./admin.js", "./student.js", "./study-exam-mode.js",
  "./router.js", "./app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Never cache protected content or dynamic API/Firestore/Drive calls.
  const NEVER_CACHE = ["googlevideo.com", "drive.google.com", "googleusercontent.com", "cloudfunctions.net", "firestore.googleapis.com", "identitytoolkit"];
  if (NEVER_CACHE.some((s) => url.includes(s))) return; // let the network handle it, untouched

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
