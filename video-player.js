/**
 * video-player.js
 * ---------------------------------------------------------------------------
 * Section 7 & 8: Scholar's Camp video player. Fetches a short-lived
 * playback source from DriveService (never a raw Drive URL held in the
 * DOM/JS longer than needed), tracks resume position + watch percentage,
 * and deliberately omits any download affordance.
 *
 * Practical protections implemented here (see drive-service.js for the
 * honest limitation notice — this cannot stop screen recording):
 *  - `controlsList="nodownload noremoteplayback"` and `disablePictureInPicture`
 *  - context menu (right-click) disabled on the player
 *  - the <video> `src` is a short-lived signed URL, re-fetched (not cached
 *    to localStorage/IndexedDB) and expires quickly
 *  - a semi-transparent watermark with the student's name/email is drawn
 *    over the player (Section 9 pattern, applied to video too)
 * ---------------------------------------------------------------------------
 */

const VideoPlayer = (() => {
  let progressTimer = null;

  async function mount(container, lessonId, { studentName, onProgress } = {}) {
    container.innerHTML = `<div class="empty-state">Loading secure video…</div>`;
    let source;
    try {
      source = await DriveService.getPlaybackSource(lessonId);
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Unable to load this lesson. Please check your internet connection.</div>`;
      return;
    }

    container.style.position = "relative";
    container.innerHTML = `
      <video id="sc-video" style="width:100%;border-radius:12px;background:#000"
        controls controlsList="nodownload noremoteplayback" disablePictureInPicture playsinline>
      </video>
      <div class="watermark-overlay">${Array.from({ length: 6 }).map(() => `<span>${studentName || "Scholar's Camp"}</span>`).join("")}</div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        ${[0.75, 1, 1.25, 1.5, 2].map((r) => `<button class="btn btn-outline btn-sm speed-btn" data-rate="${r}">${r}x</button>`).join("")}
      </div>
    `;

    const video = container.querySelector("#sc-video");
    video.src = source.url;
    video.addEventListener("contextmenu", (e) => e.preventDefault());

    const resume = await getResumePosition(lessonId);
    if (resume) video.currentTime = resume;

    container.querySelectorAll(".speed-btn").forEach((btn) => {
      btn.addEventListener("click", () => { video.playbackRate = parseFloat(btn.dataset.rate); });
    });

    // Track progress every 5s and on pause/end (Section 40).
    progressTimer = setInterval(() => saveProgress(video, lessonId, onProgress), 5000);
    video.addEventListener("pause", () => saveProgress(video, lessonId, onProgress));
    video.addEventListener("ended", () => saveProgress(video, lessonId, onProgress, true));

    // Server access log (Section 8, requirement #13).
    logAccess(lessonId);
  }

  function unmount() { if (progressTimer) clearInterval(progressTimer); }

  async function saveProgress(video, lessonId, onProgress, completed = false) {
    const pct = video.duration ? Math.min(100, Math.round((video.currentTime / video.duration) * 100)) : 0;
    const user = auth.currentUser;
    if (!user) return;
    await db.collection("progress").doc(user.uid).set({
      lessonProgress: {
        [lessonId]: { status: completed || pct >= 95 ? "completed" : "in_progress", videoPct: pct, position: video.currentTime },
      },
      lastLessonId: lessonId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    if (onProgress) onProgress(pct);
  }

  async function getResumePosition(lessonId) {
    const user = auth.currentUser;
    if (!user) return 0;
    const snap = await db.collection("progress").doc(user.uid).get();
    const data = snap.exists ? snap.data() : null;
    return data?.lessonProgress?.[lessonId]?.position || 0;
  }

  async function logAccess(lessonId) {
    const user = auth.currentUser;
    if (!user) return;
    await db.collection("auditLogs").add({
      actorId: user.uid, action: "video.access", targetType: "lesson", targetId: lessonId,
      createdAt: new Date().toISOString(),
    });
  }

  return { mount, unmount };
})();
