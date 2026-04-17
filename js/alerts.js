document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, showToast } = window.CascadeApp;

  try {
    const { alerts } = await apiRequest("/alerts");
    const container = document.getElementById("alerts-list");
    if (!container) return;

    container.innerHTML = alerts
      .map(
        (alert) => `
          <div class="rounded-3xl border ${alert.severity === "high" ? "border-error/20 bg-error/10" : alert.severity === "medium" ? "border-tertiary/20 bg-tertiary/10" : "border-secondary/20 bg-secondary/10"} p-6">
            <div class="flex items-start justify-between gap-6">
              <div>
                <p class="font-headline text-lg ${alert.severity === "high" ? "text-error" : alert.severity === "medium" ? "text-tertiary" : "text-secondary"}">${alert.message}</p>
                <p class="mt-2 text-sm text-on-surface-variant">Type: ${alert.type}</p>
              </div>
              <span class="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">${alert.severity}</span>
            </div>
          </div>
        `
      )
      .join("");
  } catch (error) {
    showToast(error.message, "error");
  }
});
