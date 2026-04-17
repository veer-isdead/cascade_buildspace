document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatPercent, showToast } = window.CascadeApp;

  try {
    const [hubResponse, hubStatus, truckResponse] = await Promise.all([
      apiRequest("/hubs"),
      apiRequest("/hub-status"),
      apiRequest("/trucks")
    ]);

    const hubs = hubResponse.hubs;
    const statCards = document.querySelectorAll(".grid.grid-cols-1.lg\\:grid-cols-4 > div");
    if (statCards.length >= 4) {
      statCards[0].querySelector(".text-3xl").textContent = String(hubStatus.summary.total_hubs);
      statCards[1].querySelector(".text-3xl").innerHTML = hubs.length ? `${hubStatus.summary.average_capacity_utilization}<span class="text-lg opacity-50">%</span>` : "--";
      statCards[2].querySelector(".text-3xl").textContent = hubs.length ? `${hubs.reduce((sum, hub) => sum + hub.shipment_rate, 0)}k` : "--";
      statCards[3].querySelector(".text-3xl").textContent = String(hubStatus.summary.overload_hubs + hubStatus.summary.at_risk_hubs);
    }

    const tbody = document.querySelector("tbody");
    if (tbody) {
      if (!hubs.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="px-8 py-10 text-center text-sm text-on-surface-variant">
              No live hub telemetry yet. Connect MongoDB to populate the monitor.
            </td>
          </tr>
        `;
        return;
      }
      tbody.innerHTML = hubs
        .map((hub) => {
          const relatedTrucks = truckResponse.trucks.filter((truck) => truck.assigned_hub === hub.id).length;
          const statusColor =
            hub.status === "OVERLOAD" ? "bg-error/10 text-error border-error/20" : hub.status === "AT_RISK" ? "bg-tertiary/10 text-tertiary border-tertiary/20" : "bg-secondary/10 text-secondary border-secondary/20";
          const barColor = hub.status === "OVERLOAD" ? "bg-error" : hub.status === "AT_RISK" ? "bg-tertiary" : "bg-secondary";

          return `
            <tr class="glass-row group">
              <td class="px-8 py-6">
                <div class="flex flex-col">
                  <span class="text-on-surface font-headline font-bold text-base tracking-tight">${hub.name}</span>
                  <span class="text-on-surface-variant text-xs font-mono">${hub.region}</span>
                </div>
              </td>
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="flex-1 h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full ${barColor}" style="width: ${hub.hub_capacity_percent}%;"></div>
                  </div>
                  <span class="${hub.status === "OVERLOAD" ? "text-error" : hub.status === "AT_RISK" ? "text-tertiary" : "text-secondary"} font-bold">${formatPercent(hub.hub_capacity_percent)}</span>
                </div>
              </td>
              <td class="px-8 py-6 text-xs font-mono">${hub.shipment_rate}/hr</td>
              <td class="px-8 py-6 text-center text-on-surface">${relatedTrucks}</td>
              <td class="px-8 py-6">
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${statusColor}">
                  <span class="h-1.5 w-1.5 rounded-full ${hub.status === "OVERLOAD" ? "bg-error" : hub.status === "AT_RISK" ? "bg-tertiary" : "bg-secondary"}"></span>
                  ${hub.status}
                </span>
              </td>
              <td class="px-8 py-6 text-right">
                <button class="hub-reroute p-2 rounded-lg hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors" data-hub="${hub.id}">
                  <span class="material-symbols-outlined">alt_route</span>
                </button>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    document.querySelectorAll(".hub-reroute").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const truck = truckResponse.trucks.find((item) => item.assigned_hub === button.dataset.hub);
          if (!truck) {
            showToast("No truck available at this hub for rerouting.", "info");
            return;
          }
          const result = await apiRequest("/reroute-truck", {
            method: "POST",
            body: JSON.stringify({ truck_id: truck.truck_id })
          });
          showToast(`${result.truck.truck_id} rerouted to ${result.truck.assigned_hub}.`, "success");
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });

    const reportButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent.trim() === "Full Report");
    reportButton?.addEventListener("click", () => {
      window.location.href = "/html/kpi-dashboard.html";
    });
  } catch (error) {
    showToast(error.message, "error");
  }
});
