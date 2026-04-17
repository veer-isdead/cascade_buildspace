document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatPercent, navigateTo, showToast } = window.CascadeApp;
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

  try {
    const [{ hubs }, hubStatus, { trucks }] = await Promise.all([
      apiRequest("/hubs"),
      apiRequest("/hub-status"),
      apiRequest("/trucks")
    ]);

    if (!hubs.length) {
      suggestionCard?.addEventListener("click", () => showToast("Connect MongoDB to enable crisis actions.", "info"));
      deployReliefButton?.addEventListener("click", () => navigateTo("/html/crisis-control.html"));
      return;
    }

    if (topCards.length >= 4) {
      topCards[0].querySelector(".font-mono")?.replaceChildren(document.createTextNode(String(trucks.length)));
      topCards[1].querySelector(".font-mono")?.replaceChildren(
        document.createTextNode(String(hubStatus.summary.average_capacity_utilization))
      );
      topCards[2].querySelector(".font-mono")?.replaceChildren(
        document.createTextNode(
          String(hubs.reduce((total, hub) => total + hub.shipment_rate, 0))
        )
      );
      topCards[3].querySelector(".font-mono")?.replaceChildren(
        document.createTextNode(`${100 - hubStatus.summary.overload_hubs * 4}%`)
      );
    }

    const overloadedHub = hubs.find((hub) => hub.status === "OVERLOAD") || hubs[0];
    if (alertSection && alertText && overloadedHub) {
      alertSection.textContent = overloadedHub.status === "OVERLOAD" ? "CRITICAL OVERLOAD PREDICTED" : "SYSTEM WATCH";
      alertText.textContent = `${overloadedHub.name} at ${formatPercent(overloadedHub.hub_capacity_percent)} capacity with score ${overloadedHub.overload_score}.`;
    }

    if (capacityContainer) {
      capacityContainer.innerHTML = hubs
        .slice(0, 4)
        .map(
          (hub) => `
            <div class="space-y-2">
              <div class="flex justify-between text-xs font-mono ${hub.status === "OVERLOAD" ? "text-error" : ""}">
                <span>${hub.name}</span>
                <span class="${hub.status === "OVERLOAD" ? "font-bold" : "text-on-surface-variant"}">${formatPercent(
                  hub.hub_capacity_percent
                )}</span>
              </div>
              <div class="h-3 bg-white/5 rounded-full overflow-hidden p-[1px]">
                <div class="h-full rounded-full ${hub.status === "OVERLOAD" ? "bg-gradient-to-r from-tertiary to-error" : hub.status === "AT_RISK" ? "bg-gradient-to-r from-secondary to-tertiary" : "bg-secondary"}" style="width: ${hub.hub_capacity_percent}%"></div>
              </div>
            </div>
          `
        )
        .join("");
    }

    const carrierBars = document.querySelectorAll(".w-8.h-8.rounded-lg + div .h-full");
    if (carrierBars.length >= 2) {
      carrierBars[0].style.width = `${Math.min(95, hubs[0]?.hub_capacity_percent || 60)}%`;
      carrierBars[1].style.width = `${Math.min(95, hubs[1]?.hub_capacity_percent || 45)}%`;
    }

    suggestionCard?.addEventListener("click", async () => {
      try {
        const result = await apiRequest("/trigger-crisis", {
          method: "POST",
          body: JSON.stringify({ hub_id: overloadedHub?.id || null })
        });
        showToast(`Crisis mitigation executed. Rerouted ${result.rerouted_shipments} shipments.`, "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    deployReliefButton?.addEventListener("click", () => navigateTo("/html/crisis-control.html"));
  } catch (error) {
    showToast(error.message, "error");
  }
});
