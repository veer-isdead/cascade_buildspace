document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatDateTime, showToast } = window.CascadeApp;

  try {
    const [shipmentResponse, hubResponse] = await Promise.all([apiRequest("/shipments"), apiRequest("/hubs")]);
    const shipments = shipmentResponse.shipments;
    const hubs = hubResponse.hubs;

    const statCards = document.querySelectorAll("[data-shipment-stat]");
    if (statCards.length >= 4) {
      statCards[0].textContent = String(shipments.length);
      statCards[1].textContent = String(shipments.filter((shipment) => shipment.status === "in_transit").length);
      statCards[2].textContent = String(shipments.filter((shipment) => shipment.status === "rerouted").length);
      statCards[3].textContent = String(hubs.filter((hub) => hub.status === "BOTTLENECK").length);
    }

    const tbody = document.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = shipments
      .map(
        (shipment) => `
          <tr class="border-b border-white/5">
            <td class="px-6 py-4 font-mono text-on-surface">${shipment.shipment_id}</td>
            <td class="px-6 py-4 text-on-surface-variant">${shipment.current_hub}</td>
            <td class="px-6 py-4 ${shipment.status.includes("delay") ? "text-error" : shipment.status === "rerouted" ? "text-tertiary" : "text-secondary"}">${shipment.status}</td>
            <td class="px-6 py-4 text-on-surface-variant">${formatDateTime(shipment.eta)}</td>
            <td class="px-6 py-4 text-on-surface-variant">${shipment.route.join(" → ")}</td>
          </tr>
        `
      )
      .join("");
  } catch (error) {
    showToast(error.message, "error");
  }
});
