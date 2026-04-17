document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatCurrency, getSession, showToast } = window.CascadeApp;
  const main = document.querySelector("main");
  const regionSelect = document.querySelector("select");
  const slotGrid = document.querySelector(".grid.grid-cols-2.sm\\:grid-cols-3.md\\:grid-cols-4.xl\\:grid-cols-6");
  const merchantCards = document.querySelectorAll(".glass-panel.px-6.py-3.rounded-xl");
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

  async function renderSlots(hubId, hubs = []) {
    const response = await apiRequest(`/merchant-slots${hubId ? `?hub_id=${hubId}` : ""}`);
    const activeHub = response.active_hub;
    const merchants = response.merchants || [];
    const selectedMerchant = getSelectedMerchant(merchants);

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

    renderMerchantProfile(selectedMerchant, hubs);

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
        const variant =
          slot.status === "reserved"
            ? "bg-surface-container-highest/40 border border-white/5 opacity-50 cursor-not-allowed"
            : slot.status === "peak"
              ? "relative bg-tertiary/10 border border-tertiary/20"
              : slot.status === "deal"
                ? "relative bg-primary/10 border border-primary/40"
                : "bg-white/5 border border-white/10";

        const buttonMarkup =
          slot.status === "reserved"
            ? `<div class="w-full py-2 bg-white/5 text-[10px] font-bold rounded-lg uppercase tracking-widest text-center text-on-surface-variant/30">Unavailable</div>`
            : `<button class="merchant-book-slot w-full py-2 ${slot.status === "peak" ? "bg-tertiary text-on-tertiary" : slot.status === "deal" ? "bg-primary text-on-primary" : "border border-primary/30 text-primary"} text-[10px] font-bold rounded-lg uppercase tracking-widest transition-all" data-hub="${slot.hub_id}" data-slot="${slot.slot_time}">Book Slot</button>`;

        return `
          <div class="p-4 rounded-xl ${variant}">
            <div class="flex justify-between items-start mb-4">
              <span class="text-xs font-mono font-bold tracking-tighter">${slot.slot_time}</span>
            </div>
            <div class="mb-6">
              <span class="block text-[10px] font-mono uppercase">${slot.status}</span>
              <span class="text-xl font-mono text-on-surface font-bold">${formatCurrency(slot.price)}</span>
            </div>
            ${buttonMarkup}
          </div>
        `;
      })
      .join("");

    slotGrid.querySelectorAll(".merchant-book-slot").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const merchantsResponse = await apiRequest("/merchant-slots");
          const merchant = getSelectedMerchant(merchantsResponse.merchants || []);
          if (!merchant) {
            showToast("No merchant records yet. Connect MongoDB first.", "info");
            return;
          }
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
