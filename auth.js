/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Sections 21, 22, 34, 62: Registration, login, logout, password reset,
 * session management, and role-based access control.
 *
 * CRITICAL: role is never trusted from the client. On registration we write
 * role="student" to Firestore under the user's own uid, but Firestore
 * Security Rules must forbid a client from ever setting role to "admin" or
 * "teacher" on itself (see DEPLOYMENT.md → firestore.rules). Promoting a
 * user to admin/teacher must be done by an existing admin via a Cloud
 * Function (functions-index.js → setUserRole) that checks the caller's own
 * custom claim first. The frontend only ever *reads* the role and hides UI
 * accordingly (Section 21: "hidden in the frontend" is not enough).
 * ---------------------------------------------------------------------------
 */

const Auth = (() => {
  let currentUserProfile = null; // cached /users/{uid} document incl. role

  async function register({ fullName, email, phone, password, classId, school, state, country }) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: fullName });
    await cred.user.sendEmailVerification();

    const profile = {
      id: cred.user.uid,
      fullName, email, phone, classId, school, state, country,
      role: "student",              // server-enforced default, see note above
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.collection("users").doc(cred.user.uid).set(profile);
    await db.collection("students").doc(cred.user.uid).set({ id: cred.user.uid, classId });
    return profile;
  }

  async function login(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return loadProfile(cred.user.uid);
  }

  async function logout() {
    await auth.signOut();
    currentUserProfile = null;
  }

  async function sendPasswordReset(email) {
    await auth.sendPasswordResetEmail(email);
  }

  async function changePassword(newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    await user.updatePassword(newPassword);
  }

  async function loadProfile(uid) {
    const snap = await db.collection("users").doc(uid).get();
    currentUserProfile = snap.exists ? snap.data() : null;
    return currentUserProfile;
  }

  function profile() { return currentUserProfile; }
  function role() { return currentUserProfile ? currentUserProfile.role : null; }
  function isAuthenticated() { return !!auth.currentUser; }

  function hasPermission(permission) {
    const p = profile();
    if (!p) return false;
    if (p.role === "super_admin" || p.role === "admin") return true;
    if (p.role === "teacher") return (p.permissions || []).includes(permission);
    return false;
  }

  // Session lifecycle — Firebase Auth persists the session in IndexedDB by
  // default across app restarts/devices' local storage (Section 22).
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await loadProfile(user.uid);
      document.dispatchEvent(new CustomEvent("sc:auth-changed", { detail: { profile: currentUserProfile } }));
    } else {
      currentUserProfile = null;
      document.dispatchEvent(new CustomEvent("sc:auth-changed", { detail: { profile: null } }));
    }
  });

  return {
    register, login, logout, sendPasswordReset, changePassword,
    profile, role, isAuthenticated, hasPermission, loadProfile,
  };
})();
