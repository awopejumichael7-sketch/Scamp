/**
 * store.js
 * ---------------------------------------------------------------------------
 * Thin Firestore data-access layer. Every function here is a generic
 * CRUD wrapper (Section 19: Admin CRUD for every entity) plus a couple of
 * query helpers. Nothing here does authorization — Firestore Security
 * Rules do that server-side (Section 34, 62); this file only assumes the
 * caller is already signed in with the right role, and Firestore will
 * reject the write/read if the rules disagree, no matter what the UI shows.
 * ---------------------------------------------------------------------------
 */

const Store = (() => {
  const col = (name) => db.collection(name);

  const nowISO = () => new Date().toISOString();

  async function create(collection, data) {
    const ref = col(collection).doc();
    const payload = { ...data, id: ref.id, createdAt: nowISO(), updatedAt: nowISO() };
    await ref.set(payload);
    await AuditLog.record(`${collection}.create`, collection, ref.id);
    return payload;
  }

  async function update(collection, id, patch) {
    await col(collection).doc(id).set({ ...patch, updatedAt: nowISO() }, { merge: true });
    await AuditLog.record(`${collection}.update`, collection, id);
  }

  async function remove(collection, id) {
    await col(collection).doc(id).delete();
    await AuditLog.record(`${collection}.delete`, collection, id);
  }

  async function get(collection, id) {
    const snap = await col(collection).doc(id).get();
    return snap.exists ? snap.data() : null;
  }

  async function list(collection, { where = [], orderByField, limit } = {}) {
    let q = col(collection);
    where.forEach(([field, op, value]) => { q = q.where(field, op, value); });
    if (orderByField) q = q.orderBy(orderByField);
    if (limit) q = q.limit(limit);
    const snap = await q.get();
    return snap.docs.map((d) => d.data());
  }

  function onSnapshot(collection, cb, { where = [] } = {}) {
    let q = col(collection);
    where.forEach(([field, op, value]) => { q = q.where(field, op, value); });
    return q.onSnapshot((snap) => cb(snap.docs.map((d) => d.data())));
  }

  return { create, update, remove, get, list, onSnapshot };
})();

/** Section 46: Admin Audit Log — every important admin/teacher action. */
const AuditLog = (() => {
  async function record(action, targetType, targetId) {
    const user = auth.currentUser;
    try {
      await db.collection("auditLogs").add({
        actorId: user ? user.uid : "system",
        action,
        targetType,
        targetId,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      // Never let audit logging break the primary action.
      console.warn("Audit log failed:", e.message);
    }
  }
  return { record };
})();
