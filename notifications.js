/**
 * notifications.js
 * ---------------------------------------------------------------------------
 * Section 29: in-app notifications now; architected so a Cloud Function
 * trigger (onCreate of a `notifications` doc) can fan out to email
 * (e.g. free-tier Resend/SendGrid), Telegram (bot API, free), and Web Push
 * (free, via the service worker already required for the PWA — Section 31)
 * without any change to this file.
 * ---------------------------------------------------------------------------
 */

const Notifications = (() => {
  const TYPES = ["new_course", "new_lesson", "exam_available", "exam_result", "payment_confirmation", "course_purchase", "announcement"];

  async function send(userId, type, title, body) {
    return Store.create("notifications", { userId, type, title, body, read: false });
  }

  async function listForUser(userId) {
    return Store.list("notifications", { where: [["userId", "==", userId]], orderByField: "createdAt" });
  }

  function subscribe(userId, cb) {
    return Store.onSnapshot("notifications", cb, { where: [["userId", "==", userId], ["read", "==", false]] });
  }

  async function markRead(notificationId) {
    return Store.update("notifications", notificationId, { read: true });
  }

  return { TYPES, send, listForUser, subscribe, markRead };
})();
