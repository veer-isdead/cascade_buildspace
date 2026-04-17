document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatPercent, showToast } = window.CascadeApp;
  const main = document.querySelector("main .max-w-7xl");

  function ensureSimulationPrompt() {
    let prompt = document.getElementById("hub-simulation-prompt");
    if (prompt || !main) return prompt;
    prompt = document.createElement("section");
    prompt.id = "hub-simulation-prompt";
    prompt.className = "mb-8 rounded-2xl border border-primary/20 bg-primary/10 p-6";
    prompt.innerHTML = `
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-[10px] uppercase tracking-[0.3em] text-primary">Simulation Prompt</p>
          <h3 class="mt-2 font-headline text-xl font-bold text-on-surface">Trigger a realistic fake hub overload</h3>
          <p class="mt-2 text-sm text-on-surface-variant" data-sim-copy>
            Simulate cascading shipment pressure on the busiest hub. Trigger again to restore the original network state.
          </p>
        </div>
        <button class="rounded-xl bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-primary" data-sim-toggle>
          Trigger Crisis
        </button>
      </div>
    `;
    const header = main.querySelector("header");
    header?.insertAdjacentElement("afterend", prompt);
    return prompt;
  }

  async function refreshSimulationPrompt() {
    const prompt = ensureSimulationPrompt();
    if (!prompt) return;
    const copy = prompt.querySelector("[data-sim-copy]");
    const button = prompt.querySelector("[data-sim-toggle]");
    const hubStatus = await apiRequest("/hub-status");
    const active = hubStatus.summary.simulation_active;
    copy.textContent = active
      ? "Simulation is active. Press again to reverse the fake overload and restore the original hub conditions."
      : "Simulate cascading shipment pressure on the busiest hub. Trigger again to restore the original network state.";
    button.textContent = active ? "Restore Normal" : "Trigger Crisis";
    button.className = `rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] ${active ? "bg-error text-white" : "bg-primary text-on-primary"}`;
  }

  try {
    const [hubResponse, hubStatus, shipmentResponse, alertResponse] = await Promise.all([
      apiRequest("/hubs"),
      apiRequest("/hub-status"),
      apiRequest("/shipments"),
      apiRequest("/alerts")
    ]);

    const hubs = hubResponse.hubs;
    const shipments = shipmentResponse.shipments;
    const statCards = document.querySelectorAll(".grid.grid-cols-1.lg\\:grid-cols-4 > div");
    if (statCards.length >= 4) {
      statCards[0].querySelector(".text-3xl").textContent = String(hubStatus.summary.total_hubs);
      statCards[1].querySelector(".text-3xl").innerHTML = hubs.length ? `${hubStatus.summary.average_capacity_utilization}<span class="text-lg opacity-50">%</span>` : "--";
      statCards[2].querySelector(".text-3xl").textContent = hubs.length ? String(hubs.reduce((sum, hub) => sum + hub.throughput_per_hour, 0)) : "--";
      statCards[3].querySelector(".text-3xl").textContent = String(alertResponse.alerts.filter((alert) => alert.severity === "high").length);
    }

    const thead = document.querySelector("thead tr");
    if (thead) {
      thead.innerHTML = `
        <th class="px-8 py-6 font-headline text-xs uppercase tracking-widest text-on-surface-variant">Hub Name</th>
        <th class="px-8 py-6 font-headline text-xs uppercase tracking-widest text-on-surface-variant">Capacity</th>
        <th class="px-8 py-6 font-headline text-xs uppercase tracking-widest text-on-surface-variant">Current Load</th>
        <th class="px-8 py-6 font-headline text-xs uppercase tracking-widest text-on-surface-variant">Utilization</th>
        <th class="px-8 py-6 font-headline text-xs uppercase tracking-widest text-on-surface-variant">Time to Bottleneck</th>
        <th class="px-8 py-6 font-headline text-xs uppercase tracking-widest text-on-surface-variant">Status</th>
        <th class="px-8 py-6 font-headline text-xs uppercase tracking-widest text-on-surface-variant text-right">Shipments</th>
      `;
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
          const relatedShipments = shipments.filter((shipment) => shipment.current_hub === hub.id).length;
          const statusColor =
            hub.status === "BOTTLENECK" ? "bg-error/10 text-error border-error/20" : hub.status === "HIGH_LOAD" ? "bg-tertiary/10 text-tertiary border-tertiary/20" : "bg-secondary/10 text-secondary border-secondary/20";
          const barColor = hub.status === "BOTTLENECK" ? "bg-error" : hub.status === "HIGH_LOAD" ? "bg-tertiary" : "bg-secondary";

          return `
            <tr class="glass-row group">
              <td class="px-8 py-6">
                <div class="flex flex-col">
                  <span class="text-on-surface font-headline font-bold text-base tracking-tight">${hub.name}</span>
                  <span class="text-on-surface-variant text-xs font-mono">${hub.location}</span>
                </div>
              </td>
              <td class="px-8 py-6 text-on-surface">${hub.capacity}</td>
              <td class="px-8 py-6 text-on-surface">${hub.current_load}</td>
              <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                  <div class="flex-1 h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full ${barColor}" style="width: ${hub.hub_utilization_percent}%;"></div>
                  </div>
                  <span class="${hub.status === "BOTTLENECK" ? "text-error" : hub.status === "HIGH_LOAD" ? "text-tertiary" : "text-secondary"} font-bold">${formatPercent(hub.hub_utilization_percent)}</span>
                </div>
              </td>
              <td class="px-8 py-6 text-on-surface-variant font-mono">${hub.time_to_bottleneck_label || "--"}</td>
              <td class="px-8 py-6">
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${statusColor}">
                  <span class="h-1.5 w-1.5 rounded-full ${hub.status === "BOTTLENECK" ? "bg-error" : hub.status === "HIGH_LOAD" ? "bg-tertiary" : "bg-secondary"}"></span>
                  ${hub.status}
                </span>
              </td>
              <td class="px-8 py-6 text-right text-on-surface">${relatedShipments}</td>
            </tr>
          `;
        })
        .join("");
    }

    const reportButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent.trim() === "Full Report");
    reportButton?.addEventListener("click", () => {
      window.location.href = "/html/kpi-dashboard.html";
    });

    const prompt = ensureSimulationPrompt();
    const toggleButton = prompt?.querySelector("[data-sim-toggle]");
    toggleButton?.addEventListener("click", async () => {
      try {
        const targetHub = hubs.find((hub) => hub.status === "BOTTLENECK") || hubs[0];
        const result = await apiRequest("/toggle-crisis-simulation", {
          method: "POST",
          body: JSON.stringify({ hub_id: targetHub?.id || null, source: "hub-monitor" })
        });
        showToast(result.message, "success");
        window.location.reload();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
    await refreshSimulationPrompt();
  } catch (error) {
    showToast(error.message, "error");
  }
});
