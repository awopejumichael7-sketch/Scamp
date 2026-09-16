/**
 * admin.js
 * ---------------------------------------------------------------------------
 * Sections 18, 19, 20, 26, 36, 38, 42, 46, 53, 58: Admin dashboard, full CRUD
 * for every entity, teacher permissioning, Exam Builder, analytics, audit
 * log viewer, settings. This renders into #view for any route starting
 * with /admin — router.js also renders the admin sidebar (Section 53).
 * ---------------------------------------------------------------------------
 */

const AdminUI = (() => {
  const SIDEBAR_LINKS = [
    ["/admin", "Dashboard"], ["/admin/students", "Students"], ["/admin/teachers", "Teachers"],
    ["/admin/subjects", "Subjects"], ["/admin/classes", "Classes"], ["/admin/courses", "Courses"],
    ["/admin/questions", "Question Bank"], ["/admin/exams", "Exam Builder"],
    ["/admin/payments", "Payments"], ["/admin/enrollments", "Enrollments"],
    ["/admin/certificates", "Certificates"], ["/admin/announcements", "Announcements"],
    ["/admin/reports", "Reports"], ["/admin/analytics", "Analytics"],
    ["/admin/audit-log", "Audit Log"], ["/admin/settings", "Settings"],
  ];

  async function renderDashboard(view) {
    const [students, courses, subjects, payments, exams, questions, videos, textbooks] = await Promise.all(
      ["students", "courses", "subjects", "payments", "exams", "questions", "videos", "textbooks"].map((c) => Store.list(c))
    );
    const revenue = payments.filter((p) => p.status === "verified").reduce((sum, p) => sum + (p.amount || 0), 0);
    const stat = (label, value) => `<div class="card stat-card"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`;

    view.innerHTML = `
      <h1 class="page-title">Admin Dashboard</h1>
      <p class="page-subtitle">Overview of Scholar's Camp activity.</p>
      <div class="grid grid-cols-4">
        ${stat("Total Students", students.length)}
        ${stat("Total Courses", courses.length)}
        ${stat("Total Subjects", subjects.length)}
        ${stat("Total Revenue", `₦${revenue.toLocaleString()}`)}
        ${stat("Total Enrollments", payments.filter((p) => p.status === "verified").length)}
        ${stat("Total Exams", exams.length)}
        ${stat("Total Questions", questions.length)}
        ${stat("Total Videos", videos.length)}
        ${stat("Total Textbooks", textbooks.length)}
      </div>
      <div class="card" style="margin-top:20px">
        <h3>Course Sales (last entries)</h3>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Course</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${payments.slice(-10).reverse().map((p) => `<tr><td>${p.courseId}</td><td>₦${p.amount}</td><td><span class="pill ${p.status === "verified" ? "pill-success" : "pill-warning"}">${p.status}</span></td><td>${new Date(p.createdAt).toLocaleDateString()}</td></tr>`).join("") || `<tr><td colspan="4">No payments yet.</td></tr>`}</tbody>
        </table></div>
      </div>
    `;
  }

  /** Generic CRUD table+form builder reused across Subjects/Classes/Courses/etc. */
  function renderCrudPage(view, { collection, title, fields, extraColumns = [] }) {
    view.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><h1 class="page-title">${title}</h1><p class="page-subtitle">Create, edit and delete ${title.toLowerCase()}.</p></div>
        <button class="btn btn-primary" id="crud-new">+ New</button>
      </div>
      <div class="card"><div class="table-wrap"><table class="data-table" id="crud-table">
        <thead><tr>${fields.map((f) => `<th>${f.label}</th>`).join("")}${extraColumns.map((c) => `<th>${c}</th>`).join("")}<th>Actions</th></tr></thead>
        <tbody><tr><td colspan="99">Loading…</td></tr></tbody>
      </table></div></div>
      <div id="crud-modal-root"></div>
    `;

    async function refresh() {
      const rows = await Store.list(collection);
      view.querySelector("#crud-table tbody").innerHTML = rows.length
        ? rows.map((r) => `<tr>${fields.map((f) => `<td>${(r[f.name] ?? "")}</td>`).join("")}${extraColumns.map(() => `<td></td>`).join("")}<td>
            <button class="btn btn-outline btn-sm" data-edit="${r.id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button>
          </td></tr>`).join("")
        : `<tr><td colspan="99">No ${title.toLowerCase()} yet.</td></tr>`;

      view.querySelectorAll("[data-edit]").forEach((btn) =>
        btn.addEventListener("click", () => openForm(rows.find((r) => r.id === btn.dataset.edit))));
      view.querySelectorAll("[data-del]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          if (confirm("Delete this item? This cannot be undone.")) { await Store.remove(collection, btn.dataset.del); refresh(); }
        }));
    }

    function openForm(existing) {
      const root = view.querySelector("#crud-modal-root");
      root.innerHTML = `
        <div class="modal-backdrop"><div class="modal">
          <h3>${existing ? "Edit" : "New"} ${title.slice(0, -1)}</h3>
          <form id="crud-form">
            ${fields.map((f) => `
              <div class="field">
                <label class="label">${f.label}</label>
                ${f.type === "textarea"
                  ? `<textarea class="input" name="${f.name}" rows="3">${existing?.[f.name] ?? ""}</textarea>`
                  : `<input class="input" type="${f.type || "text"}" name="${f.name}" value="${existing?.[f.name] ?? ""}" ${f.required ? "required" : ""} />`}
              </div>`).join("")}
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" class="btn btn-outline" id="crud-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div></div>`;
      root.querySelector("#crud-cancel").addEventListener("click", () => { root.innerHTML = ""; });
      root.querySelector("#crud-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        if (existing) await Store.update(collection, existing.id, data);
        else await Store.create(collection, data);
        root.innerHTML = ""; refresh();
        Toast.show(`${title.slice(0, -1)} saved.`);
      });
    }

    view.querySelector("#crud-new").addEventListener("click", () => openForm(null));
    refresh();
  }

  function renderSubjects(view) {
    renderCrudPage(view, { collection: "subjects", title: "Subjects", fields: [{ name: "name", label: "Name", required: true }, { name: "description", label: "Description", type: "textarea" }] });
  }
  function renderClasses(view) {
    renderCrudPage(view, { collection: "classes", title: "Classes", fields: [{ name: "name", label: "Name (e.g. Year 10)", required: true }, { name: "order", label: "Order", type: "number" }] });
  }
  function renderCourses(view) {
    renderCrudPage(view, {
      collection: "courses", title: "Courses",
      fields: [
        { name: "title", label: "Title", required: true }, { name: "subjectId", label: "Subject ID" },
        { name: "classId", label: "Class ID" }, { name: "price", label: "Price (₦)", type: "number" },
        { name: "discountPrice", label: "Discount Price (₦)", type: "number" }, { name: "level", label: "Level" },
        { name: "status", label: "Status (draft/published)" }, { name: "description", label: "Description", type: "textarea" },
      ],
    });
  }
  function renderTextbooks(view) {
    renderCrudPage(view, {
      collection: "textbooks", title: "Textbooks",
      fields: [{ name: "title", label: "Title", required: true }, { name: "subjectId", label: "Subject ID" }, { name: "classId", label: "Class ID" }, { name: "driveFileId", label: "Google Drive File ID" }, { name: "access", label: "Access (free/premium)" }],
    });
  }
  function renderStudents(view) {
    renderCrudPage(view, { collection: "users", title: "Students", fields: [{ name: "fullName", label: "Name" }, { name: "email", label: "Email" }, { name: "classId", label: "Class" }, { name: "role", label: "Role" }] });
  }
  function renderTeachers(view) {
    view.innerHTML = `<h1 class="page-title">Teachers</h1><p class="page-subtitle">Grant scoped permissions — teachers never receive full admin rights automatically (Section 20).</p>`;
    renderCrudPage(view, {
      collection: "users", title: "Teachers",
      fields: [{ name: "fullName", label: "Name" }, { name: "email", label: "Email" }, { name: "permissions", label: "Permissions (comma-separated)" }],
    });
  }
  function renderAnnouncements(view) {
    renderCrudPage(view, { collection: "notifications", title: "Announcements", fields: [{ name: "title", label: "Title", required: true }, { name: "body", label: "Body", type: "textarea" }] });
  }

  async function renderQuestionBank(view) {
    view.innerHTML = `
      <h1 class="page-title">Question Bank</h1>
      <p class="page-subtitle">Manage questions, or bulk-import via CSV (Section 37).</p>
      <div class="card" style="margin-bottom:16px">
        <label class="label">Bulk import CSV</label>
        <input type="file" id="csv-input" accept=".csv" class="input" />
        <div id="import-result" style="margin-top:10px;font-size:13px;color:var(--text-muted)"></div>
      </div>
      <div id="crud-host"></div>
    `;
    view.querySelector("#csv-input").addEventListener("change", async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text();
      try {
        const rows = Questions.parseCsv(text);
        const result = await Questions.bulkImport(rows);
        view.querySelector("#import-result").textContent = `Imported ${result.created} questions.${result.errors.length ? " Errors: " + result.errors.join("; ") : ""}`;
        renderCrudPage(view.querySelector("#crud-host"), qbConfig());
      } catch (err) { view.querySelector("#import-result").textContent = `Import failed: ${err.message}`; }
    });
    renderCrudPage(view.querySelector("#crud-host"), qbConfig());
  }
  function qbConfig() {
    return {
      collection: "questions", title: "Questions",
      fields: [
        { name: "prompt", label: "Question", type: "textarea", required: true },
        { name: "type", label: "Type (multiple_choice/true_false/fill_gap/short_answer/essay)" },
        { name: "correctAnswer", label: "Correct Answer" }, { name: "explanation", label: "Explanation", type: "textarea" },
        { name: "subjectId", label: "Subject ID" }, { name: "topicId", label: "Topic ID" }, { name: "difficulty", label: "Difficulty" },
      ],
    };
  }

  function renderExamBuilder(view) {
    renderCrudPage(view, {
      collection: "exams", title: "Exams",
      fields: [
        { name: "title", label: "Exam Title", required: true }, { name: "subjectId", label: "Subject ID" },
        { name: "durationMinutes", label: "Duration (minutes)", type: "number" }, { name: "passingScore", label: "Passing Score (%)", type: "number" },
        { name: "attemptsAllowed", label: "Attempts (unlimited/one/number)" }, { name: "status", label: "Status (draft/published)" },
      ],
    });
  }

  function renderPayments(view) { renderCrudPage(view, { collection: "payments", title: "Payments", fields: [{ name: "studentId", label: "Student" }, { name: "courseId", label: "Course" }, { name: "amount", label: "Amount" }, { name: "status", label: "Status" }] }); }
  function renderEnrollments(view) { renderCrudPage(view, { collection: "enrollments", title: "Enrollments", fields: [{ name: "studentId", label: "Student" }, { name: "courseId", label: "Course" }, { name: "source", label: "Source" }] }); }
  function renderCertificates(view) { renderCrudPage(view, { collection: "certificates", title: "Certificates", fields: [{ name: "studentId", label: "Student" }, { name: "courseId", label: "Course" }, { name: "certificateNumber", label: "Number" }] }); }

  async function renderReports(view) {
    const reports = await Store.list("reports");
    view.innerHTML = `<h1 class="page-title">Reported Questions</h1>
      <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Question</th><th>Reason</th><th>Note</th><th>Status</th></tr></thead>
      <tbody>${reports.map((r) => `<tr><td>${r.questionId}</td><td>${r.reason}</td><td>${r.note || ""}</td><td>${r.status}</td></tr>`).join("") || `<tr><td colspan="4">No reports.</td></tr>`}</tbody>
      </table></div></div>`;
  }

  async function renderAuditLog(view) {
    const logs = await Store.list("auditLogs", { orderByField: "createdAt", limit: 100 });
    view.innerHTML = `<h1 class="page-title">Audit Log</h1><p class="page-subtitle">Section 46 — every important admin/teacher action.</p>
      <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Action</th><th>Target</th><th>Actor</th><th>When</th></tr></thead>
      <tbody>${logs.slice().reverse().map((l) => `<tr><td>${l.action}</td><td>${l.targetType} / ${l.targetId}</td><td>${l.actorId}</td><td>${new Date(l.createdAt).toLocaleString()}</td></tr>`).join("") || `<tr><td colspan="4">No activity yet.</td></tr>`}</tbody>
      </table></div></div>`;
  }

  async function renderAnalytics(view) {
    const [attempts, payments, courses] = await Promise.all(["examAttempts", "payments", "courses"].map((c) => Store.list(c)));
    const avgScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / attempts.length) : 0;
    const completionCounts = {};
    attempts.forEach((a) => { completionCounts[a.examId] = (completionCounts[a.examId] || 0) + 1; });
    view.innerHTML = `
      <h1 class="page-title">Analytics</h1>
      <div class="grid grid-cols-3">
        <div class="card stat-card"><span class="stat-value">${avgScore}%</span><span class="stat-label">Average Exam Score</span></div>
        <div class="card stat-card"><span class="stat-value">${payments.filter((p) => p.status === "verified").length}</span><span class="stat-label">Course Purchases</span></div>
        <div class="card stat-card"><span class="stat-value">${courses.length}</span><span class="stat-label">Total Courses</span></div>
      </div>
      <div class="card" style="margin-top:16px"><h3>Difficult Questions</h3>
        <button class="btn btn-outline btn-sm" id="recompute">Recompute difficulty flags</button>
        <div id="difficult-list" style="margin-top:10px"></div>
      </div>`;
    view.querySelector("#recompute").addEventListener("click", async () => {
      await Questions.recomputeDifficultyFlags();
      const flagged = (await Store.list("questions")).filter((q) => q.flaggedDifficult);
      view.querySelector("#difficult-list").innerHTML = flagged.map((q) => `<div class="pill pill-danger" style="margin:4px">${q.prompt.slice(0, 40)}…</div>`).join("") || "None flagged yet.";
    });
  }

  function renderSettings(view) {
    view.innerHTML = `
      <h1 class="page-title">Settings</h1>
      <div class="card" style="max-width:520px">
        <h3>Google Drive Integration (Section 59)</h3>
        <p class="page-subtitle">Connect the Google account that hosts your course content.</p>
        <button class="btn btn-primary" id="connect-drive">Connect Google Drive</button>
      </div>
      <div class="card" style="max-width:520px;margin-top:16px">
        <h3>Institution</h3>
        <div class="field"><label class="label">School / Institution Name</label><input class="input" placeholder="Scholar's Camp" /></div>
        <div class="field"><label class="label">Currency</label><input class="input" value="NGN (₦)" /></div>
        <button class="btn btn-primary">Save Settings</button>
      </div>`;
    view.querySelector("#connect-drive").addEventListener("click", () => DriveService.beginGoogleDriveOAuth());
  }

  return {
    SIDEBAR_LINKS, renderDashboard, renderSubjects, renderClasses, renderCourses, renderTextbooks,
    renderStudents, renderTeachers, renderAnnouncements, renderQuestionBank, renderExamBuilder,
    renderPayments, renderEnrollments, renderCertificates, renderReports, renderAuditLog, renderAnalytics, renderSettings,
  };
})();

const Toast = (() => {
  function show(message) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
  return { show };
})();
