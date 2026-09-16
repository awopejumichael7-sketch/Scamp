/**
 * courses.js
 * ---------------------------------------------------------------------------
 * Sections 4, 5, 6, 23, 39, 40, 41, 55, 62: Course hierarchy
 * (Class → Subject → Course → Module → Topic → Lesson), course page,
 * access control (free vs. paid vs. purchased), progress %, resume learning.
 * ---------------------------------------------------------------------------
 */

const Courses = (() => {
  async function listPublished(filters = {}) {
    const where = [["status", "==", "published"]];
    if (filters.subjectId) where.push(["subjectId", "==", filters.subjectId]);
    if (filters.classId) where.push(["classId", "==", filters.classId]);
    return Store.list("courses", { where });
  }

  async function getFullStructure(courseId) {
    const [course, modules] = await Promise.all([
      Store.get("courses", courseId),
      Store.list("modules", { where: [["courseId", "==", courseId]], orderByField: "order" }),
    ]);
    const structure = await Promise.all(modules.map(async (m) => {
      const topics = await Store.list("topics", { where: [["moduleId", "==", m.id]], orderByField: "order" });
      const topicsWithLessons = await Promise.all(topics.map(async (t) => ({
        ...t,
        lessons: await Store.list("lessons", { where: [["topicId", "==", t.id]], orderByField: "order" }),
      })));
      return { ...m, topics: topicsWithLessons };
    }));
    return { ...course, modules: structure };
  }

  /** Section 62: canonical access-control decision — always re-checked
   * server-side too (Firestore rules + Cloud Functions), this is only for UI. */
  async function canAccessCourse(course, userProfile) {
    if (!userProfile) return course.price === 0 ? "login_required" : "locked";
    if (userProfile.role === "admin" || userProfile.role === "super_admin") return "granted";
    if (userProfile.role === "teacher") return "granted"; // scoped further by assigned courses
    if (course.price === 0) return "granted";
    const enrollment = await Store.list("enrollments", {
      where: [["studentId", "==", userProfile.id], ["courseId", "==", course.id]],
    });
    return enrollment.length ? "granted" : "locked";
  }

  function canAccessLesson(lesson, courseAccess) {
    return lesson.free || courseAccess === "granted";
  }

  /** Section 40: compute overall course progress %. */
  async function computeProgress(studentId, course) {
    const [progressDoc, allLessons] = await Promise.all([
      Store.get("progress", studentId),
      (async () => {
        const modules = await Store.list("modules", { where: [["courseId", "==", course.id]] });
        const topics = (await Promise.all(modules.map((m) => Store.list("topics", { where: [["moduleId", "==", m.id]] })))).flat();
        return (await Promise.all(topics.map((t) => Store.list("lessons", { where: [["topicId", "==", t.id]] })))).flat();
      })(),
    ]);
    const lessonProgress = progressDoc?.lessonProgress || {};
    const completed = allLessons.filter((l) => lessonProgress[l.id]?.status === "completed").length;
    const total = allLessons.length || 1;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }

  /** Section 41: "Continue Learning" — resolve last lesson + its course/module/topic. */
  async function getContinueLearning(studentId) {
    const progressDoc = await Store.get("progress", studentId);
    if (!progressDoc?.lastLessonId) return null;
    const lesson = await Store.get("lessons", progressDoc.lastLessonId);
    if (!lesson) return null;
    const topic = await Store.get("topics", lesson.topicId);
    const module = await Store.get("modules", topic.moduleId);
    const course = await Store.get("courses", module.courseId);
    return { course, module, topic, lesson };
  }

  /** Section 23: enroll after payment verification succeeds (called by the
   * Cloud Function server-side too — this client copy is for free courses only). */
  async function enrollFree(course, studentId) {
    if (course.price !== 0) throw new Error("Only free courses can be self-enrolled from the client.");
    return Store.create("enrollments", { studentId, courseId: course.id, source: "free" });
  }

  return { listPublished, getFullStructure, canAccessCourse, canAccessLesson, computeProgress, getContinueLearning, enrollFree };
})();
