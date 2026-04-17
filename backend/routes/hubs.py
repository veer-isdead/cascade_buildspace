from statistics import mean

from fastapi import APIRouter, Depends, Query

from backend.db import DatabaseManager, get_db
from backend.services.bottleneck_detector import detect_bottlenecks, hub_status_from_utilization, hub_utilization
from backend.services.overload_predictor import predict_overload
from backend.services.slot_pricing import calculate_slot_price


router = APIRouter(tags=["Hubs"])


def estimate_time_to_bottleneck(hub: dict) -> dict:
    capacity = max(hub.get("capacity") or hub.get("capacity_total", 0), 1)
    current_load = hub.get("current_load", 0)
    throughput_per_hour = max(hub.get("throughput_per_hour") or hub.get("shipment_rate", 0), 0)
    bottleneck_threshold = capacity * 0.85
    remaining_capacity = max(bottleneck_threshold - current_load, 0)

    if current_load >= bottleneck_threshold:
        return {
            "time_to_bottleneck_hours": 0.0,
            "time_to_bottleneck_label": "Bottleneck now",
        }

    if throughput_per_hour <= 0:
        return {
            "time_to_bottleneck_hours": None,
            "time_to_bottleneck_label": "Stable",
        }

    hours_remaining = round(remaining_capacity / throughput_per_hour, 2)
    if hours_remaining < 1:
        label = f"{max(1, round(hours_remaining * 60))} min"
    else:
        whole_hours = int(hours_remaining)
        minutes = round((hours_remaining - whole_hours) * 60)
        label = f"{whole_hours}h {minutes}m"

    return {
        "time_to_bottleneck_hours": hours_remaining,
        "time_to_bottleneck_label": label,
    }


@router.get("/hubs", summary="List logistics hubs with live capacity and pricing data")
def get_hubs(database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    payload = []
    bottleneck_ids = {hub["id"] for hub in detect_bottlenecks(hubs)}

    for hub in hubs:
        capacity = hub.get("capacity") or hub.get("capacity_total", 0)
        throughput_per_hour = hub.get("throughput_per_hour") or hub.get("shipment_rate", 0)
        utilization = hub_utilization(hub)
        prediction = predict_overload(hub)
        hub["capacity"] = capacity
        hub["capacity_total"] = capacity
        hub["throughput_per_hour"] = throughput_per_hour
        hub["shipment_rate"] = throughput_per_hour
        hub["hub_utilization"] = utilization
        hub["hub_utilization_percent"] = round(utilization * 100, 2)
        hub["status"] = "BOTTLENECK" if hub["id"] in bottleneck_ids else hub_status_from_utilization(utilization)
        hub["last_detection_time_ms"] = prediction["detection_time_ms"]
        dynamic_slot_price = calculate_slot_price(hub.get("slot_base_price", 0), prediction["hub_capacity_percent"])
        payload.append(
            {
                **hub,
                **prediction,
                **estimate_time_to_bottleneck(hub),
                "predictive_status": prediction["status"],
                "dynamic_slot_price": dynamic_slot_price,
            }
        )

    return {"hubs": payload}


@router.get("/hub-status", summary="Get fleet-wide or single-hub status summary")
def get_hub_status(
    hub_id: str | None = Query(default=None, description="Optional hub identifier"),
    database: DatabaseManager = Depends(get_db),
) -> dict:
    hubs = database.list_documents("hubs")
    predictions = []
    for hub in hubs:
        utilization = hub_utilization(hub)
        predictions.append(
            {
                **hub,
                **predict_overload(hub),
                **estimate_time_to_bottleneck(hub),
                "capacity": hub.get("capacity") or hub.get("capacity_total", 0),
                "throughput_per_hour": hub.get("throughput_per_hour") or hub.get("shipment_rate", 0),
                "hub_utilization": utilization,
                "hub_utilization_percent": round(utilization * 100, 2),
                "status": hub_status_from_utilization(utilization),
            }
        )

    if hub_id:
        selected = next((hub for hub in predictions if hub["id"] == hub_id), None)
        return {"hub": selected}

    hub_capacity_values = [hub["hub_utilization_percent"] for hub in predictions]
    bottleneck_hubs = [hub for hub in predictions if hub["status"] == "BOTTLENECK"]
    high_load_hubs = [hub for hub in predictions if hub["status"] == "HIGH_LOAD"]
    system_state = database.find_one("system_state", {"id": "system-state"}) or {}
    shipments = database.list_documents("shipments")

    return {
        "summary": {
            "total_hubs": len(predictions),
            "average_capacity_utilization": round(mean(hub_capacity_values), 2) if hub_capacity_values else 0.0,
            "overload_hubs": len(bottleneck_hubs),
            "at_risk_hubs": len(high_load_hubs),
            "bottleneck_hubs": len(bottleneck_hubs),
            "active_hubs": len([hub for hub in predictions if hub["current_load"] > 0]),
            "network_utilization": round(mean([hub["hub_utilization"] for hub in predictions]) * 100, 2) if predictions else 0.0,
            "rerouted_shipments": system_state.get("rerouted_shipments", 0),
            "total_shipments_processed": system_state.get("total_shipments_processed", 0) or len(shipments),
            "last_detection_time_ms": system_state.get("last_detection_time_ms", 0.0),
            "simulation_active": bool(system_state.get("crisis_simulation_active")),
        },
        "hubs": predictions,
    }
