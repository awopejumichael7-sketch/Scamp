/**
 * auth-ui.js
 * ---------------------------------------------------------------------------
 * Sections 22, 57: registration/login/forgot-password forms and the
 * student profile page, plus the topbar login/user-menu area.
 * ---------------------------------------------------------------------------
 */

const AuthUI = (() => {
  function renderLogin(view) {
    view.innerHTML = `
      <div class="card" style="max-width:400px;margin:40px auto;">
        <h1 class="page-title">Log in</h1>
        <form id="login-form">
          <div class="field"><label class="label">Email</label><input class="input" type="email" name="email" required /></div>
          <div class="field"><label class="label">Password</label><input class="input" type="password" name="password" required /></div>
          <button class="btn btn-primary" style="width:100%" type="submit">Log in</button>
        </form>
        <p style="text-align:center;margin-top:12px;font-size:13px;">
          <a href="#/forgot-password">Forgot password?</a> · <a href="#/register">Create account</a>
        </p>
        <div id="login-error" style="color:var(--danger);font-size:13px;margin-top:8px;"></div>
      </div>`;
    view.querySelector("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { email, password } = Object.fromEntries(new FormData(e.target).entries());
      try {
        const profile = await Auth.login(email, password);
        location.hash = profile.role === "admin" || profile.role === "super_admin" ? "#/admin" : "#/student";
      } catch (err) { view.querySelector("#login-error").textContent = "Invalid email or password."; }
    });
  }

  function renderRegister(view) {
    view.innerHTML = `
      <div class="card" style="max-width:440px;margin:40px auto;">
        <h1 class="page-title">Create your account</h1>
        <form id="register-form">
          <div class="field"><label class="label">Full name</label><input class="input" name="fullName" required /></div>
          <div class="field"><label class="label">Email</label><input class="input" type="email" name="email" required /></div>
          <div class="field"><label class="label">Phone number</label><input class="input" name="phone" /></div>
          <div class="field"><label class="label">Password</label><input class="input" type="password" name="password" required minlength="6" /></div>
          <div class="field"><label class="label">Class/Year</label><input class="input" name="classId" placeholder="e.g. Year 10" /></div>
          <div class="field"><label class="label">School (optional)</label><input class="input" name="school" /></div>
          <button class="btn btn-primary" style="width:100%" type="submit">Register</button>
        </form>
        <div id="register-error" style="color:var(--danger);font-size:13px;margin-top:8px;"></div>
      </div>`;
    view.querySelector("#register-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      try { await Auth.register(data); Toast.show("Account created — check your email to verify."); location.hash = "#/student"; }
      catch (err) { view.querySelector("#register-error").textContent = err.message; }
    });
  }

  function renderForgotPassword(view) {
    view.innerHTML = `
      <div class="card" style="max-width:400px;margin:40px auto;">
        <h1 class="page-title">Reset your password</h1>
        <form id="reset-form">
          <div class="field"><label class="label">Email</label><input class="input" type="email" name="email" required /></div>
          <button class="btn btn-primary" style="width:100%" type="submit">Send reset link</button>
        </form>
        <div id="reset-msg" style="margin-top:8px;font-size:13px;"></div>
      </div>`;
    view.querySelector("#reset-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { email } = Object.fromEntries(new FormData(e.target).entries());
      try { await Auth.sendPasswordReset(email); view.querySelector("#reset-msg").textContent = "Reset link sent — check your inbox."; }
      catch (err) { view.querySelector("#reset-msg").textContent = err.message; }
    });
  }

  async function renderProfile(view) {
    const profile = Auth.profile();
    const attempts = await Store.list("examAttempts", { where: [["studentId", "==", profile.id]] });
    const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / attempts.length) : 0;
    view.innerHTML = `
      <h1 class="page-title">My Profile</h1>
      <div class="card" style="max-width:480px;">
        <div class="field"><label class="label">Name</label>${profile.fullName}</div>
        <div class="field"><label class="label">Email</label>${profile.email}</div>
        <div class="field"><label class="label">Class</label>${profile.classId || "-"}</div>
        <button class="btn btn-outline" id="logout-btn">Log out</button>
      </div>
      <div class="grid grid-cols-3" style="margin-top:16px;">
        <div class="card stat-card"><span class="stat-value">${attempts.length}</span><span class="stat-label">Exams Completed</span></div>
        <div class="card stat-card"><span class="stat-value">${avg}%</span><span class="stat-label">Average Score</span></div>
      </div>`;
    view.querySelector("#logout-btn").addEventListener("click", async () => { await Auth.logout(); location.hash = "#/"; });
  }

  function renderTopbarAuthArea(profile) {
    const area = document.getElementById("auth-area");
    if (!profile) {
      area.innerHTML = `<a class="btn btn-outline btn-sm" href="#/login">Log in</a> <a class="btn btn-primary btn-sm" href="#/register">Register</a>`;
      return;
    }
    area.innerHTML = `<a class="btn btn-ghost btn-sm" href="#/${profile.role.includes("admin") ? "admin" : "student/profile"}">👤 ${profile.fullName.split(" ")[0]}</a>`;
  }

  document.addEventListener("sc:auth-changed", (e) => renderTopbarAuthArea(e.detail.profile));

  return { renderLogin, renderRegister, renderForgotPassword, renderProfile, renderTopbarAuthArea };
})();
