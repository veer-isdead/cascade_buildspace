document.addEventListener("DOMContentLoaded", () => {
  const { apiRequest, navigateTo, setButtonLoading, setSession, showToast } = window.CascadeApp;
  const pathname = window.location.pathname.toLowerCase();
  const form = document.querySelector("form");
  const submitButton = form?.querySelector('button[type="submit"]');

  function injectSwitchPrompt(mode) {
    if (!form || document.getElementById("auth-switch-link") || document.querySelector("[data-auth-switch]")) return;
    const prompt = document.createElement("p");
    prompt.id = "auth-switch-link";
    prompt.setAttribute("data-auth-switch", "true");
    prompt.className = "text-center text-sm text-on-surface-variant mt-4";
    prompt.innerHTML =
      mode === "signup"
        ? `Already have an account? <a href="/html/login.html" class="text-secondary hover:underline">Login</a>`
        : `Don't have an account? <a href="/html/signup.html" class="text-primary hover:underline">Create one</a>`;
    submitButton.insertAdjacentElement("afterend", prompt);
  }

  if (!form || !submitButton) return;

  if (pathname.endsWith("signup.html")) {
    injectSwitchPrompt("signup");
    const nameInput = form.querySelector('input[type="text"]');
    const emailInput = form.querySelector('input[type="email"]');
    const passwordInput = form.querySelector('input[type="password"]');
    const revealButton = form.querySelector('button[type="button"]');

    revealButton?.addEventListener("click", () => {
      passwordInput.type = passwordInput.type === "password" ? "text" : "password";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setButtonLoading(submitButton, true, "Creating...");
      try {
        await apiRequest("/signup", {
          method: "POST",
          body: JSON.stringify({
            name: nameInput.value,
            email: emailInput.value,
            password: passwordInput.value,
            role: "operator"
          })
        });
        showToast("Account created. You can log in now.", "success");
        window.setTimeout(() => navigateTo("login.html"), 700);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setButtonLoading(submitButton, false);
      }
    });
  }

  if (pathname.endsWith("login.html")) {
    injectSwitchPrompt("login");
    const emailInput = form.querySelector('input[type="email"]');
    const passwordInput = form.querySelector('input[type="password"]');

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setButtonLoading(submitButton, true, "Connecting...");
      try {
        const payload = await apiRequest("/login", {
          method: "POST",
          body: JSON.stringify({
            email: emailInput.value,
            password: passwordInput.value
          })
        });
        setSession(payload);
        showToast(`Welcome back, ${payload.user.name}.`, "success");
        window.setTimeout(() => navigateTo("dashboard.html"), 700);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setButtonLoading(submitButton, false);
      }
    });
  }
});
