/**
 * data-models.js
 * ---------------------------------------------------------------------------
 * Section 63: DATA MODEL. Plain JSDoc typedefs (no build step / no TS
 * compiler needed, but fully typed if you open this project in VS Code).
 *
 * Firestore collections (top-level, flat — Section 27 separates CONTENT
 * from APPLICATION DATA):
 *
 *   users, students, teachers                (application data)
 *   subjects, classes                        (application data — taxonomy)
 *   courses, modules, topics, lessons        (application data — structure;
 *                                              the actual video/pdf BYTES
 *                                              live in Google Drive, only
 *                                              the driveFileId is stored here)
 *   videos, textbooks                        (metadata only, Section 26)
 *   questions, exams, examAttempts, answers   (application data)
 *   enrollments, payments                     (application data)
 *   progress, certificates, notifications      (application data)
 *   bookmarks, reports, auditLogs              (application data)
 * ---------------------------------------------------------------------------
 */

/** @typedef {"super_admin"|"admin"|"teacher"|"student"} Role */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} fullName
 * @property {string} email
 * @property {string} [phone]
 * @property {Role} role
 * @property {boolean} emailVerified
 * @property {string} [classId]      // for students
 * @property {string} [school]
 * @property {string} [state]
 * @property {string} [country]
 * @property {string[]} [permissions] // for teachers — granular overrides
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @typedef {Object} Subject
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {boolean} active
 */

/** @typedef {Object} ClassYear
 * @property {string} id
 * @property {string} name          // e.g. "Year 10"
 * @property {number} order
 */

/**
 * @typedef {Object} Course
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} subjectId
 * @property {string} classId
 * @property {string} thumbnailUrl
 * @property {number} price               // 0 = free
 * @property {number} [discountPrice]
 * @property {string} duration
 * @property {"beginner"|"intermediate"|"advanced"} level
 * @property {string[]} objectives
 * @property {string[]} requirements
 * @property {string} instructorId
 * @property {"draft"|"published"} status
 * @property {string[]} [bundleCourseIds]  // present when this "course" is a bundle
 * @property {boolean} certificateEnabled
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @typedef {Object} Module
 * @property {string} id
 * @property {string} courseId
 * @property {string} title
 * @property {number} order
 */

/** @typedef {Object} Topic
 * @property {string} id
 * @property {string} moduleId
 * @property {string} title
 * @property {number} order
 */

/**
 * @typedef {Object} Lesson
 * @property {string} id
 * @property {string} topicId
 * @property {string} title
 * @property {"video"|"pdf"|"text"|"question_set"|"assignment"} contentType
 * @property {string} [driveFileId]   // Section 7/26 — never expose raw URL to client
 * @property {string} [textBody]
 * @property {number} order
 * @property {boolean} free           // free preview lesson even on paid course
 */

/**
 * @typedef {Object} Video
 * @property {string} id
 * @property {string} lessonId
 * @property {string} driveFileId
 * @property {number} durationSeconds
 * @property {"public"|"enrolled_only"} accessLevel
 */

/**
 * @typedef {Object} Textbook
 * @property {string} id
 * @property {string} title
 * @property {string} subjectId
 * @property {string} classId
 * @property {string} [courseId]
 * @property {string} driveFileId
 * @property {"free"|"premium"} access
 */

/** @typedef {"multiple_choice"|"true_false"|"fill_gap"|"short_answer"|"essay"} QuestionType */

/**
 * @typedef {Object} QuestionOption
 * @property {string} id
 * @property {string} text
 */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} subjectId
 * @property {string} classId
 * @property {string} [courseId]
 * @property {string} [topicId]
 * @property {string} [subtopic]
 * @property {"easy"|"medium"|"hard"} difficulty
 * @property {string} [examType]      // e.g. "WAEC", "NECO", "Mock"
 * @property {number} [year]
 * @property {QuestionType} type
 * @property {string} prompt
 * @property {QuestionOption[]} [options]
 * @property {string|string[]} correctAnswer
 * @property {string} explanation
 * @property {{step: string, detail: string}[]} [workedSteps]
 * @property {number} marks
 * @property {boolean} flaggedDifficult   // auto-set by analytics (Section 42)
 */

/**
 * @typedef {Object} Exam
 * @property {string} id
 * @property {string} title
 * @property {string} courseId
 * @property {string} subjectId
 * @property {string} classId
 * @property {string[]} [manualQuestionIds]
 * @property {{count:number, subjectId:string, topicId?:string, difficulty?:string}} [randomRule]
 * @property {number} durationMinutes
 * @property {number} passingScore
 * @property {boolean} randomizeQuestions
 * @property {boolean} randomizeOptions
 * @property {"unlimited"|"one"|number} attemptsAllowed
 * @property {boolean} showAnswersAfter
 * @property {boolean} showExplanationsAfter
 * @property {"draft"|"published"} status
 */

/**
 * @typedef {Object} ExamAttempt
 * @property {string} id
 * @property {string} examId
 * @property {string} studentId
 * @property {number} attemptNumber
 * @property {string} startedAt
 * @property {string} [submittedAt]
 * @property {Object.<string,string|string[]>} answers   // questionId -> answer
 * @property {number} [score]
 * @property {number} [percentage]
 * @property {string} [grade]
 * @property {"in_progress"|"submitted"|"auto_submitted"} status
 */

/**
 * @typedef {Object} Enrollment
 * @property {string} id
 * @property {string} studentId
 * @property {string} courseId
 * @property {string} source          // "purchase" | "free" | "admin_grant"
 * @property {string} enrolledAt
 */

/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} studentId
 * @property {string} courseId
 * @property {"paystack"|"flutterwave"} provider
 * @property {string} providerReference
 * @property {number} amount
 * @property {"pending"|"verified"|"failed"} status
 * @property {string} createdAt
 * @property {string} [verifiedAt]
 */

/**
 * @typedef {Object} Progress
 * @property {string} id
 * @property {string} studentId
 * @property {string} courseId
 * @property {Object.<string, {status:"not_started"|"in_progress"|"completed", videoPct?:number}>} lessonProgress
 * @property {string} [lastLessonId]  // for "Continue Learning" (Section 41)
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Certificate
 * @property {string} id
 * @property {string} studentId
 * @property {string} courseId
 * @property {string} certificateNumber
 * @property {string} issuedAt
 */

/** @typedef {Object} Notification
 * @property {string} id
 * @property {string} userId
 * @property {string} title
 * @property {string} body
 * @property {string} type
 * @property {boolean} read
 * @property {string} createdAt
 */

/** @typedef {Object} Bookmark
 * @property {string} id
 * @property {string} studentId
 * @property {"course"|"lesson"|"question"|"textbook_page"} targetType
 * @property {string} targetId
 */

/** @typedef {Object} Report
 * @property {string} id
 * @property {string} studentId
 * @property {string} questionId
 * @property {string} reason
 * @property {string} note
 * @property {"open"|"resolved"} status
 */

/** @typedef {Object} AuditLog
 * @property {string} id
 * @property {string} actorId
 * @property {string} action
 * @property {string} targetType
 * @property {string} targetId
 * @property {string} createdAt
 */
