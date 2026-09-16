/**
 * router.js
 * ---------------------------------------------------------------------------
 * Lightweight hash router. No build step, no framework — matches the
 * "single flat folder" constraint while still giving Scholar's Camp
 * distinct pages (Section 39, 53, 54) and enforcing that admin-only and
 * student-only routes redirect unauthorized visitors (UI-level guard only
 * — the real enforcement is Firestore Security Rules, Section 62).
 * ---------------------------------------------------------------------------
 */

const Router = (() => {
  const view = document.getElementById("view");
  const sidebar = document.getElementById("sidebar");
  const mobileNav = document.getElementById("mobile-nav");

  function guard(role) {
    const current = Auth.role();
    if (role === "admin" && !["admin", "super_admin"].includes(current)) { location.hash = "#/login"; return false; }
    if (role === "student" && !current) { location.hash = "#/login"; return false; }
    return true;
  }

  async function renderSidebarFor(section) {
    const links = section === "admin" ? AdminUI.SIDEBAR_LINKS : StudentUI.SIDEBAR_LINKS;
    const path = location.hash.slice(1) || "/";
    sidebar.innerHTML = links.map(([href, label]) =>
      `<a class="sidebar-link ${path === href ? "active" : ""}" href="#${href}">${label}</a>`).join("");
    mobileNav.innerHTML = links.slice(0, 5).map(([href, label]) =>
      `<a class="mobile-nav-item ${path === href ? "active" : ""}" href="#${href}"><span>${label}</span></a>`).join("");
  }

  async function route() {
    const path = location.hash.slice(1) || "/";
    view.innerHTML = "";
    VideoPlayer.unmount();

    // Public routes
    if (path === "/") return renderHome();
    if (path === "/login") return AuthUI.renderLogin(view);
    if (path === "/register") return AuthUI.renderRegister(view);
    if (path === "/forgot-password") return AuthUI.renderForgotPassword(view);
    if (path === "/courses") { sidebar.innerHTML = ""; mobileNav.innerHTML = ""; return StudentUI.renderCourseCatalog(view); }

    const courseLessonMatch = path.match(/^\/courses\/([^/]+)\/lesson\/([^/]+)$/);
    if (courseLessonMatch) { if (!guard("student")) return; return StudentUI.renderLessonPage(view, courseLessonMatch[1], courseLessonMatch[2]); }
    const courseMatch = path.match(/^\/courses\/([^/]+)$/);
    if (courseMatch) return StudentUI.renderCoursePage(view, courseMatch[1]);

    const studyMatch = path.match(/^\/study\/([^/]+)\/([^/]+)$/);
    if (studyMatch) { if (!guard("student")) return; return StudyExamMode.renderStudyMode(view, { subjectId: studyMatch[1], topicId: studyMatch[2] }); }
    const examMatch = path.match(/^\/exam\/([^/]+)$/);
    if (examMatch) { if (!guard("student")) return; return StudyExamMode.renderExamIntro(view, examMatch[1]); }

    // Student section
    if (path.startsWith("/student")) {
      if (!guard("student")) return;
      await renderSidebarFor("student");
      if (path === "/student") return StudentUI.renderDashboard(view);
      if (path === "/student/courses") return StudentUI.renderDashboard(view);
      if (path === "/student/profile") return AuthUI.renderProfile(view);
      view.innerHTML = `<div class="empty-state">Coming next in this build.</div>`;
      return;
    }

    // Admin section
    if (path.startsWith("/admin")) {
      if (!guard("admin")) return;
      await renderSidebarFor("admin");
      const map = {
        "/admin": AdminUI.renderDashboard, "/admin/students": AdminUI.renderStudents,
        "/admin/teachers": AdminUI.renderTeachers, "/admin/subjects": AdminUI.renderSubjects,
        "/admin/classes": AdminUI.renderClasses, "/admin/courses": AdminUI.renderCourses,
        "/admin/questions": AdminUI.renderQuestionBank, "/admin/exams": AdminUI.renderExamBuilder,
        "/admin/payments": AdminUI.renderPayments, "/admin/enrollments": AdminUI.renderEnrollments,
        "/admin/certificates": AdminUI.renderCertificates, "/admin/announcements": AdminUI.renderAnnouncements,
        "/admin/reports": AdminUI.renderReports, "/admin/analytics": AdminUI.renderAnalytics,
        "/admin/audit-log": AdminUI.renderAuditLog, "/admin/settings": AdminUI.renderSettings,
      };
      const fn = map[path];
      return fn ? fn(view) : (view.innerHTML = `<div class="empty-state">Not found.</div>`);
    }

    view.innerHTML = `<div class="empty-state">Page not found.</div>`;
  }

  function renderHome() {
    sidebar.innerHTML = ""; mobileNav.innerHTML = "";
    view.innerHTML = `
      <div style="text-align:center;padding:40px 16px;">
        <h1 style="font-size:34px;font-weight:800;">Scholar's Camp</h1>
        <p style="color:var(--text-muted);font-size:16px;">Learn. Practice. Master.</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap;">
          <a class="btn btn-primary" href="#/courses">Browse Courses</a>
          <a class="btn btn-outline" href="#/register">Create Account</a>
        </div>
      </div>
      <div class="grid grid-cols-3" style="margin-top:20px;">
        <div class="card"><h3>📚 Structured Courses</h3><p class="page-subtitle">Class → Subject → Course → Module → Topic → Lesson, built by your teachers.</p></div>
        <div class="card"><h3>📝 Study & Exam Modes</h3><p class="page-subtitle">Instant feedback while learning, real exam simulation when it counts.</p></div>
        <div class="card"><h3>📊 Progress Analytics</h3><p class="page-subtitle">See your strengths, weaknesses, and what to practice next.</p></div>
      </div>`;
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("sc:auth-changed", route);

  return { route };
})();
