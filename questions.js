/**
 * questions.js
 * ---------------------------------------------------------------------------
 * Sections 11, 12, 37, 43, 44, 45: Question bank, Study Mode, CSV/Excel
 * bulk import + validation, worked-step explanations, bookmarks, reports.
 * ---------------------------------------------------------------------------
 */

const Questions = (() => {
  async function listBySubjectTopic({ subjectId, classId, courseId, topicId, difficulty }) {
    const where = [];
    if (subjectId) where.push(["subjectId", "==", subjectId]);
    if (classId) where.push(["classId", "==", classId]);
    if (courseId) where.push(["courseId", "==", courseId]);
    if (topicId) where.push(["topicId", "==", topicId]);
    if (difficulty) where.push(["difficulty", "==", difficulty]);
    return Store.list("questions", { where });
  }

  function isCorrect(question, studentAnswer) {
    if (question.type === "multiple_choice" || question.type === "true_false") {
      return studentAnswer === question.correctAnswer;
    }
    if (question.type === "fill_gap") {
      const norm = (s) => String(s || "").trim().toLowerCase();
      const accepted = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
      return accepted.some((a) => norm(a) === norm(studentAnswer));
    }
    // short_answer / essay: not auto-markable — flagged for manual grading (Section 15).
    return null;
  }

  /** Section 37: CSV bulk import with validation before publishing. */
  function parseCsv(text) {
    const [headerLine, ...lines] = text.trim().split(/\r?\n/);
    const headers = headerLine.split(",").map((h) => h.trim());
    const required = ["question", "type", "answer", "subject", "year", "topic"];
    const missing = required.filter((r) => !headers.includes(r));
    if (missing.length) throw new Error(`CSV missing required columns: ${missing.join(", ")}`);

    return lines.filter(Boolean).map((line, idx) => {
      const cells = line.split(",");
      const row = Object.fromEntries(headers.map((h, i) => [h, (cells[i] || "").trim()]));
      if (!row.question || !row.answer) {
        throw new Error(`Row ${idx + 2}: question and answer are required.`);
      }
      return {
        prompt: row.question,
        type: row.type || "multiple_choice",
        options: ["option_a", "option_b", "option_c", "option_d"]
          .filter((k) => row[k])
          .map((k, i) => ({ id: String.fromCharCode(97 + i), text: row[k] })),
        correctAnswer: row.answer,
        explanation: row.explanation || "",
        subjectId: row.subject,
        year: Number(row.year) || undefined,
        topicId: row.topic,
        difficulty: "medium",
        marks: 1,
        flaggedDifficult: false,
      };
    });
  }

  async function bulkImport(rows) {
    const results = { created: 0, errors: [] };
    for (const row of rows) {
      try { await Store.create("questions", row); results.created++; }
      catch (e) { results.errors.push(e.message); }
    }
    return results;
  }

  // ---- Study Mode state machine (Section 12) ----
  function createStudySession(questionList) {
    let index = 0;
    const responses = {};
    return {
      current: () => questionList[index],
      total: () => questionList.length,
      position: () => index + 1,
      answer(ans) { responses[questionList[index].id] = ans; },
      next() { if (index < questionList.length - 1) index++; return this.current(); },
      previous() { if (index > 0) index--; return this.current(); },
      retry() { delete responses[questionList[index].id]; },
      getResponse: (q) => responses[q.id],
      grade(q) { return isCorrect(q, responses[q.id]); },
    };
  }

  // ---- Bookmarks (Section 44) ----
  async function toggleBookmark(targetType, targetId) {
    const user = auth.currentUser;
    if (!user) throw new Error("Please log in to bookmark.");
    const existing = await Store.list("bookmarks", { where: [["studentId", "==", user.uid], ["targetId", "==", targetId]] });
    if (existing.length) { await Store.remove("bookmarks", existing[0].id); return false; }
    await Store.create("bookmarks", { studentId: user.uid, targetType, targetId });
    return true;
  }

  // ---- Report a question (Section 45) ----
  async function reportQuestion(questionId, reason, note) {
    const user = auth.currentUser;
    if (!user) throw new Error("Please log in to report a question.");
    return Store.create("reports", { studentId: user.uid, questionId, reason, note, status: "open" });
  }

  /** Section 42: identify difficult questions from attempt analytics. */
  async function recomputeDifficultyFlags() {
    const attempts = await Store.list("examAttempts", { where: [["status", "!=", "in_progress"]] });
    const tally = {}; // questionId -> {correct, total}
    attempts.forEach((a) => {
      Object.entries(a.answers || {}).forEach(([qId]) => {
        tally[qId] = tally[qId] || { correct: 0, total: 0 };
        tally[qId].total++;
      });
    });
    const questions = await Store.list("questions");
    for (const q of questions) {
      const t = tally[q.id];
      if (t && t.total >= 10) {
        const correctRate = t.correct / t.total;
        if (correctRate < 0.4 && !q.flaggedDifficult) {
          await Store.update("questions", q.id, { flaggedDifficult: true });
        }
      }
    }
  }

  return {
    listBySubjectTopic, isCorrect, parseCsv, bulkImport,
    createStudySession, toggleBookmark, reportQuestion, recomputeDifficultyFlags,
  };
})();
