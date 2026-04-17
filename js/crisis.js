document.addEventListener("DOMContentLoaded", async () => {
  const { apiRequest, formatPercent, showToast } = window.CascadeApp;

  const buttons = Array.from(document.querySelectorAll("button"));
  const simulateButton = buttons.find((button) => button.textContent.includes("Trigger Overload Scenario"));
  const rerouteButton = buttons.find((button) => button.textContent.includes("Reroute"));
  const activateHubButton = buttons.find((button) => button.textContent.includes("Activate Backup Hub"));
  const alertText = document.querySelector("section.mb-10 p");
  const incidentLog = document.querySelector(".glass-panel.rounded-xl.p-6 .space-y-4");
  const stressValues = document.querySelectorAll(".text-lg.font-mono");

  async function refreshPredictions() {
    const predictionResponse = await apiRequest("/predict-overload", {
      method: "POST",
      body: JSON.stringify({})
    });
    const overloaded = predictionResponse.predictions.find((hub) => hub.status === "OVERLOAD") || predictionResponse.predictions[0];
    if (!overloaded) {
      if (alertText) {
        alertText.innerHTML = "No live hub telemetry yet. Connect MongoDB to enable overload detection.";
      }
      if (stressValues.length >= 2) {
        stressValues[0].textContent = "--";
        stressValues[1].textContent = "--";
      }
      return;
    }
    if (alertText && overloaded) {
      alertText.innerHTML = `${overloaded.hub_name} operating at <span class="text-error font-mono font-bold">${formatPercent(
        overloaded.hub_capacity_percent
      )}</span>. Overload score ${overloaded.overload_score}.`;
    }
    if (stressValues.length >= 2 && overloaded) {
      stressValues[0].textContent = formatPercent(overloaded.hub_capacity_percent + 2.2);
      stressValues[1].textContent = formatPercent(Math.min(99, overloaded.overload_score));
    }
  }

  async function refreshIncidentLog() {
    const hubStatus = await apiRequest("/hub-status");
    const state = await apiRequest("/predict-overload", {
      method: "POST",
      body: JSON.stringify({})
    });
    if (!incidentLog) return;
    if (!state.predictions.length) {
      incidentLog.innerHTML = `
        <div class="text-xs text-on-surface-variant">
          No incidents yet. MongoDB connection is required for live crisis telemetry.
        </div>
      `;
      document.querySelector(".text-xs.font-mono.bg-primary\\/10")?.replaceChildren(
        document.createTextNode("EST. RESOLUTION: --")
      );
      return;
    }
    const predictionLines = state.predictions.slice(0, 3).map((item) => ({
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      level: item.status === "OVERLOAD" ? "FAILURE" : item.status === "AT_RISK" ? "WARNING" : "RESOLVED",
      message: `${item.hub_name}: score ${item.overload_score}, utilization ${formatPercent(item.hub_capacity_percent)}`
    }));
    incidentLog.innerHTML = predictionLines
      .map(
        (entry) => `
          <div class="flex gap-3 text-xs">
            <span class="font-mono text-white/30">${entry.time}</span>
            <p><span class="${entry.level === "FAILURE" ? "text-error" : entry.level === "WARNING" ? "text-tertiary" : "text-secondary"} font-bold">${entry.level}:</span> ${entry.message}</p>
          </div>
        `
      )
      .join("");
    document.querySelector(".text-xs.font-mono.bg-primary\\/10")?.replaceChildren(
      document.createTextNode(`EST. RESOLUTION: ${Math.max(18, 60 - hubStatus.summary.overload_hubs * 6)}m`)
    );
  }

  simulateButton?.addEventListener("click", async () => {
    try {
      const result = await apiRequest("/simulate-overload", {
        method: "POST",
        body: JSON.stringify({})
      });
      if (!result.hub) {
        showToast(result.message || "No hubs available for simulation.", "info");
        return;
      }
      showToast(`${result.hub.name} simulation triggered.`, "success");
      await refreshPredictions();
      await refreshIncidentLog();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  rerouteButton?.addEventListener("click", async () => {
    try {
      const result = await apiRequest("/trigger-crisis", {
        method: "POST",
        body: JSON.stringify({})
      });
      showToast(`Rerouted ${result.rerouted_shipments} shipments.`, "success");
      await refreshPredictions();
      await refreshIncidentLog();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  activateHubButton?.addEventListener("click", async () => {
    try {
      const hubs = await apiRequest("/hubs");
      if (!hubs.hubs.length) {
        showToast("No backup hubs available until MongoDB is connected.", "info");
        return;
      }
      const availableHub = hubs.hubs.find((hub) => hub.name.includes("Frankfurt")) || hubs.hubs[0];
      showToast(`Backup capacity ready at ${availableHub.name}.`, "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  try {
    await refreshPredictions();
    await refreshIncidentLog();
  } catch (error) {
    showToast(error.message, "error");
  }
});
