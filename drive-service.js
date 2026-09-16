/**
 * drive-service.js
 * ---------------------------------------------------------------------------
 * Sections 7, 8, 9, 25, 26, 59: Google Drive as content storage, with
 * authorization enforced server-side and no exposure of raw Drive URLs,
 * file IDs, or credentials to the browser.
 *
 * HOW IT ACTUALLY WORKS (read this before wiring credentials):
 *
 *   Browser                      Cloud Function                Google Drive
 *   ───────                      ──────────────                ────────────
 *   1. Student clicks Play  ──►  2. verifyEnrollment(uid,        (server only)
 *      (only lessonId sent,        courseId) using Firestore
 *       never a driveFileId)       — reject if not purchased
 *                              ──► 3. If authorized, use a
 *                                    Drive service-account
 *                                    (stored in Cloud Functions
 *                                    secrets, NEVER in this repo)
 *                                    to fetch the file and either:
 *                                     a) stream the bytes through
 *                                        the Function itself, or
 *                                     b) mint a short-lived signed
 *                                        URL (Drive's
 *                                        `webContentLink` with a
 *                                        time-boxed access token)
 *   4. Browser receives a   ◄──  5. Function returns the
 *      short-lived stream            short-lived URL/stream —
 *      URL (expires in ~60s          this is the ONLY place the
 *      to a few minutes) and          Drive file ever becomes
 *      immediately loads it           reachable by the client
 *      into <video>/<iframe>
 *
 * WHAT THIS FILE DOES: it is the CLIENT side of that contract. It never
 * holds a Drive API key, never holds a service-account key, and never
 * receives a permanent Drive URL. It only calls your Cloud Function and
 * renders whatever short-lived resource comes back.
 *
 * HONEST LIMITATION (Section 8, 68 — do not remove this notice):
 * Google Drive was not designed as a DRM video host. Even with everything
 * above, a signed short-lived URL is still a normal HTTP video stream once
 * issued — a sufficiently determined user could still capture it with a
 * browser extension or a screen recorder, and NOTHING running in a web
 * browser can prevent screen recording, camera-recording of the screen, or
 * OS-level screenshot tools. This architecture stops casual/bulk
 * download and link-sharing (the realistic threat), not a targeted capture
 * by one determined user. If you need protection against that stronger
 * threat model, replace this layer with a purpose-built DRM video host
 * (e.g. Bunny Stream, Cloudflare Stream, Vimeo Pro/OTT, VdoCipher) — the
 * rest of Scholar's Camp (course structure, enrollment checks, player UI)
 * does not need to change, only what `getPlaybackSource()` below fetches.
 * ---------------------------------------------------------------------------
 */

const DriveService = (() => {
  async function authedFetch(path, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    const idToken = await user.getIdToken();
    const res = await fetch(`${FUNCTIONS_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Ask the server to authorize + issue a short-lived playback source for a
   * lesson's video. The lessonId (not a Drive file ID) is the only client
   * input — the server looks up the real driveFileId itself so it is never
   * exposed in frontend code (Section 8 requirement #2).
   */
  async function getPlaybackSource(lessonId) {
    return authedFetch("/getVideoPlaybackUrl", {
      method: "POST",
      body: JSON.stringify({ lessonId }),
    });
    // Expected response: { url, expiresAt, watermarkText }
  }

  /** Same pattern for protected PDFs/textbooks (Section 9, 10). */
  async function getDocumentSource(materialId) {
    return authedFetch("/getDocumentUrl", {
      method: "POST",
      body: JSON.stringify({ materialId }),
    });
    // Expected response: { url, expiresAt, watermarkText }
  }

  /** Admin: connect a Google account via OAuth (Section 59) — the OAuth
   * code exchange happens entirely on the server; the browser only opens
   * Google's consent screen and forwards the one-time `code`. */
  function beginGoogleDriveOAuth() {
    const clientId = "REPLACE_WITH_YOUR_OAUTH_CLIENT_ID";
    const redirectUri = `${window.location.origin}/#/admin/settings/drive-callback`;
    const scope = encodeURIComponent("https://www.googleapis.com/auth/drive.readonly");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = url;
  }

  async function completeGoogleDriveOAuth(code) {
    return authedFetch("/completeDriveOAuth", { method: "POST", body: JSON.stringify({ code }) });
  }

  /** Admin: list files in the connected Drive folder to attach to a lesson
   * — proxied through the server so the service-account token never
   * reaches the browser. */
  async function listDriveFiles(folderId) {
    return authedFetch(`/listDriveFiles?folderId=${encodeURIComponent(folderId || "")}`);
  }

  return {
    getPlaybackSource, getDocumentSource,
    beginGoogleDriveOAuth, completeGoogleDriveOAuth, listDriveFiles,
  };
})();
