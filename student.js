/**
 * student.js
 * ---------------------------------------------------------------------------
 * Sections 2, 17, 39, 41, 54, 56, 57: Student-facing dashboard, course
 * access UI, Study Mode UI, Exam Mode UI, profile, bookmarks, certificates.
 * ---------------------------------------------------------------------------
 */

const StudentUI = (() => {
  const SIDEBAR_LINKS = [
    ["/student", "Home"], ["/student/courses", "My Courses"], ["/courses", "Subjects"],
    ["/student/study", "Study"], ["/student/exams", "My Exams"], ["/student/textbooks", "Textbooks"],
    ["/student/progress", "Progress"], ["/student/bookmarks", "Bookmarks"],
    ["/student/certificates", "Certificates"], ["/student/profile", "Profile"],
  ];

  async function renderDashboard(view) {
    const profile = Auth.profile();
    const [continueLearning, enrollments] = await Promise.all([
      Courses.getContinueLearning(profile.id),
      Store.list("enrollments", { where: [["studentId", "==", profile.id]] }),
    ]);

    view.innerHTML = `
      <h1 class="page-title">Welcome, ${profile.fullName.split(" ")[0]}</h1>
      <p class="page-subtitle">Here's where you left off.</p>

      ${continueLearning ? `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <div class="stat-label">Continue Learning</div>
          <div style="font-weight:700;font-size:16px">${continueLearning.course.title} — ${continueLearning.lesson.title}</div>
        </div>
        <a class="btn btn-primary" href="#/courses/${continueLearning.course.id}/lesson/${continueLearning.lesson.id}">Continue Learning</a>
      </div>` : `<div class="card empty-state">You haven't started any lessons yet. <a href="#/courses" class="btn btn-primary btn-sm" style="margin-left:8px">Browse Courses</a></div>`}

      <h3 style="margin-top:24px">My Courses (${enrollments.length})</h3>
      <div class="grid grid-cols-3" id="my-courses">Loading…</div>
    `;

    const courses = await Promise.all(enrollments.map((e) => Store.get("courses", e.courseId)));
    view.querySelector("#my-courses").innerHTML = courses.filter(Boolean).map((c) => courseCard(c)).join("") || `<div class="empty-state">No enrolled courses yet.</div>`;
  }

  function courseCard(course, access) {
    const price = course.discountPrice ?? course.price;
    return `
      <div class="card">
        <div style="height:110px;border-radius:10px;background:var(--brand-soft);display:flex;align-items:center;justify-content:center;color:var(--brand);font-weight:700;margin-bottom:10px;">${course.title}</div>
        <div style="font-weight:700">${course.title}</div>
        <div class="page-subtitle" style="margin:4px 0">${course.level || ""} · ${course.duration || ""}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700">${price === 0 ? "Free" : "₦" + Number(price).toLocaleString()}</span>
          <a class="btn btn-sm ${access === "locked" ? "btn-outline" : "btn-primary"}" href="#/courses/${course.id}">${access === "locked" ? "View" : "Open"}</a>
        </div>
      </div>`;
  }

  async function renderCourseCatalog(view) {
    view.innerHTML = `<h1 class="page-title">Subjects & Courses</h1><div class="grid grid-cols-3" id="catalog">Loading…</div>`;
    const courses = await Courses.listPublished();
    const profile = Auth.profile();
    const withAccess = await Promise.all(courses.map(async (c) => [c, await Courses.canAccessCourse(c, profile)]));
    view.querySelector("#catalog").innerHTML = withAccess.map(([c, access]) => courseCard(c, access)).join("") || `<div class="empty-state">No published courses yet.</div>`;
  }

  /** Section 55, 39: course detail page — locked view (buy) vs. structure view (learn). */
  async function renderCoursePage(view, courseId) {
    const profile = Auth.profile();
    const course = await Store.get("courses", courseId);
    if (!course) { view.innerHTML = `<div class="empty-state">Course not found.</div>`; return; }
    const access = await Courses.canAccessCourse(course, profile);

    if (access !== "granted") {
      view.innerHTML = `
        <div class="card" style="max-width:640px;margin:0 auto;">
          <h1 class="page-title">${course.title}</h1>
          <p>${course.description || ""}</p>
          <h4>What You Will Learn</h4>
          <ul>${(course.objectives || []).map((o) => `<li>${o}</li>`).join("") || "<li>Full syllabus coverage with videos, textbooks and practice questions.</li>"}</ul>
          <div style="font-size:22px;font-weight:800;margin:14px 0;">${course.price === 0 ? "Free" : "₦" + Number(course.discountPrice ?? course.price).toLocaleString()}</div>
          <button class="btn btn-primary" id="buy-btn">${course.price === 0 ? "Enroll Free" : "Buy Course"}</button>
        </div>`;
      view.querySelector("#buy-btn").addEventListener("click", async () => {
        if (course.price === 0) { await Courses.enrollFree(course, profile.id); Toast.show("Enrolled!"); renderCoursePage(view, courseId); return; }
        try {
          await Payments.startCheckout({ provider: "paystack", course, student: profile, publicKey: "REPLACE_WITH_PAYSTACK_PUBLIC_KEY" });
          Toast.show("Payment verified — enrolled!");
          renderCoursePage(view, courseId);
        } catch (e) { Toast.show(`Payment failed: ${e.message}`); }
      });
      return;
    }

    const full = await Courses.getFullStructure(courseId);
    const progress = await Courses.computeProgress(profile.id, course);
    view.innerHTML = `
      <h1 class="page-title">${course.title}</h1>
      <div class="page-subtitle">Course Progress: ${progress.percentage}% (${progress.completed}/${progress.total} lessons)</div>
      <div class="progress-track" style="margin-bottom:18px;max-width:400px;"><div class="progress-fill" style="width:${progress.percentage}%"></div></div>
      ${full.modules.map((m) => `
        <div class="card" style="margin-bottom:12px;">
          <h3>${m.title}</h3>
          ${m.topics.map((t) => `
            <div style="margin:8px 0;">
              <div style="font-weight:600;font-size:13px;color:var(--text-muted)">${t.title}</div>
              ${t.lessons.map((l) => `
                <a href="#/courses/${courseId}/lesson/${l.id}" class="sidebar-link" style="justify-content:space-between;">
                  <span>${l.title}</span>
                  <span>${l.contentType === "video" ? "🎬" : l.contentType === "pdf" ? "📄" : "📝"}</span>
                </a>`).join("")}
            </div>`).join("")}
        </div>`).join("")}
    `;
  }

  async function renderLessonPage(view, courseId, lessonId) {
    const lesson = await Store.get("lessons", lessonId);
    const profile = Auth.profile();
    view.innerHTML = `<h1 class="page-title">${lesson.title}</h1><div id="lesson-content"></div>`;
    const host = view.querySelector("#lesson-content");
    if (lesson.contentType === "video") await VideoPlayer.mount(host, lessonId, { studentName: profile.fullName });
    else if (lesson.contentType === "pdf") await PdfViewer.mount(host, lessonId, { studentName: profile.fullName, studentEmail: profile.email });
    else host.innerHTML = `<div class="card">${lesson.textBody || "No content."}</div>`;
  }

  /** Section 12, 56: Study Mode + Exam Mode UI (see study-exam-mode.js companion for shared render helpers). */

  return { SIDEBAR_LINKS, renderDashboard, renderCourseCatalog, renderCoursePage, renderLessonPage, courseCard };
})();
