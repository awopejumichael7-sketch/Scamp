/**
 * study-exam-mode.js
 * ---------------------------------------------------------------------------
 * Sections 12, 13, 56: renders Study Mode (learn-as-you-go, instant
 * feedback) and Exam Mode (timed simulation with auto-marking + result page).
 * ---------------------------------------------------------------------------
 */

const StudyExamMode = (() => {
  async function renderStudyMode(view, { subjectId, topicId }) {
    const list = await Questions.listBySubjectTopic({ subjectId, topicId });
    if (!list.length) { view.innerHTML = `<div class="empty-state">No questions available for this topic yet.</div>`; return; }
    const session = Questions.createStudySession(list);
    draw();

    function draw() {
      const q = session.current();
      const given = session.getResponse(q);
      const graded = given !== undefined ? session.grade(q) : null;

      view.innerHTML = `
        <div class="page-subtitle">Study Mode — Question ${session.position()} of ${session.total()}</div>
        <div class="card">
          <p style="font-size:16px;font-weight:600">${q.prompt}</p>
          ${renderAnswerInput(q, given)}
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button class="btn btn-primary" id="submit-answer" ${given !== undefined ? "disabled" : ""}>Check Answer</button>
            <button class="btn btn-outline" id="bookmark-btn">🔖 Bookmark</button>
            <button class="btn btn-outline" id="report-btn">🚩 Report</button>
            <button class="btn btn-outline" id="retry-btn" ${given === undefined ? "disabled" : ""}>Retry</button>
          </div>
          ${given !== undefined ? `
            <div class="card" style="margin-top:14px;background:${graded ? "var(--success-soft)" : "var(--danger-soft)"}">
              <strong>${graded === null ? "Submitted for manual grading" : graded ? "✓ Correct" : "✗ Incorrect"}</strong>
              <p><strong>Correct answer:</strong> ${Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : q.correctAnswer}</p>
              <p>${q.explanation || ""}</p>
              ${(q.workedSteps || []).map((s) => `<div><em>${s.step}:</em> ${s.detail}</div>`).join("")}
            </div>` : ""}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:12px;">
          <button class="btn btn-outline" id="prev-q" ${session.position() === 1 ? "disabled" : ""}>← Previous</button>
          <button class="btn btn-outline" id="next-q" ${session.position() === session.total() ? "disabled" : ""}>Next →</button>
        </div>
      `;

      view.querySelector("#submit-answer")?.addEventListener("click", () => {
        const input = collectAnswer(view, q);
        session.answer(input);
        draw();
      });
      view.querySelector("#retry-btn")?.addEventListener("click", () => { session.retry(); draw(); });
      view.querySelector("#prev-q")?.addEventListener("click", () => { session.previous(); draw(); });
      view.querySelector("#next-q")?.addEventListener("click", () => { session.next(); draw(); });
      view.querySelector("#bookmark-btn")?.addEventListener("click", async () => {
        const added = await Questions.toggleBookmark("question", q.id);
        Toast.show(added ? "Bookmarked." : "Removed bookmark.");
      });
      view.querySelector("#report-btn")?.addEventListener("click", async () => {
        const reason = prompt("What's wrong with this question? (e.g. Wrong answer, Typo, Broken content)");
        if (reason) { await Questions.reportQuestion(q.id, reason, ""); Toast.show("Report sent. Thank you."); }
      });
    }
  }

  function renderAnswerInput(q, given) {
    if (q.type === "multiple_choice" || q.type === "true_false") {
      const options = q.options || [{ id: "true", text: "True" }, { id: "false", text: "False" }];
      return `<div class="field">${options.map((o) => `
        <label style="display:flex;gap:8px;padding:8px 0;">
          <input type="radio" name="answer" value="${o.id}" ${given === o.id ? "checked" : ""} ${given !== undefined ? "disabled" : ""} /> ${o.text}
        </label>`).join("")}</div>`;
    }
    return `<div class="field"><input class="input" name="answer" value="${given ?? ""}" ${given !== undefined ? "disabled" : ""} placeholder="Type your answer" /></div>`;
  }

  function collectAnswer(view, q) {
    if (q.type === "multiple_choice" || q.type === "true_false") {
      return view.querySelector('input[name="answer"]:checked')?.value;
    }
    return view.querySelector('input[name="answer"]')?.value;
  }

  // ---------------- Exam Mode ----------------

  async function renderExamIntro(view, examId) {
    const exam = await Store.get("exams", examId);
    const profile = Auth.profile();
    const canStart = await ExamEngine.canStartAttempt(examId, profile.id, exam.attemptsAllowed);
    view.innerHTML = `
      <div class="card" style="max-width:560px;margin:0 auto;text-align:center;">
        <h1 class="page-title">${exam.title}</h1>
        <p class="page-subtitle">${exam.durationMinutes} minutes · Passing score: ${exam.passingScore}%</p>
        <p>Once started, the timer cannot be paused. Your answers auto-save as you go. The exam will submit automatically when time expires.</p>
        <button class="btn btn-primary" id="start-exam" ${canStart ? "" : "disabled"}>
          ${canStart ? "Start Exam" : "No attempts remaining"}
        </button>
      </div>`;
    view.querySelector("#start-exam")?.addEventListener("click", () => renderExamRunner(view, exam));
  }

  async function renderExamRunner(view, exam) {
    const profile = Auth.profile();
    const questions = await ExamEngine.resolveExamQuestions(exam);
    const attempt = await ExamEngine.startAttempt(exam, profile.id);
    let current = 0;
    let submitted = false;

    window.addEventListener("beforeunload", beforeUnloadWarning);
    const timer = ExamEngine.createTimer(exam.durationMinutes, {
      onTick: (secs) => { const el = document.getElementById("exam-timer"); if (el) el.textContent = formatTime(secs); },
      onExpire: () => finish(true),
    });

    draw();

    function beforeUnloadWarning(e) { if (!submitted) { e.preventDefault(); e.returnValue = ""; } }

    function draw() {
      const q = questions[current];
      const given = attempt.answers[q.id];
      view.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="page-subtitle">Question ${current + 1} of ${questions.length}</div>
          <div id="exam-timer" style="font-weight:800;font-size:18px;color:var(--danger)">${formatTime(exam.durationMinutes * 60)}</div>
        </div>
        <div class="card">
          <p style="font-weight:600;font-size:16px">${q.prompt}</p>
          ${renderAnswerInput(q, given)}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <button class="btn btn-outline" id="prev-q" ${current === 0 ? "disabled" : ""}>← Previous</button>
            <button class="btn btn-outline" id="next-q" ${current === questions.length - 1 ? "disabled" : ""}>Next →</button>
          </div>
          <button class="btn btn-danger" id="submit-exam">Submit Exam</button>
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text-muted)">
          Answered: ${Object.keys(attempt.answers).length} / ${questions.length}
        </div>
      `;
      view.querySelectorAll('input[name="answer"]').forEach((el) =>
        el.addEventListener("change", async () => {
          const val = collectAnswer(view, q);
          attempt.answers[q.id] = val;
          await ExamEngine.saveAnswer(attempt.id, q.id, val);
        }));
      view.querySelector("#prev-q")?.addEventListener("click", () => { current--; draw(); });
      view.querySelector("#next-q")?.addEventListener("click", () => { current++; draw(); });
      view.querySelector("#submit-exam")?.addEventListener("click", () => {
        if (confirm("Submit exam now? You cannot change answers after submitting.")) finish(false);
      });
    }

    async function finish(autoSubmitted) {
      submitted = true;
      timer.stop();
      window.removeEventListener("beforeunload", beforeUnloadWarning);
      const result = await ExamEngine.submitAttempt(attempt, questions, { autoSubmitted });
      await Notifications.send(profile.id, "exam_result", "Exam Result Ready", `You scored ${result.percentage}% on ${exam.title}.`);
      renderResult(view, exam, result);
    }
  }

  function renderResult(view, exam, result) {
    view.innerHTML = `
      <div class="card" style="max-width:520px;margin:0 auto;text-align:center;">
        <h1 class="page-title">${result.percentage >= exam.passingScore ? "Congratulations!" : "Exam Complete"}</h1>
        <div style="font-size:40px;font-weight:800;margin:10px 0;">${result.score}/${result.totalMarks}</div>
        <div class="page-subtitle">Percentage: ${result.percentage}% · Grade: ${result.grade}</div>
        <div class="grid grid-cols-3" style="margin-top:16px;">
          <div class="stat-card"><span class="stat-value">${result.correct}</span><span class="stat-label">Correct</span></div>
          <div class="stat-card"><span class="stat-value">${result.incorrect}</span><span class="stat-label">Incorrect</span></div>
          <div class="stat-card"><span class="stat-value">${result.unanswered}</span><span class="stat-label">Unanswered</span></div>
        </div>
        <p style="margin-top:10px;color:var(--text-muted)">Time used: ${result.timeUsedMinutes} minutes</p>
        ${exam.showAnswersAfter ? `<a href="#/student/exams" class="btn btn-outline" style="margin-top:10px;">Review Answers</a>` : ""}
      </div>`;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return { renderStudyMode, renderExamIntro };
})();
