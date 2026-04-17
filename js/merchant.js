document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatCurrency, getSession, showToast } = window.CascadeApp;
  const regionSelect = document.querySelector("select");
  const slotGrid = document.querySelector(".grid.grid-cols-2.sm\\:grid-cols-3.md\\:grid-cols-4.xl\\:grid-cols-6");
  const merchantCards = document.querySelectorAll(".glass-panel.px-6.py-3.rounded-xl");

  async function renderSlots(hubId) {
    const response = await apiRequest(`/merchant-slots${hubId ? `?hub_id=${hubId}` : ""}`);
    const activeHub = response.active_hub;

    if (regionSelect && activeHub) {
      const hubs = response.merchants.map((merchant) => merchant.preferred_hub);
      if (!hubs.length) {
        regionSelect.innerHTML = `<option value="${activeHub.id}">${activeHub.name}</option>`;
      }
    }

    if (merchantCards.length >= 2 && activeHub) {
      merchantCards[0].querySelector(".text-2xl").textContent = `${activeHub.shipment_rate / 60}x`;
      merchantCards[1].querySelector(".text-2xl").textContent = response.slots.find((slot) => slot.status === "peak")?.slot_time || "14:00";
    }

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
        const session = getSession();
        try {
          const merchantsResponse = await apiRequest("/merchant-slots");
          const merchant =
            merchantsResponse.merchants.find((item) => item.contact_email === session?.user?.email) ||
            merchantsResponse.merchants[0];
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
          await renderSlots(button.dataset.hub);
        } catch (error) {
          showToast(error.message, "error");
        }
      });
    });
  }

  try {
    const hubsResponse = await apiRequest("/hubs");
    if (regionSelect) {
      regionSelect.innerHTML = hubsResponse.hubs.length
        ? hubsResponse.hubs.map((hub) => `<option value="${hub.id}">${hub.name} (${hub.region})</option>`).join("")
        : `<option value="">No live hubs available</option>`;
      regionSelect.addEventListener("change", (event) => renderSlots(event.target.value));
    }
    await renderSlots(hubsResponse.hubs[0]?.id);
  } catch (error) {
    showToast(error.message, "error");
  }
});
