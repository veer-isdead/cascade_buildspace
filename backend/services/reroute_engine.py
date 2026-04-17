from copy import deepcopy

from backend.services.overload_predictor import capacity_percent


def _candidate_hubs(hubs: list[dict], exclude_hub_id: str, threshold: float = 85.0) -> list[dict]:
    available = [
        hub
        for hub in hubs
        if hub.get("id") != exclude_hub_id and capacity_percent(hub) < threshold
    ]
    return sorted(available, key=capacity_percent)


def assign_alternative_hub(hubs: list[dict], source_hub_id: str, threshold: float = 85.0) -> dict | None:
    candidates = _candidate_hubs(hubs, source_hub_id, threshold=threshold)
    return deepcopy(candidates[0]) if candidates else None


def reroute_truck(truck: dict, hubs: list[dict], target_hub_id: str | None = None) -> dict:
    updated_truck = deepcopy(truck)

    if target_hub_id:
        target_hub = next((hub for hub in hubs if hub.get("id") == target_hub_id), None)
    else:
        target_hub = assign_alternative_hub(hubs, truck.get("assigned_hub") or truck.get("current_hub"))

    if not target_hub:
        raise ValueError("No alternative hub is currently available for rerouting.")

    updated_truck["status"] = "rerouted"
    updated_truck["assigned_hub"] = target_hub["id"]
    updated_truck["current_hub"] = target_hub["id"]
    updated_truck.setdefault("reroute_history", []).append(target_hub["id"])
    return updated_truck


def reroute_overloaded_trucks(
    hubs: list[dict],
    trucks: list[dict],
    overloaded_hub_id: str,
    threshold: float = 85.0,
) -> tuple[list[dict], list[dict], int]:
    updated_hubs = [deepcopy(hub) for hub in hubs]
    updated_trucks = [deepcopy(truck) for truck in trucks]
    rerouted_count = 0

    source_hub = next((hub for hub in updated_hubs if hub.get("id") == overloaded_hub_id), None)
    if not source_hub:
        return updated_hubs, updated_trucks, rerouted_count

    candidates = _candidate_hubs(updated_hubs, overloaded_hub_id, threshold=threshold)
    if not candidates:
        return updated_hubs, updated_trucks, rerouted_count

    source_trucks = [
        truck
        for truck in updated_trucks
        if truck.get("assigned_hub") == overloaded_hub_id and truck.get("status") != "delivered"
    ]
    trucks_to_reroute = max(1, int(len(source_trucks) * 0.4)) if source_trucks else 0

    for truck in source_trucks[:trucks_to_reroute]:
        target_hub = candidates[rerouted_count % len(candidates)]
        truck["status"] = "rerouted"
        truck["assigned_hub"] = target_hub["id"]
        truck["current_hub"] = target_hub["id"]
        truck.setdefault("reroute_history", []).append(target_hub["id"])

        source_hub["current_load"] = max(0, source_hub.get("current_load", 0) - truck.get("shipment_volume", 0))
        source_hub["truck_queue"] = max(0, source_hub.get("truck_queue", 0) - 1)
        target_hub["current_load"] = target_hub.get("current_load", 0) + truck.get("shipment_volume", 0)
        target_hub["truck_queue"] = target_hub.get("truck_queue", 0) + 1
        rerouted_count += truck.get("shipment_volume", 0)

    return updated_hubs, updated_trucks, rerouted_count
