def hub_utilization(hub: dict) -> float:
    capacity = max(hub.get("capacity") or hub.get("capacity_total", 0), 1)
    return round(hub.get("current_load", 0) / capacity, 4)


def hub_status_from_utilization(utilization: float) -> str:
    if utilization > 0.85:
        return "BOTTLENECK"
    if utilization > 0.7:
        return "HIGH_LOAD"
    return "NORMAL"


def detect_bottlenecks(hubs: list[dict]) -> list[dict]:
    bottlenecks = []
    for hub in hubs:
        utilization = hub_utilization(hub)
        if utilization > 0.85:
            bottlenecks.append(
                {
                    **hub,
                    "hub_utilization": utilization,
                    "hub_utilization_percent": round(utilization * 100, 2),
                    "status": "BOTTLENECK",
                }
            )
    return bottlenecks
