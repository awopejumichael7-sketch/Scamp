/**
 * app.js
 * ---------------------------------------------------------------------------
 * Sections 31, 32, 33: PWA bootstrap, light/dark theme toggle, initial
 * routing. This is the single entry point loaded last by index.html.
 * ---------------------------------------------------------------------------
 */

(function bootstrap() {
  // ---- Theme (Section 33: light/dark mode) ----
  const THEME_KEY = "sc_theme";
  const saved = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });

  // ---- Mobile sidebar toggle ----
  document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("hidden");
  });

  // ---- Global search (Section 28) — simple client-side fan-out search ----
  document.getElementById("global-search").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const term = e.target.value.trim().toLowerCase();
    if (!term) return;
    const [courses, topics, textbooks] = await Promise.all(["courses", "topics", "textbooks"].map((c) => Store.list(c)));
    const results = [
      ...courses.filter((c) => c.title?.toLowerCase().includes(term)).map((c) => ({ type: "Course", label: c.title, href: `#/courses/${c.id}` })),
      ...topics.filter((t) => t.title?.toLowerCase().includes(term)).map((t) => ({ type: "Topic", label: t.title, href: "#/courses" })),
      ...textbooks.filter((t) => t.title?.toLowerCase().includes(term)).map((t) => ({ type: "Textbook", label: t.title, href: "#/student/textbooks" })),
    ];
    Toast.show(results.length ? `${results.length} result(s) — first: ${results[0].label}` : "No results found.");
    if (results.length) location.hash = results[0].href;
  });

  // ---- Notification bell (Section 29) ----
  document.addEventListener("sc:auth-changed", (e) => {
    const profile = e.detail.profile;
    const bell = document.getElementById("notif-count");
    if (!profile) { bell.classList.add("hidden"); return; }
    Notifications.subscribe(profile.id, (list) => {
      bell.textContent = list.length;
      bell.classList.toggle("hidden", list.length === 0);
    });
  });

  // ---- Service worker registration (Section 31: PWA) ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed:", err));
    });
  }

  // ---- Initial route ----
  Router.route();
})();
