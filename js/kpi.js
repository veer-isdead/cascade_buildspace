document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatPercent, showToast } = window.CascadeApp;

  try {
    const [hubStatus, truckResponse, merchantSlots] = await Promise.all([
      apiRequest("/hub-status"),
      apiRequest("/trucks"),
      apiRequest("/merchant-slots")
    ]);

    const cards = document.querySelectorAll(".grid.grid-cols-1.md\\:grid-cols-3.lg\\:grid-cols-4 > div");
    const summary = hubStatus.summary;
    const trucks = truckResponse.trucks;
    const reroutedShipments = summary.rerouted_shipments;
    const totalBookings = merchantSlots.merchants.reduce(
      (sum, merchant) => sum + (merchant.booked_slots || []).length,
      0
    );

    if (cards.length >= 3) {
      cards[0].querySelector(".text-6xl")?.replaceChildren(document.createTextNode(String(summary.last_detection_time_ms || "--")));
      cards[1].querySelector(".text-4xl")?.replaceChildren(document.createTextNode(String(reroutedShipments || trucks.filter((truck) => truck.status === "rerouted").length || "--")));
      cards[2].querySelector(".text-4xl")?.replaceChildren(
        document.createTextNode(hubStatus.hubs.length ? String((100 - summary.overload_hubs * 0.8).toFixed(2)) : "--")
      );
    }

    const headerMetrics = document.querySelectorAll("header .text-2xl.mono-metrics");
    if (headerMetrics.length >= 2) {
      headerMetrics[0].textContent = hubStatus.hubs.length ? `${summary.last_detection_time_ms || 0.42}ms` : "--";
      headerMetrics[1].textContent = hubStatus.hubs[0]?.code || "LIVE";
    }

    const hubDistributionRows = document.querySelectorAll(".glass-panel.p-8.rounded-full .space-y-6 .flex.items-center.gap-4");
    if (!hubStatus.hubs.length) {
      hubDistributionRows.forEach((row) => {
        row.querySelector(".w-24").textContent = "PENDING";
        row.querySelector(".h-full").style.width = "0%";
        row.querySelector(".w-12").textContent = "--";
      });
    }
    hubStatus.hubs.slice(0, hubDistributionRows.length).forEach((hub, index) => {
      const row = hubDistributionRows[index];
      row.querySelector(".w-24").textContent = hub.code;
      row.querySelector(".h-full").style.width = `${hub.hub_capacity_percent}%`;
      row.querySelector(".w-12").textContent = formatPercent(hub.hub_capacity_percent);
    });

    const nodeStatuses = document.querySelectorAll(".bg-black\\/40.backdrop-blur-md.p-3.rounded-lg.border.border-white\\/5 .text-xs.mono-metrics");
    if (nodeStatuses.length >= 2) {
      nodeStatuses[0].textContent = hubStatus.hubs.length ? `OK [${summary.last_detection_time_ms || 0.02}ms]` : "PENDING [--]";
      nodeStatuses[1].textContent = hubStatus.hubs.length ? `STABLE [${summary.average_capacity_utilization.toFixed(0)}%]` : "WAITING [--]";
    }

    const quotaText = Array.from(document.querySelectorAll(".text-xs.text-on-surface-variant.flex.justify-between.mono-metrics span"));
    if (quotaText.length >= 2) {
      quotaText[0].textContent = hubStatus.hubs.length ? `${Math.min(100, totalBookings * 15)}% QUOTA` : "LIVE DATA PENDING";
      quotaText[1].textContent = hubStatus.hubs.length ? `${summary.total_shipments_processed + totalBookings} TARGET` : "MONGODB REQUIRED";
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});
