from copy import deepcopy

from backend.services.bottleneck_detector import detect_bottlenecks, hub_utilization


def _country(location: str) -> str:
    parts = [part.strip() for part in (location or "").split(",") if part.strip()]
    return parts[-1] if parts else ""


def find_nearest_available_hub(source_hub_id: str, hubs: list[dict], threshold: float = 0.7) -> dict | None:
    source_hub = next((hub for hub in hubs if hub.get("id") == source_hub_id), None)
    if not source_hub:
        return None

    candidates = [hub for hub in hubs if hub.get("id") != source_hub_id and hub_utilization(hub) < threshold]
    if not candidates:
        return None

    alternatives = source_hub.get("alternative_hubs", [])
    source_country = _country(source_hub.get("location", ""))
    source_region = source_hub.get("region", "")

    def score(hub: dict) -> tuple[int, int, float, str]:
        alternative_rank = alternatives.index(hub["id"]) if hub["id"] in alternatives else 99
        region_penalty = 0 if hub.get("region") == source_region else 1
        country_penalty = 0 if _country(hub.get("location", "")) == source_country else 1
        return (alternative_rank, region_penalty + country_penalty, hub_utilization(hub), hub.get("name", ""))

    return deepcopy(sorted(candidates, key=score)[0])


def reroute_shipment(shipment: dict, hubs: list[dict]) -> dict:
    updated = deepcopy(shipment)
    bottleneck_ids = {hub["id"] for hub in detect_bottlenecks(hubs)}

    route = list(updated.get("route", []))
    current_hub = updated.get("current_hub")
    bottleneck_hub_id = current_hub if current_hub in bottleneck_ids else next((hub_id for hub_id in route if hub_id in bottleneck_ids), None)

    if not bottleneck_hub_id:
        updated["rerouted"] = False
        return updated

    replacement_hub = find_nearest_available_hub(bottleneck_hub_id, hubs)
    if not replacement_hub:
        updated["rerouted"] = False
        return updated

    updated["route"] = [replacement_hub["id"] if step == bottleneck_hub_id else step for step in route]
    if current_hub == bottleneck_hub_id:
        updated["current_hub"] = replacement_hub["id"]
    updated["rerouted"] = True
    updated["rerouted_from"] = bottleneck_hub_id
    updated["rerouted_to"] = replacement_hub["id"]
    updated.setdefault("route_history", []).append(
        {
            "from": bottleneck_hub_id,
            "to": replacement_hub["id"],
            "reason": "bottleneck_avoidance",
        }
    )
    return updated
