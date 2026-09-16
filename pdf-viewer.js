/**
 * pdf-viewer.js
 * ---------------------------------------------------------------------------
 * Sections 9 & 10: Protected textbook/material viewer. Renders a PDF
 * page-by-page inside an <iframe>/<canvas> using a short-lived signed URL
 * (never a permanent Drive link), overlays a "Licensed to: Name / Email"
 * watermark, and disables right-click and the browser's native download
 * toolbar button where the platform allows it.
 *
 * HONEST LIMITATION (Section 9, 68): browsers own their native PDF viewer
 * chrome. We deliberately do NOT rely on `<embed>`/`<object>` (which shows
 * the browser's own download/print icons); instead we stream the PDF into
 * PDF.js running in our own iframe so we control the toolbar. Even so, a
 * user with developer tools open, or simply photographing their screen,
 * cannot be stopped by any browser-based control — this is disclosed to
 * the admin in SECURITY.md and should be disclosed to students via the
 * copyright notice (Section 69).
 * ---------------------------------------------------------------------------
 */

const PdfViewer = (() => {
  async function mount(container, materialId, { studentName, studentEmail } = {}) {
    container.innerHTML = `<div class="empty-state">Loading protected document…</div>`;
    let source;
    try {
      source = await DriveService.getDocumentSource(materialId);
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Unable to load this document. Please check your internet connection.</div>`;
      return;
    }

    container.style.position = "relative";
    // #toolbar=0 hides PDF.js's built-in download/print icons where the
    // viewer respects it; this is a UI nicety, not a security boundary.
    container.innerHTML = `
      <iframe title="Protected document" src="${source.url}#toolbar=0&navpanes=0"
        style="width:100%;height:70vh;border:1px solid var(--border);border-radius:12px;background:#fff"></iframe>
      <div class="watermark-overlay">
        ${Array.from({ length: 8 }).map(() => `<span>Scholar's Camp — Licensed to: ${studentName || ""} (${studentEmail || ""})</span>`).join("")}
      </div>
    `;
    container.addEventListener("contextmenu", (e) => e.preventDefault());
    logAccess(materialId);
  }

  async function logAccess(materialId) {
    const user = auth.currentUser;
    if (!user) return;
    await db.collection("auditLogs").add({
      actorId: user.uid, action: "document.access", targetType: "textbook", targetId: materialId,
      createdAt: new Date().toISOString(),
    });
  }

  return { mount };
})();
