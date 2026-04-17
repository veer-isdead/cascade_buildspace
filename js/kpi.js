document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatPercent, showToast } = window.CascadeApp;

  try {
    const [kpi, alertResponse] = await Promise.all([
      apiRequest("/kpi"),
      apiRequest("/alerts")
    ]);

    const cards = document.querySelectorAll(".grid.grid-cols-1.md\\:grid-cols-3.lg\\:grid-cols-4 > div");

    if (cards.length >= 3) {
      cards[0].querySelector(".text-6xl")?.replaceChildren(document.createTextNode(String(kpi.average_processing_time || "--")));
      cards[1].querySelector(".text-4xl")?.replaceChildren(document.createTextNode(String(kpi.total_shipments || "--")));
      cards[2].querySelector(".text-4xl")?.replaceChildren(
        document.createTextNode(String((100 - (kpi.delay_rate || 0) * 100).toFixed(2)))
      );
    }

    const headerMetrics = document.querySelectorAll("header .text-2xl.mono-metrics");
    if (headerMetrics.length >= 2) {
      headerMetrics[0].textContent = `${(kpi.hub_utilization * 100).toFixed(1)}%`;
      headerMetrics[1].textContent = `${kpi.throughput}/hr`;
    }

    const targetSection = document.querySelector("main");
    let breakdown = document.getElementById("kpi-breakdown-grid");
    if (!breakdown && targetSection) {
      breakdown = document.createElement("section");
      breakdown.id = "kpi-breakdown-grid";
      breakdown.className = "grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8";
      breakdown.innerHTML = `
        <div class="glass-panel rounded-full p-8">
          <div class="flex items-center justify-between mb-8">
            <div>
              <h2 class="text-2xl font-headline font-bold">Hub Utilization</h2>
              <p class="text-sm text-on-surface-variant">Bottleneck visibility by hub.</p>
            </div>
          </div>
          <div id="hub-utilization-bars" class="space-y-5"></div>
        </div>
        <div class="glass-panel rounded-full p-8">
          <div class="flex items-center justify-between mb-8">
            <div>
              <h2 class="text-2xl font-headline font-bold">Network Alerts</h2>
              <p class="text-sm text-on-surface-variant">Delay risk and congestion feed.</p>
            </div>
          </div>
          <div id="kpi-alert-feed" class="space-y-4"></div>
        </div>
      `;
      targetSection.appendChild(breakdown);
    }

    const utilizationBars = document.getElementById("hub-utilization-bars");
    if (utilizationBars) {
      utilizationBars.innerHTML = kpi.hub_breakdown
        .map(
          (hub) => `
            <div>
              <div class="mb-2 flex items-center justify-between text-xs font-mono">
                <span>${hub.name}</span>
                <span>${formatPercent(hub.utilization * 100)}</span>
              </div>
              <div class="h-3 overflow-hidden rounded-full bg-white/5 p-[1px]">
                <div class="h-full rounded-full ${hub.utilization > 0.85 ? "bg-gradient-to-r from-tertiary to-error" : hub.utilization > 0.7 ? "bg-gradient-to-r from-secondary to-tertiary" : "bg-secondary"}" style="width:${hub.utilization * 100}%"></div>
              </div>
              <div class="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>${hub.throughput}/hr throughput</span>
                <span>${hub.avg_processing_time} min avg processing</span>
              </div>
            </div>
          `
        )
        .join("");
    }

    const alertFeed = document.getElementById("kpi-alert-feed");
    if (alertFeed) {
      alertFeed.innerHTML = alertResponse.alerts
        .map(
          (alert) => `
            <div class="rounded-3xl border ${alert.severity === "high" ? "border-error/20 bg-error/10" : alert.severity === "medium" ? "border-tertiary/20 bg-tertiary/10" : "border-secondary/20 bg-secondary/10"} p-5">
              <p class="font-headline text-sm ${alert.severity === "high" ? "text-error" : alert.severity === "medium" ? "text-tertiary" : "text-secondary"}">${alert.message}</p>
              <p class="mt-1 text-xs uppercase tracking-widest text-on-surface-variant">${alert.type} • ${alert.severity}</p>
            </div>
          `
        )
        .join("");
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});
