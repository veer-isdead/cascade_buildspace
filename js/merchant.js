document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatCurrency, getSession, showToast } = window.CascadeApp;
  const main = document.querySelector("main");
  const regionSelect = document.querySelector("select");
  const slotGrid = document.querySelector(".grid.grid-cols-2.sm\\:grid-cols-3.md\\:grid-cols-4.xl\\:grid-cols-6");
  const merchantCards = document.querySelectorAll(".glass-panel.px-6.py-3.rounded-xl");
  const mdsRoot = document.getElementById("mds-card-root");
  const performanceInsightsRoot = document.getElementById("performance-insights-root");
  const scoreRecoveryRoot = document.getElementById("score-recovery-root");
  const capacityBanner = document.getElementById("dispatch-capacity-banner");
  const merchantProfile = {
    name: document.querySelector("[data-merchant-name]"),
    company: document.querySelector("[data-merchant-company]"),
    id: document.querySelector("[data-merchant-id]"),
    hub: document.querySelector("[data-merchant-hub]"),
    shipments: document.querySelector("[data-merchant-shipments]"),
    email: document.querySelector("[data-merchant-email]"),
    lastSlot: document.querySelector("[data-merchant-last-slot]")
  };

  function ensureSimulationPrompt() {
    let prompt = document.getElementById("merchant-simulation-prompt");
    if (prompt || !main) return prompt;
    prompt = document.createElement("section");
    prompt.id = "merchant-simulation-prompt";
    prompt.className = "mb-8 rounded-2xl border border-tertiary/20 bg-tertiary/10 p-6";
    prompt.innerHTML = `
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-[10px] uppercase tracking-[0.3em] text-tertiary">Merchant Crisis Prompt</p>
          <h3 class="mt-2 font-headline text-xl font-bold text-on-surface">Simulate hub overload affecting merchant slots</h3>
          <p class="mt-2 text-sm text-on-surface-variant" data-sim-copy>
            Trigger a realistic spike in network congestion and slot demand. Trigger again to return all hub and slot conditions to normal.
          </p>
        </div>
        <button class="rounded-xl bg-tertiary px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-on-tertiary" data-sim-toggle>
          Trigger Crisis
        </button>
      </div>
    `;
    const headerSection = main.querySelector("section.mb-12");
    headerSection?.insertAdjacentElement("afterend", prompt);
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
      ? "Simulation is active. Press again to reverse the synthetic overload and restore merchant slot conditions."
      : "Trigger a realistic spike in network congestion and slot demand. Trigger again to return all hub and slot conditions to normal.";
    button.textContent = active ? "Restore Normal" : "Trigger Crisis";
    button.className = `rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] ${active ? "bg-error text-white" : "bg-tertiary text-on-tertiary"}`;
  }

  function getSelectedMerchant(merchants) {
    const session = getSession();
    return merchants.find((item) => item.contact_email === session?.user?.email) || merchants[0] || null;
  }

  function renderMerchantProfile(merchant, hubs) {
    if (!merchant) {
      merchantProfile.name.textContent = "No merchant connected";
      merchantProfile.company.textContent = "Connect merchant data to see account details.";
      merchantProfile.id.textContent = "--";
      merchantProfile.hub.textContent = "--";
      merchantProfile.shipments.textContent = "0 booked";
      merchantProfile.email.textContent = "--";
      merchantProfile.lastSlot.textContent = "No active slot";
      return;
    }

    const preferredHub = hubs.find((hub) => hub.id === merchant.preferred_hub);
    const totalShipments = merchant.booked_slots.reduce((sum, slot) => sum + (slot.shipment_count || 0), 0);
    const latestBooking = merchant.booked_slots[merchant.booked_slots.length - 1];

    merchantProfile.name.textContent = merchant.name;
    merchantProfile.company.textContent = merchant.company;
    merchantProfile.id.textContent = merchant.merchant_id;
    merchantProfile.hub.textContent = preferredHub ? preferredHub.name : merchant.preferred_hub;
    merchantProfile.shipments.textContent = `${totalShipments} booked`;
    merchantProfile.email.textContent = merchant.contact_email;
    merchantProfile.lastSlot.textContent = latestBooking ? latestBooking.slot_time : "No active slot";
  }

  function renderMdsCard(mds) {
    if (!mdsRoot) return;
    if (!mds || mds.score == null) {
      mdsRoot.innerHTML = `<p class="text-sm text-on-surface-variant">Sign in as a merchant to load your Merchant Delivery Score.</p>`;
      return;
    }
    const b = mds.breakdown || {};
    const cancel = b.cancellation_rate_percent != null ? `${b.cancellation_rate_percent}%` : "—";
    mdsRoot.innerHTML = `
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <p class="text-[10px] font-mono text-secondary/70 tracking-[0.3em] uppercase">Score breakdown</p>
          <h3 class="mt-2 text-3xl font-headline font-bold text-on-surface">${mds.score}<span class="text-lg text-on-surface-variant">/100</span></h3>
        </div>
        <div class="text-right text-[10px] font-mono text-on-surface-variant max-w-[160px]">
          Performance → allocation
          <p class="mt-2 text-secondary">${mds.score_to_tier || ""}</p>
        </div>
      </div>
      <div class="mb-4 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-all" style="width:${Math.min(100, mds.score)}%"></div>
      </div>
      <p class="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-2">Signals</p>
      <ul class="space-y-2 text-xs text-on-surface-variant">
        <li class="flex justify-between"><span>Forecast accuracy</span><span class="font-mono text-on-surface">${b.forecast_accuracy ?? "—"}</span></li>
        <li class="flex justify-between"><span>Packaging quality</span><span class="font-mono text-on-surface">${b.packaging_quality ?? "—"}</span></li>
        <li class="flex justify-between"><span>Dispatch timeliness</span><span class="font-mono text-on-surface">${b.dispatch_timeliness ?? "—"}</span></li>
        <li class="flex justify-between"><span>Volume consistency</span><span class="font-mono text-on-surface">${b.volume_consistency ?? "—"}</span></li>
        <li class="flex justify-between"><span>Cancellation rate</span><span class="font-mono text-on-surface">${cancel}</span></li>
      </ul>
      <p class="mt-3 text-[11px] text-on-surface-variant border-t border-white/5 pt-3">
        Capacity partner factor on slot quotes: <span class="font-mono text-secondary">${mds.price_multiplier}x</span>
        ${
          mds.peak_network_gate_live
            ? " · Network is warm — booking a little earlier keeps options open."
            : ""
        }
      </p>
    `;
  }

  function renderPerformanceInsights(mds) {
    if (!performanceInsightsRoot) return;
    if (!mds || mds.score == null) {
      performanceInsightsRoot.innerHTML = "";
      return;
    }
    const insights = mds.improvement_insights;
    const bullets = (insights?.bullets || [])
      .map((line) => `<li class="flex gap-2"><span class="text-secondary">•</span><span>${line}</span></li>`)
      .join("");
    const insightsHtml = insights
      ? `
      <div class="mt-5 rounded-xl border border-secondary/25 bg-secondary/5 p-4">
        <p class="text-xs font-headline font-semibold text-secondary uppercase tracking-widest">${insights.title}</p>
        <p class="mt-2 text-sm text-on-surface">${insights.lead}</p>
        <p class="mt-2 text-xs text-on-surface-variant">${insights.body}</p>
        <ul class="mt-3 space-y-1.5 text-xs text-on-surface">${bullets}</ul>
      </div>
    `
      : "";
    performanceInsightsRoot.innerHTML = `
      <p class="text-[10px] font-mono text-primary/80 tracking-[0.3em] uppercase">Performance insights</p>
      <h3 class="mt-2 text-xl font-headline font-bold text-on-surface">How the network sees your reliability</h3>
      <p class="mt-4 text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Merchant Delivery Score</p>
      <p class="mt-1 text-3xl font-headline font-bold text-on-surface">${mds.score}<span class="text-lg text-on-surface-variant">/100</span></p>
      <p class="mt-4 text-sm text-on-surface"><span class="text-on-surface-variant">Current tier:</span> <span class="font-semibold text-primary">${mds.allocation_tier_label}</span></p>
      <div class="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <p class="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Capacity access status</p>
        <p class="mt-2 text-sm text-on-surface leading-relaxed">${mds.capacity_access_status}</p>
      </div>
      ${insightsHtml}
    `;
  }

  function renderScoreRecoveryPlan(mds) {
    if (!scoreRecoveryRoot || !mds?.recovery_plan) return;
    const p = mds.recovery_plan;
    const checks = (p.checklist || [])
      .map((line) => `<li class="flex gap-2 text-sm text-on-surface"><span class="text-secondary">✔</span><span>${line}</span></li>`)
      .join("");
    scoreRecoveryRoot.innerHTML = `
      <p class="text-[10px] font-mono text-tertiary/80 tracking-[0.3em] uppercase">${p.title}</p>
      <p class="mt-2 text-sm text-on-surface-variant">${p.subtitle}</p>
      <ul class="mt-4 space-y-2">${checks}</ul>
      <p class="mt-4 text-sm text-on-surface">Estimated score improvement: <span class="font-mono font-bold text-tertiary">+${p.estimated_score_improvement_points} points</span></p>
      <p class="mt-2 text-[11px] text-on-surface-variant">${p.footnote || ""}</p>
    `;
  }

  function renderCapacityBanner(mds, activeHub) {
    if (!capacityBanner) return;
    if (!mds || mds.score == null) {
      capacityBanner.innerHTML = "";
      return;
    }
    const util = activeHub?.hub_utilization_percent ?? mds.hub_utilization_percent ?? 0;
    const busy = mds.peak_network_gate_live || (mds.tier === "optimization" && util >= 75);
    capacityBanner.innerHTML = `
      <div class="rounded-2xl border ${busy ? "border-tertiary/40 bg-tertiary/10" : "border-white/10 bg-white/5"} p-5">
        <p class="text-[10px] font-mono uppercase tracking-[0.25em] text-on-surface-variant">Capacity availability based on your performance tier</p>
        ${busy ? `<p class="mt-2 text-sm font-headline text-tertiary">Peak capacity notice</p>` : ""}
        <p class="mt-2 text-sm text-on-surface">Merchant Delivery Score: <span class="font-mono font-bold">${mds.score}</span> · ${mds.allocation_tier_label}</p>
        <p class="mt-2 text-sm text-on-surface-variant leading-relaxed">${mds.capacity_access_status}</p>
        <p class="mt-3 text-xs text-on-surface-variant">Stronger packaging compliance and on-time dispatch unlock Priority windows when hubs are busy.</p>
      </div>
    `;
  }

  function openDispatchModal({ slot, mds, onConfirm }) {
    const backdrop = document.createElement("div");
    backdrop.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4";
    const util = mds?.hub_utilization_percent ?? "";
    const tier = mds?.tier;
    const windows = (mds?.recommended_dispatch_windows || []).map((w) => `<li class="ml-4 list-disc">${w}</li>`).join("");
    const windowsBlock =
      tier === "optimization" && windows
        ? `<div class="mt-3 text-xs text-on-surface-variant"><p class="font-semibold text-on-surface">Your current tier favors dispatch during:</p><ul class="mt-2 space-y-1">${windows}</ul><p class="mt-3">Improving packaging compliance can unlock priority dispatch windows.</p></div>`
        : "";
    const noticeTitle = tier === "optimization" ? "Peak capacity notice" : tier === "priority" ? "Partner capacity overview" : "Capacity overview";
    const borderTone = tier === "optimization" ? "border-tertiary/30 bg-tertiary/10" : "border-primary/20 bg-primary/5";

    backdrop.innerHTML = `
      <div class="max-w-md w-full rounded-2xl border border-white/10 bg-surface-container p-6 shadow-2xl">
        <h3 class="font-headline text-lg font-bold text-on-surface">Confirm dispatch</h3>
        <p class="mt-2 text-xs text-on-surface-variant uppercase tracking-widest">Capacity availability based on your performance tier</p>
        <div class="mt-4 rounded-xl border ${borderTone} p-4 text-sm text-on-surface">
          <p class="font-semibold ${tier === "optimization" ? "text-tertiary" : "text-primary"}">${noticeTitle}</p>
          <p class="mt-2">Merchant Delivery Score: <span class="font-mono">${mds?.score ?? "—"}</span> · ${mds?.allocation_tier_label || mds?.tier_label || mds?.tier || "—"}</p>
          <p class="mt-1">Slot: <span class="font-mono">${slot.slot_time}</span> · ${formatCurrency(slot.price)}</p>
          <p class="mt-2 text-xs text-on-surface-variant">Hub utilization: ${util !== "" ? `${util}%` : "live"}${slot.dispatch_note ? ` · ${slot.dispatch_note}` : ""}</p>
          ${windowsBlock}
        </div>
        <div class="mt-6 flex gap-3 justify-end">
          <button type="button" class="rounded-lg border border-white/10 px-4 py-2 text-xs uppercase tracking-widest text-on-surface-variant hover:bg-white/5" data-dismiss>Cancel</button>
          <button type="button" class="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-primary" data-confirm>Confirm dispatch</button>
        </div>
      </div>
    `;
    const close = () => backdrop.remove();
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector("[data-dismiss]")?.addEventListener("click", close);
    backdrop.querySelector("[data-confirm]")?.addEventListener("click", async () => {
      close();
      await onConfirm();
    });
    document.body.appendChild(backdrop);
  }

  async function renderSlots(hubId, hubs = []) {
    const queryParts = [];
    if (hubId) queryParts.push(`hub_id=${encodeURIComponent(hubId)}`);
    const baseQs = queryParts.length ? `?${queryParts.join("&")}` : "";
    let response = await apiRequest(`/merchant-slots${baseQs}`);
    const merchants = response.merchants || [];
    const selectedMerchant = getSelectedMerchant(merchants);
    if (selectedMerchant?.merchant_id && hubId) {
      queryParts.push(`merchant_id=${encodeURIComponent(selectedMerchant.merchant_id)}`);
      response = await apiRequest(`/merchant-slots?${queryParts.join("&")}`);
    }

    const activeHub = response.active_hub;
    const mds = response.merchant_delivery_score;

    if (regionSelect && activeHub) {
      const merchantHubs = merchants.map((merchant) => merchant.preferred_hub);
      if (!merchantHubs.length) {
        regionSelect.innerHTML = `<option value="${activeHub.id}">${activeHub.name}</option>`;
      }
    }

    if (merchantCards.length >= 2 && activeHub) {
      merchantCards[0].querySelector(".text-2xl").textContent = `${activeHub.shipment_rate / 60}x`;
      merchantCards[1].querySelector(".text-2xl").textContent = response.slots.find((slot) => slot.status === "peak")?.slot_time || "14:00";
    }

    renderMerchantProfile(getSelectedMerchant(response.merchants || []), hubs);
    renderMdsCard(mds);
    renderPerformanceInsights(mds);
    renderScoreRecoveryPlan(mds);
    renderCapacityBanner(mds, activeHub);

    if (!slotGrid) return;
    if (!activeHub || !response.slots.length) {
      slotGrid.innerHTML = `
        <div class="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-on-surface-variant">
          No live merchant slots yet. Connect MongoDB to load booking data.
        </div>
      `;
      if (merchantCards.length >= 2) {
        merchantCards[0].querySelector(".text-2xl").textContent = "--";
        merchantCards[1].querySelector(".text-2xl").textContent = "--";
      }
      return;
    }

    slotGrid.innerHTML = response.slots
      .map((slot) => {
        const locked = slot.status === "peak_locked";
        const reserved = slot.status === "reserved";
        const variant = reserved
          ? "bg-surface-container-highest/40 border border-white/5 opacity-50 cursor-not-allowed"
          : locked
            ? "relative bg-tertiary/10 border border-tertiary/30 opacity-85 cursor-not-allowed"
            : slot.status === "peak"
              ? "relative bg-tertiary/10 border border-tertiary/20"
              : slot.status === "deal"
                ? "relative bg-primary/10 border border-primary/40"
                : slot.status === "delayed"
                  ? "border border-secondary/25 bg-secondary/5"
                  : "bg-white/5 border border-white/10";

        const note = slot.dispatch_note ? `<p class="mt-2 text-[9px] text-on-surface-variant leading-snug">${slot.dispatch_note}</p>` : "";

        const buttonMarkup =
          reserved || locked
            ? `<div class="w-full py-2 bg-white/5 text-[10px] font-bold rounded-lg uppercase tracking-widest text-center text-on-surface-variant/50">${
                locked ? "Peak adjusted — pick off-peak" : "Unavailable"
              }</div>`
            : `<button class="merchant-book-slot w-full py-2 ${
                slot.status === "peak"
                  ? "bg-tertiary text-on-tertiary"
                  : slot.status === "deal"
                    ? "bg-primary text-on-primary"
                    : "border border-primary/30 text-primary"
              } text-[10px] font-bold rounded-lg uppercase tracking-widest transition-all" data-hub="${slot.hub_id}" data-slot="${slot.slot_time}">Book Slot</button>`;

        const routingTag =
          slot.routing_priority === "fast"
            ? '<span class="text-[9px] font-mono text-secondary uppercase">Fast lane</span>'
            : slot.routing_priority === "flex"
              ? '<span class="text-[9px] font-mono text-tertiary uppercase">Flexible</span>'
              : "";

        return `
          <div class="p-4 rounded-xl ${variant}">
            <div class="flex justify-between items-start mb-4">
              <span class="text-xs font-mono font-bold tracking-tighter">${slot.slot_time}</span>
              ${routingTag}
            </div>
            <div class="mb-2">
              <span class="block text-[10px] font-mono uppercase">${slot.status}</span>
              <span class="text-xl font-mono text-on-surface font-bold">${formatCurrency(slot.price)}</span>
            </div>
            ${note}
            ${buttonMarkup}
          </div>
        `;
      })
      .join("");

    slotGrid.querySelectorAll(".merchant-book-slot").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const hubParam = `hub_id=${encodeURIComponent(button.dataset.hub)}`;
          const sm = getSelectedMerchant((await apiRequest(`/merchant-slots?${hubParam}`)).merchants || []);
          const mParam = sm?.merchant_id ? `&merchant_id=${encodeURIComponent(sm.merchant_id)}` : "";
          const merchantsResponse = await apiRequest(`/merchant-slots?${hubParam}${mParam}`);
          const merchant = getSelectedMerchant(merchantsResponse.merchants || []);
          if (!merchant) {
            showToast("No merchant records yet. Connect MongoDB first.", "info");
            return;
          }
          const slotRow = (merchantsResponse.slots || []).find((s) => s.slot_time === button.dataset.slot);
          openDispatchModal({
            slot: slotRow || { slot_time: button.dataset.slot, price: 0 },
            mds: merchantsResponse.merchant_delivery_score,
            onConfirm: async () => {
              const result = await apiRequest("/book-slot", {
                method: "POST",
                body: JSON.stringify({
                  merchant_id: merchant.merchant_id,
                  hub_id: button.dataset.hub,
                  slot_time: button.dataset.slot,
                  shipment_count: 1
                })
              });
              showToast(`Slot ${result.booking.slot_time} booked for ${merchant.company}.`, "success");
              await renderSlots(button.dataset.hub, hubs);
            }
          });
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
  }

  try {
    const hubsResponse = await apiRequest("/hubs");
    const hubs = hubsResponse.hubs || [];
    if (regionSelect) {
      regionSelect.innerHTML = hubs.length
        ? hubs.map((hub) => `<option value="${hub.id}">${hub.name} (${hub.region})</option>`).join("")
        : `<option value="">No live hubs available</option>`;
      regionSelect.addEventListener("change", (event) => renderSlots(event.target.value, hubs));
    }
    const prompt = ensureSimulationPrompt();
    prompt?.querySelector("[data-sim-toggle]")?.addEventListener("click", async () => {
      try {
        const targetHubId = regionSelect?.value || hubs.find((hub) => hub.status === "BOTTLENECK")?.id || hubs[0]?.id || null;
        const result = await apiRequest("/toggle-crisis-simulation", {
          method: "POST",
          body: JSON.stringify({ hub_id: targetHubId, source: "merchant-desk" })
        });
        showToast(result.message, "success");
        const refreshedHubs = (await apiRequest("/hubs")).hubs || [];
        if (regionSelect && refreshedHubs.length) {
          regionSelect.innerHTML = refreshedHubs.map((hub) => `<option value="${hub.id}">${hub.name} (${hub.region})</option>`).join("");
          regionSelect.value = targetHubId && refreshedHubs.some((hub) => hub.id === targetHubId) ? targetHubId : refreshedHubs[0].id;
        }
        await refreshSimulationPrompt();
        await renderSlots(regionSelect?.value || refreshedHubs[0]?.id, refreshedHubs);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
    await refreshSimulationPrompt();
    await renderSlots(hubs[0]?.id, hubs);
  } catch (error) {
    showToast(error.message, "error");
  }
});
