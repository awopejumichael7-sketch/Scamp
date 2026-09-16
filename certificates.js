/**
 * certificates.js
 * ---------------------------------------------------------------------------
 * Section 30: certificate generation when a student completes a course
 * (100% progress) and the admin has certificates enabled for that course.
 * Rendered client-side to a <canvas> and exported as PNG/PDF — no server
 * cost, works entirely within the free-tier architecture (Section 51).
 * ---------------------------------------------------------------------------
 */

const Certificates = (() => {
  function generateCertificateNumber(studentId, courseId) {
    return `SC-${courseId.slice(0, 4).toUpperCase()}-${studentId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  }

  async function issueIfEligible(student, course, progress) {
    if (!course.certificateEnabled) return null;
    if (progress.percentage < 100) return null;
    const existing = await Store.list("certificates", { where: [["studentId", "==", student.id], ["courseId", "==", course.id]] });
    if (existing.length) return existing[0];
    return Store.create("certificates", {
      studentId: student.id, courseId: course.id,
      certificateNumber: generateCertificateNumber(student.id, course.id),
      issuedAt: new Date().toISOString(),
    });
  }

  /** Draws the certificate onto a provided <canvas> element for download/print. */
  function renderToCanvas(canvas, { studentName, courseName, certificateNumber, issuedAt }) {
    const ctx = canvas.getContext("2d");
    canvas.width = 1200; canvas.height = 850;
    ctx.fillStyle = "#0F172A"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#2563EB"; ctx.lineWidth = 10; ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    ctx.textAlign = "center"; ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 34px Arial"; ctx.fillText("SCHOLAR'S CAMP", canvas.width / 2, 150);
    ctx.font = "20px Arial"; ctx.fillStyle = "#94A3B8"; ctx.fillText("This certifies that", canvas.width / 2, 260);
    ctx.font = "bold 46px Georgia"; ctx.fillStyle = "#FFFFFF"; ctx.fillText(studentName, canvas.width / 2, 340);
    ctx.font = "20px Arial"; ctx.fillStyle = "#94A3B8"; ctx.fillText("successfully completed", canvas.width / 2, 400);
    ctx.font = "bold 32px Arial"; ctx.fillStyle = "#3B82F6"; ctx.fillText(courseName, canvas.width / 2, 460);
    ctx.font = "16px Arial"; ctx.fillStyle = "#64748B";
    ctx.fillText(`Date: ${new Date(issuedAt).toLocaleDateString()}`, canvas.width / 2, 700);
    ctx.fillText(`Certificate ID: ${certificateNumber}`, canvas.width / 2, 730);
  }

  return { generateCertificateNumber, issueIfEligible, renderToCanvas };
})();
