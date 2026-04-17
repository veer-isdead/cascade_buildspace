(function () {
  const API_BASE_URL = window.localStorage.getItem("cascadeApiBaseUrl") || window.location.origin;
  const ROUTES = {
    cascade: "/",
    home: "/",
    infrastructure: "/",
    protocol: "/",
    enrollment: "/html/signup.html",
    dash: "/html/dashboard.html",
    dashboard: "/html/dashboard.html",
    hub: "/html/hub-monitor.html",
    "hub monitor": "/html/hub-monitor.html",
    desk: "/html/merchant.html",
    "merchant desk": "/html/merchant.html",
    crisis: "/html/crisis-control.html",
    "crisis control": "/html/crisis-control.html",
    kpi: "/html/kpi-dashboard.html",
    "kpi metrics": "/html/kpi-dashboard.html",
    "kpi dashboard": "/html/kpi-dashboard.html",
    login: "/html/login.html",
    signup: "/html/signup.html",
    "create account": "/html/signup.html",
    "access terminal": "/html/login.html",
    "view dashboard": "/html/dashboard.html",
    "simulate crisis": "/html/crisis-control.html",
    "schedule live demo": "/html/signup.html",
    "request technical specs": "/html/login.html",
    "full report": "/html/kpi-dashboard.html",
    "view map": "/html/hub-monitor.html"
  };

  function normalizeLabel(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || "Request failed.");
    }
    return data;
  }

  function setSession(session) {
    window.localStorage.setItem("cascadeSession", JSON.stringify(session));
  }

  function getSession() {
    const raw = window.localStorage.getItem("cascadeSession");
    return raw ? JSON.parse(raw) : null;
  }

  function clearSession() {
    window.localStorage.removeItem("cascadeSession");
  }

  function ensureToastRoot() {
    let root = document.getElementById("cascade-toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "cascade-toast-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function showToast(message, variant = "info") {
    const root = ensureToastRoot();
    const toast = document.createElement("div");
    toast.className = `cascade-toast ${variant}`;
    toast.textContent = message;
    root.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function setButtonLoading(button, loading, label) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = label || "Working...";
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }

  function navigateTo(page) {
    window.location.href = page;
  }

  function resolveRouteFromText(text) {
    const normalized = normalizeLabel(text);
    if (ROUTES[normalized]) return ROUTES[normalized];

    if (normalized.includes("dashboard")) return ROUTES.dashboard;
    if (normalized.includes("hub")) return ROUTES["hub monitor"];
    if (normalized.includes("merchant")) return ROUTES["merchant desk"];
    if (normalized.includes("crisis")) return ROUTES["crisis control"];
    if (normalized.includes("kpi")) return ROUTES["kpi dashboard"];
    if (normalized.includes("login") || normalized.includes("access terminal")) return ROUTES.login;
    if (normalized.includes("sign up") || normalized.includes("signup") || normalized.includes("create account")) return ROUTES.signup;
    if (normalized === "cascade") return ROUTES.cascade;
    return null;
  }

  function bindRoute(element, route) {
    if (!element || !route) return;
    if (element.dataset.boundNavigation === "true") return;
    element.dataset.boundNavigation = "true";
    element.style.cursor = "pointer";

    if (element.tagName === "A") {
      element.setAttribute("href", route);
      return;
    }

    element.addEventListener("click", () => navigateTo(route));
  }

  function wireNavigation() {
    const elements = document.querySelectorAll("a, button, span");
    elements.forEach((element) => {
      const route = resolveRouteFromText(element.textContent);
      if (!route) return;
      bindRoute(element, route);
    });

    const groupedNavItems = document.querySelectorAll(
      "header nav a, aside nav a, aside nav div, nav button, nav div, .fixed.bottom-0 button, .fixed.bottom-0 div"
    );
    groupedNavItems.forEach((element) => {
      const route = resolveRouteFromText(element.textContent);
      if (!route) return;
      bindRoute(element, route);
    });

    const brandLinks = document.querySelectorAll(
      "header .text-2xl.font-headline, header .text-2xl.font-bold, aside .text-xl.font-headline, aside .text-xl.font-bold"
    );
    brandLinks.forEach((element) => bindRoute(element, ROUTES.cascade));
  }

  function initProfileMenu() {
    const avatar = Array.from(document.querySelectorAll("header div, header button")).find((element) => {
      if (!element.querySelector("img")) return false;
      const className = element.className || "";
      return className.includes("rounded-full") || className.includes("rounded");
    });

    if (!avatar || avatar.dataset.profileBound === "true") return;
    avatar.dataset.profileBound = "true";
    avatar.style.cursor = "pointer";

    const session = getSession();
    const menu = document.createElement("div");
    menu.className =
      "hidden absolute right-8 top-16 z-[120] min-w-48 rounded-xl border border-white/10 bg-[#0f1930]/95 p-2 text-sm text-on-surface shadow-2xl backdrop-blur-xl";
    menu.innerHTML = session
      ? `
        <div class="px-3 py-2 text-xs text-on-surface-variant">${session.user?.name || "Operator"}</div>
        <button data-profile-action="dashboard" class="profile-menu-btn w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">Open Dashboard</button>
        <button data-profile-action="logout" class="profile-menu-btn w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">Logout</button>
      `
      : `
        <button data-profile-action="login" class="profile-menu-btn w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">Login</button>
        <button data-profile-action="signup" class="profile-menu-btn w-full rounded-lg px-3 py-2 text-left hover:bg-white/5">Sign Up</button>
      `;

    document.body.appendChild(menu);

    avatar.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.classList.toggle("hidden");
    });

    menu.addEventListener("click", (event) => {
      const target = event.target.closest("[data-profile-action]");
      if (!target) return;
      const action = target.dataset.profileAction;
      menu.classList.add("hidden");

      if (action === "logout") {
        clearSession();
        showToast("Logged out.", "success");
        navigateTo(ROUTES.login);
        return;
      }

      if (action === "dashboard") {
        navigateTo(ROUTES.dashboard);
        return;
      }

      if (action === "signup") {
        navigateTo(ROUTES.signup);
        return;
      }

      navigateTo(ROUTES.login);
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !avatar.contains(event.target)) {
        menu.classList.add("hidden");
      }
    });
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", theme !== "light");
    root.classList.toggle("theme-light", theme === "light");
    window.localStorage.setItem("cascadeTheme", theme);

    document.querySelectorAll(".material-symbols-outlined").forEach((icon) => {
      if (icon.textContent.trim() === "light_mode" || icon.textContent.trim() === "dark_mode") {
        icon.textContent = theme === "light" ? "dark_mode" : "light_mode";
      }
    });
  }

  function initThemeToggle() {
    const savedTheme = window.localStorage.getItem("cascadeTheme") || "dark";
    applyTheme(savedTheme);

    document.querySelectorAll("button").forEach((button) => {
      const text = normalizeLabel(button.textContent);
      if (text !== "light_mode" && text !== "dark_mode") return;
      button.addEventListener("click", () => {
        const nextTheme = document.documentElement.classList.contains("theme-light") ? "dark" : "light";
        applyTheme(nextTheme);
      });
    });
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  function formatPercent(value) {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  function createEmptyCard(message) {
    return `
      <div class="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-on-surface-variant">
        ${message}
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireNavigation();
    initThemeToggle();
    initProfileMenu();
  });

  window.CascadeApp = {
    API_BASE_URL,
    apiRequest,
    setSession,
    getSession,
    clearSession,
    showToast,
    setButtonLoading,
    navigateTo,
    formatCurrency,
    formatPercent,
    createEmptyCard
  };
})();
