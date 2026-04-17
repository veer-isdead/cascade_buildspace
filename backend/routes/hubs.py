from statistics import mean

from fastapi import APIRouter, Depends, Query

from backend.db import DatabaseManager, get_db
from backend.services.overload_predictor import predict_overload
from backend.services.slot_pricing import calculate_slot_price


router = APIRouter(tags=["Hubs"])


@router.get("/hubs", summary="List logistics hubs with live capacity and pricing data")
def get_hubs(database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    payload = []

    for hub in hubs:
        prediction = predict_overload(hub)
        hub["status"] = prediction["status"]
        hub["last_detection_time_ms"] = prediction["detection_time_ms"]
        dynamic_slot_price = calculate_slot_price(hub.get("slot_base_price", 0), prediction["hub_capacity_percent"])
        payload.append({**hub, **prediction, "dynamic_slot_price": dynamic_slot_price})

    return {"hubs": payload}


@router.get("/hub-status", summary="Get fleet-wide or single-hub status summary")
def get_hub_status(
    hub_id: str | None = Query(default=None, description="Optional hub identifier"),
    database: DatabaseManager = Depends(get_db),
) -> dict:
    hubs = database.list_documents("hubs")
    predictions = [{**hub, **predict_overload(hub)} for hub in hubs]

    if hub_id:
        selected = next((hub for hub in predictions if hub["id"] == hub_id), None)
        return {"hub": selected}

    hub_capacity_values = [hub["hub_capacity_percent"] for hub in predictions]
    overload_hubs = [hub for hub in predictions if hub["status"] == "OVERLOAD"]
    at_risk_hubs = [hub for hub in predictions if hub["status"] == "AT_RISK"]
    system_state = database.find_one("system_state", {"id": "system-state"}) or {}

    return {
        "summary": {
            "total_hubs": len(predictions),
            "average_capacity_utilization": round(mean(hub_capacity_values), 2) if hub_capacity_values else 0.0,
            "overload_hubs": len(overload_hubs),
            "at_risk_hubs": len(at_risk_hubs),
            "rerouted_shipments": system_state.get("rerouted_shipments", 0),
            "total_shipments_processed": system_state.get("total_shipments_processed", 0),
            "last_detection_time_ms": system_state.get("last_detection_time_ms", 0.0),
        },
        "hubs": predictions,
    }
