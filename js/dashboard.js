document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatPercent, formatDateTime, navigateTo, showToast } = window.CascadeApp;
  const topCards = document.querySelectorAll("section.grid.grid-cols-1.md\\:grid-cols-4 > div");
  const alertSection = document.querySelector("section.mb-8 h4");
  const alertText = document.querySelector("section.mb-8 p");
  const capacityContainer = document.querySelector("section.grid.grid-cols-1.lg\\:grid-cols-3 .space-y-6");
  const suggestionCard = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent.trim() === "Execute Logic"
  );
  const deployReliefButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent.trim() === "Deploy Relief"
  );
  const main = document.querySelector("main");
  let currentOverloadedHubId = null;

  function ensureMerchantScoreAdminSection() {
    let section = document.getElementById("merchant-score-admin-section");
    if (section || !main) return section;
    section = document.createElement("section");
    section.id = "merchant-score-admin-section";
    section.className = "mb-12";
    section.innerHTML = `
      <div class="glass-card p-8 rounded-3xl border border-primary/10">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
          <div>
            <h3 class="font-headline text-xl tracking-tight">Performance &amp; capacity monitoring</h3>
            <p class="text-sm text-on-surface-variant">Merchant score, tier classification, dispatch reliability, and optimization signals that explain network variability.</p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label class="text-[10px] uppercase tracking-widest text-on-surface-variant">Simulate tier
              <select id="mds-sim-tier" class="mt-1 block w-full rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-sm text-on-surface">
                <option value="priority">Priority</option>
                <option value="standard" selected>Standard</option>
                <option value="optimization">Optimization</option>
              </select>
            </label>
            <button type="button" id="mds-sim-run" class="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase tracking-widest text-on-primary">Simulate allocation</button>
          </div>
        </div>
        <div id="mds-admin-table" class="overflow-x-auto text-sm"></div>
        <div id="mds-sim-output" class="mt-6 rounded-2xl border border-white/5 bg-white/5 p-4 text-xs font-mono text-on-surface-variant hidden"></div>
      </div>
    `;
    const anchor = [...main.querySelectorAll("section")].find((s) =>
      s.querySelector("h3")?.textContent?.includes("Global Flux")
    );
    if (anchor) anchor.insertAdjacentElement("beforebegin", section);
    else main.appendChild(section);
    return section;
  }

  function renderMerchantScoreTable(rows) {
    const el = document.getElementById("mds-admin-table");
    if (!el) return;
    el.innerHTML = rows.length
      ? `
      <table class="w-full text-left font-mono text-xs">
        <thead>
          <tr class="border-b border-white/10 text-on-surface-variant">
            <th class="py-2 pr-4">Merchant ID</th>
            <th class="py-2 pr-4">Merchant score</th>
            <th class="py-2 pr-4">Tier classification</th>
            <th class="py-2 pr-4">Dispatch reliability</th>
            <th class="py-2">Optimization flags</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-on-surface">
          ${rows
            .map(
              (r) => `
            <tr>
              <td class="py-3 pr-4">${r.merchant_id}</td>
              <td class="py-3 pr-4">${r.merchant_score ?? r.current_score}</td>
              <td class="py-3 pr-4 uppercase">${r.tier_classification ?? r.score_tier}</td>
              <td class="py-3 pr-4">${Number(r.dispatch_reliability_percent ?? r.dispatch_success_rate).toFixed(1)}%</td>
              <td class="py-3">${(r.optimization_flags || []).join(", ") || "—"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `
      : `<p class="text-on-surface-variant">No merchant records.</p>`;
  }

  function renderSimSlots(slots) {
    const out = document.getElementById("mds-sim-output");
    if (!out) return;
    if (!slots?.length) {
      out.classList.add("hidden");
      return;
    }
    out.classList.remove("hidden");
    out.innerHTML = `
      <p class="mb-2 text-on-surface font-headline text-sm">Simulated slot board</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        ${slots
          .map(
            (s) => `
          <div class="rounded border border-white/10 p-2 ${s.status === "peak_locked" ? "border-error/40 text-error" : ""}">
            <div>${s.slot_time}</div>
            <div>${s.status}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  function ensureOperationsSection() {
    let section = document.getElementById("dashboard-operations-grid");
    if (section || !main) return section;

    section = document.createElement("section");
    section.id = "dashboard-operations-grid";
    section.className = "grid grid-cols-1 xl:grid-cols-2 gap-8 mb-16";
    section.innerHTML = `
      <div class="glass-card p-8 rounded-3xl">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-headline text-xl tracking-tight">Shipment Table</h3>
            <p class="text-sm text-on-surface-variant">Live network flow and rerouting activity.</p>
          </div>
          <button class="rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-widest text-primary">Shipment Tracking</button>
        </div>
        <div id="shipment-table-container" class="overflow-x-auto"></div>
      </div>
      <div class="glass-card p-8 rounded-3xl">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="font-headline text-xl tracking-tight">Alert Banner</h3>
            <p class="text-sm text-on-surface-variant">Automation notices for bottlenecks and delay risks.</p>
          </div>
          <button class="rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-widest text-primary">Alerts</button>
        </div>
        <div id="alert-feed-container" class="space-y-4"></div>
      </div>
    `;
    main.appendChild(section);

    const [shipmentsButton, alertsButton] = section.querySelectorAll("button");
    shipmentsButton?.addEventListener("click", () => navigateTo("/html/shipments.html"));
    alertsButton?.addEventListener("click", () => navigateTo("/html/alerts.html"));
    return section;
  }

  function renderShipmentTable(shipments) {
    const container = document.getElementById("shipment-table-container");
    if (!container) return;
    container.innerHTML = shipments.length
      ? `
        <table class="w-full text-left text-sm font-mono">
          <thead>
            <tr class="border-b border-white/10 text-on-surface-variant">
              <th class="pb-3">Shipment</th>
              <th class="pb-3">Current Hub</th>
              <th class="pb-3">Status</th>
              <th class="pb-3">ETA</th>
              <th class="pb-3">Route</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            ${shipments
              .slice(0, 6)
              .map(
                (shipment) => `
                  <tr>
                    <td class="py-4 text-on-surface">${shipment.shipment_id}</td>
                    <td class="py-4 text-on-surface-variant">${shipment.current_hub}</td>
                    <td class="py-4 ${shipment.status.includes("delay") ? "text-error" : shipment.status === "rerouted" ? "text-tertiary" : "text-secondary"}">${shipment.status}</td>
                    <td class="py-4 text-on-surface-variant">${formatDateTime(shipment.eta)}</td>
                    <td class="py-4 text-on-surface-variant">${shipment.route.join(" → ")}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      `
      : `<div class="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-on-surface-variant">No shipments available.</div>`;
  }

  function renderAlertFeed(alerts) {
    const container = document.getElementById("alert-feed-container");
    if (!container) return;
    container.innerHTML = alerts
      .slice(0, 5)
      .map(
        (alert) => `
          <div class="rounded-2xl border ${alert.severity === "high" ? "border-error/20 bg-error/10" : alert.severity === "medium" ? "border-tertiary/20 bg-tertiary/10" : "border-secondary/20 bg-secondary/10"} p-4">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-headline text-sm ${alert.severity === "high" ? "text-error" : alert.severity === "medium" ? "text-tertiary" : "text-secondary"}">${alert.message}</p>
                <p class="mt-1 text-xs uppercase tracking-widest text-on-surface-variant">${alert.type}</p>
              </div>
              <span class="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">${alert.severity}</span>
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderDashboardState({ hubs, hubStatus, shipments, kpi, alerts }) {
    if (topCards.length >= 4) {
      topCards[0].querySelector(".font-mono")?.replaceChildren(document.createTextNode(String(kpi.total_shipments)));
      topCards[1].querySelector(".font-mono")?.replaceChildren(
        document.createTextNode(String(hubStatus.summary.active_hubs))
      );
      topCards[2].querySelector(".font-mono")?.replaceChildren(
        document.createTextNode(String(hubStatus.summary.bottleneck_hubs))
      );
      topCards[3].querySelector(".font-mono")?.replaceChildren(
        document.createTextNode(`${hubStatus.summary.network_utilization}%`)
      );
    }

    const leadAlert = alerts[0];
    const overloadedHub = hubs.find((hub) => hub.status === "BOTTLENECK") || hubs[0];
    currentOverloadedHubId = overloadedHub?.id || null;

    if (alertSection && alertText) {
      alertSection.textContent = leadAlert ? leadAlert.message.toUpperCase() : "NETWORK STABLE";
      alertText.textContent = leadAlert
        ? `${leadAlert.message}. ${overloadedHub?.name || "Primary hub"} is running at ${formatPercent(
            overloadedHub?.hub_utilization_percent || 0
          )}.`
        : "All hubs are operating within acceptable utilization thresholds.";
    }

    if (capacityContainer) {
      capacityContainer.innerHTML = hubs
        .slice(0, 4)
        .map(
          (hub) => `
            <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div class="flex justify-between gap-4 text-xs font-mono ${hub.status === "BOTTLENECK" ? "text-error" : hub.status === "HIGH_LOAD" ? "text-tertiary" : "text-secondary"}">
                <span>${hub.name}</span>
                <span>${hub.status}</span>
              </div>
              <p class="mt-3 text-sm text-on-surface-variant">${hub.location}</p>
              <div class="mt-4 h-3 bg-white/5 rounded-full overflow-hidden p-[1px]">
                <div class="h-full rounded-full ${hub.status === "BOTTLENECK" ? "bg-gradient-to-r from-tertiary to-error" : hub.status === "HIGH_LOAD" ? "bg-gradient-to-r from-secondary to-tertiary" : "bg-secondary"}" style="width: ${hub.hub_utilization_percent}%"></div>
              </div>
              <div class="mt-4 flex items-center justify-between text-xs font-mono text-on-surface-variant">
                <span>${hub.current_load}/${hub.capacity}</span>
                <span>${formatPercent(hub.hub_utilization_percent)}</span>
              </div>
            </div>
          `
        )
        .join("");
    }

    renderShipmentTable(shipments);
    renderAlertFeed(alerts);
  }

  async function loadDashboardState() {
    const [{ hubs }, hubStatus, { shipments }, kpi, { alerts }] = await Promise.all([
      apiRequest("/hubs"),
      apiRequest("/hub-status"),
      apiRequest("/shipments"),
      apiRequest("/kpi"),
      apiRequest("/alerts")
    ]);

    return { hubs, hubStatus, shipments, kpi, alerts };
  }

  if (topCards.length >= 4) {
    topCards[0].querySelector(".font-mono")?.replaceChildren(document.createTextNode("--"));
    topCards[1].querySelector(".font-mono")?.replaceChildren(document.createTextNode("--"));
    topCards[2].querySelector(".font-mono")?.replaceChildren(document.createTextNode("--"));
    topCards[3].querySelector(".font-mono")?.replaceChildren(document.createTextNode("LIVE"));
  }

  if (alertSection) alertSection.textContent = "LIVE DATA PENDING";
  if (alertText) alertText.textContent = "Connect MongoDB to load real hub telemetry and predictive alerts.";
  if (capacityContainer) {
    capacityContainer.innerHTML = `
      <div class="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-on-surface-variant">
        No live hub capacity data yet.
      </div>
    `;
  }
  ensureOperationsSection();
  ensureMerchantScoreAdminSection();

  try {
    const state = await loadDashboardState();
    const { hubs } = state;

    try {
      const { merchants } = await apiRequest("/admin/merchant-scores");
      renderMerchantScoreTable(merchants || []);
    } catch {
      renderMerchantScoreTable([]);
    }

    document.getElementById("mds-sim-run")?.addEventListener("click", async () => {
      try {
        const tier = document.getElementById("mds-sim-tier")?.value || "standard";
        const hubId = hubs.find((h) => h.status === "BOTTLENECK")?.id || hubs[0]?.id;
        const sim = await apiRequest("/admin/simulate-merchant-capacity", {
          method: "POST",
          body: JSON.stringify({ tier, hub_id: hubId })
        });
        showToast(sim.message, "success");
        renderSimSlots(sim.slots);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    if (!hubs.length) {
      suggestionCard?.addEventListener("click", () => showToast("Connect MongoDB to enable crisis actions.", "info"));
      deployReliefButton?.addEventListener("click", () => navigateTo("/html/crisis-control.html"));
      return;
    }
    renderDashboardState(state);

    suggestionCard?.addEventListener("click", async () => {
      try {
        const result = await apiRequest("/trigger-crisis", {
          method: "POST",
          body: JSON.stringify({ hub_id: currentOverloadedHubId })
        });
        const refreshedState = await loadDashboardState();
        renderDashboardState(refreshedState);
        showToast(`Execute Logic complete. Rerouted ${result.rerouted_shipments} shipment units and refreshed hub capacity.`, "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    deployReliefButton?.addEventListener("click", async () => {
      try {
        const result = await apiRequest("/trigger-crisis", {
          method: "POST",
          body: JSON.stringify({ hub_id: currentOverloadedHubId })
        });
        const refreshedState = await loadDashboardState();
        renderDashboardState(refreshedState);
        showToast(`Relief deployed. ${result.rerouted_shipments} shipment units moved to lower-load hubs.`, "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  } catch (error) {
    showToast(error.message, "error");
  }
});
