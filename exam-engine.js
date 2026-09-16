/**
 * exam-engine.js
 * ---------------------------------------------------------------------------
 * Sections 13, 14, 15, 38, 56: Exam Mode simulation, countdown timer,
 * randomization, auto-save, auto-submit, automatic marking + grading.
 * ---------------------------------------------------------------------------
 */

const ExamEngine = (() => {
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Section 38: resolve an exam's question list — manual selection and/or
   * random selection from a rule, e.g. "50 random from Mathematics/Algebra". */
  async function resolveExamQuestions(exam) {
    let questions = [];
    if (exam.manualQuestionIds?.length) {
      questions = await Promise.all(exam.manualQuestionIds.map((id) => Store.get("questions", id)));
    }
    if (exam.randomRule) {
      const pool = await Questions.listBySubjectTopic({
        subjectId: exam.randomRule.subjectId,
        topicId: exam.randomRule.topicId,
        difficulty: exam.randomRule.difficulty,
      });
      questions = questions.concat(shuffle(pool).slice(0, exam.randomRule.count));
    }
    if (exam.randomizeQuestions) questions = shuffle(questions);
    if (exam.randomizeOptions) {
      questions = questions.map((q) => (q.options ? { ...q, options: shuffle(q.options) } : q));
    }
    return questions;
  }

  /** Section 14: enforce attempt limits before allowing a new attempt to start. */
  async function canStartAttempt(examId, studentId, attemptsAllowed) {
    if (attemptsAllowed === "unlimited") return true;
    const prior = await Store.list("examAttempts", { where: [["examId", "==", examId], ["studentId", "==", studentId]] });
    const max = attemptsAllowed === "one" ? 1 : Number(attemptsAllowed);
    return prior.length < max;
  }

  async function startAttempt(exam, studentId) {
    const prior = await Store.list("examAttempts", { where: [["examId", "==", exam.id], ["studentId", "==", studentId]] });
    const attempt = await Store.create("examAttempts", {
      examId: exam.id, studentId, attemptNumber: prior.length + 1,
      startedAt: new Date().toISOString(), answers: {}, status: "in_progress",
    });
    return attempt;
  }

  /** Countdown controller: calls onTick each second and onExpire once, and
   * survives a temporary connection loss because it is purely client-side
   * wall-clock math, not a server heartbeat (Section 49). */
  function createTimer(durationMinutes, { onTick, onExpire }) {
    const endAt = Date.now() + durationMinutes * 60 * 1000;
    const interval = setInterval(() => {
      const remainingMs = endAt - Date.now();
      if (remainingMs <= 0) {
        clearInterval(interval);
        onExpire();
        return;
      }
      onTick(Math.ceil(remainingMs / 1000));
    }, 1000);
    return { stop: () => clearInterval(interval), endAt };
  }

  /** Section 49: auto-save answers locally + to Firestore as the student
   * answers, so a connection drop or accidental tab close does not lose
   * progress; on reconnect the latest saved answers are simply re-fetched. */
  async function saveAnswer(attemptId, questionId, answer) {
    localStorage.setItem(`sc_attempt_${attemptId}_${questionId}`, JSON.stringify(answer));
    await db.collection("examAttempts").doc(attemptId).set(
      { answers: { [questionId]: answer } }, { merge: true }
    );
  }

  /** Section 15, 56: automatic marking + grade calculation. Essay/short-answer
   * questions are excluded from the auto score and left for manual grading. */
  async function submitAttempt(attempt, questions, { autoSubmitted = false } = {}) {
    let scored = 0, totalMarks = 0, correct = 0, incorrect = 0, unanswered = 0, pendingManual = 0;

    questions.forEach((q) => {
      totalMarks += q.marks || 1;
      const given = attempt.answers[q.id];
      if (given === undefined || given === "" ) { unanswered++; return; }
      const result = Questions.isCorrect(q, given);
      if (result === null) { pendingManual++; return; } // essay/short answer
      if (result) { correct++; scored += q.marks || 1; }
      else incorrect++;
    });

    const percentage = totalMarks ? Math.round((scored / totalMarks) * 100) : 0;
    const grade = toGrade(percentage);

    const update = {
      submittedAt: new Date().toISOString(),
      status: autoSubmitted ? "auto_submitted" : "submitted",
      score: scored, percentage, grade,
    };
    await Store.update("examAttempts", attempt.id, update);

    return {
      ...update, totalMarks, correct, incorrect, unanswered, pendingManual,
      timeUsedMinutes: Math.round((new Date(update.submittedAt) - new Date(attempt.startedAt)) / 60000),
    };
  }

  function toGrade(pct) {
    if (pct >= 80) return "A";
    if (pct >= 70) return "B";
    if (pct >= 60) return "C";
    if (pct >= 50) return "D";
    if (pct >= 40) return "E";
    return "F";
  }

  return { resolveExamQuestions, canStartAttempt, startAttempt, createTimer, saveAnswer, submitAttempt, shuffle };
})();
