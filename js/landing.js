document.addEventListener("DOMContentLoaded", () => {
  const heroStatus = document.querySelector(".text-2xl.font-mono.text-on-surface");
  const nodeBadges = document.querySelectorAll(".px-2.py-1.bg-surface-container-high.rounded");
  const statValues = document.querySelectorAll("section.px-8.py-20 .text-4xl.font-mono");
  const sidebarStatus = document.querySelector("aside .text-xs.font-mono.text-secondary");
  const operatorCount = Array.from(document.querySelectorAll("span")).find((item) =>
    item.textContent.includes("ACTIVE_NODES")
  );

  if (heroStatus) {
    heroStatus.innerHTML = `Live data pending <span class="text-xs text-secondary">MONGODB REQUIRED</span>`;
  }

  nodeBadges.forEach((badge) => {
    badge.textContent = "Awaiting live feed";
  });

  statValues.forEach((value) => {
    value.textContent = "--";
  });

  if (sidebarStatus) {
    sidebarStatus.textContent = "LIVE DATA PENDING";
  }

  if (operatorCount) {
    operatorCount.textContent = "ACTIVE_NODES: pending";
  }
});
