from datetime import datetime
from statistics import mean
from uuid import uuid4

import numpy as np
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.db import DatabaseManager, get_db
from backend.services.overload_predictor import predict_overload
from backend.services.reroute_engine import reroute_overloaded_trucks


router = APIRouter(tags=["Crisis"])


class OverloadRequest(BaseModel):
    hub_id: str | None = None


class CrisisTriggerRequest(BaseModel):
    hub_id: str | None = None


class SimulateOverloadRequest(BaseModel):
    hub_id: str | None = None
    inflow_increase: int = 25


class ToggleSimulationRequest(BaseModel):
    hub_id: str | None = None
    source: str | None = None


def _get_predictions(database: DatabaseManager, hub_id: str | None = None) -> list[dict]:
    hubs = database.list_documents("hubs")
    if hub_id:
        hubs = [hub for hub in hubs if hub["id"] == hub_id]
    return [{**hub, **predict_overload(hub)} for hub in hubs]


def _system_state(database: DatabaseManager) -> dict:
    return database.find_one("system_state", {"id": "system-state"}) or {"id": "system-state"}


def _snapshot_state(database: DatabaseManager, state: dict) -> None:
    state["crisis_simulation_active"] = True
    state["crisis_simulation_snapshot"] = {
        "hubs": database.list_documents("hubs"),
        "trucks": database.list_documents("trucks"),
        "shipments": database.list_documents("shipments"),
    }


def _restore_snapshot(database: DatabaseManager, state: dict) -> dict:
    snapshot = state.get("crisis_simulation_snapshot") or {}
    if snapshot.get("hubs") is not None:
        database.update_many("hubs", snapshot.get("hubs", []), key_field="id")
    if snapshot.get("trucks") is not None:
        database.update_many("trucks", snapshot.get("trucks", []), key_field="id")
    if snapshot.get("shipments") is not None:
        database.update_many("shipments", snapshot.get("shipments", []), key_field="id")

    state["crisis_simulation_active"] = False
    state["crisis_simulation_snapshot"] = None
    state["last_simulation_at"] = datetime.utcnow().isoformat()
    state.setdefault("incident_log", []).insert(
        0,
        {
            "time": datetime.utcnow().strftime("%H:%M"),
            "level": "RESOLVED",
            "message": "Simulated hub overload restored to baseline operating state.",
        },
    )
    database.replace_one("system_state", {"id": "system-state"}, state)
    return {
        "active": False,
        "mode": "restored",
        "message": "Crisis simulation reversed. All hubs returned to their original state.",
    }


def _choose_target_hub(hubs: list[dict], requested_hub_id: str | None = None) -> dict | None:
    if requested_hub_id:
        return next((hub for hub in hubs if hub["id"] == requested_hub_id), None)
    return max(hubs, key=lambda item: item.get("current_load", 0) / max(item.get("capacity") or item.get("capacity_total", 1), 1))


@router.post("/predict-overload", summary="Run overload prediction for one or all hubs")
def predict_overload_endpoint(payload: OverloadRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    predictions = _get_predictions(database, payload.hub_id)
    average_detection_time = round(mean([item["detection_time_ms"] for item in predictions]), 3) if predictions else 0.0

    system_state = database.find_one("system_state", {"id": "system-state"}) or {}
    system_state["last_detection_time_ms"] = average_detection_time
    system_state["last_prediction_at"] = datetime.utcnow().isoformat()
    database.replace_one("system_state", {"id": "system-state"}, system_state)

    return {
        "predictions": predictions,
        "overall_status": "OVERLOAD" if any(item["status"] == "OVERLOAD" for item in predictions) else "NORMAL",
    }


@router.post("/trigger-crisis", summary="Execute mitigation steps for overload hubs")
def trigger_crisis(payload: CrisisTriggerRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    trucks = database.list_documents("trucks")
    overload_targets = _get_predictions(database, payload.hub_id)
    overload_hub_ids = [hub["id"] for hub in overload_targets if hub["status"] == "OVERLOAD"]

    total_rerouted = 0
    for overloaded_hub_id in overload_hub_ids:
        hubs, trucks, rerouted_shipments = reroute_overloaded_trucks(hubs, trucks, overloaded_hub_id)
        total_rerouted += rerouted_shipments

    database.update_many("hubs", hubs, key_field="id")
    database.update_many("trucks", trucks, key_field="id")

    system_state = database.find_one("system_state", {"id": "system-state"}) or {}
    system_state["rerouted_shipments"] = system_state.get("rerouted_shipments", 0) + total_rerouted
    system_state.setdefault("incident_log", []).insert(
        0,
        {
            "time": datetime.utcnow().strftime("%H:%M"),
            "level": "ACTION",
            "message": f"Crisis playbook triggered. Rerouted shipments: {total_rerouted}",
        },
    )
    database.replace_one("system_state", {"id": "system-state"}, system_state)

    return {
        "message": "Crisis workflow executed.",
        "affected_hubs": overload_hub_ids,
        "rerouted_shipments": total_rerouted,
    }


@router.post("/simulate-overload", summary="Increase truck inflow and trigger overload detection")
def simulate_overload(payload: SimulateOverloadRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    if not hubs:
        return {"message": "No hubs available to simulate."}

    target_hub = next((hub for hub in hubs if hub["id"] == payload.hub_id), None) if payload.hub_id else max(
        hubs, key=lambda item: item.get("truck_queue", 0)
    )
    if not target_hub:
        return {"message": "Target hub not found."}

    target_hub["truck_queue"] += payload.inflow_increase
    target_hub["shipment_rate"] += int(payload.inflow_increase * 1.5)
    target_hub["current_load"] += payload.inflow_increase * 2
    target_hub["last_updated"] = datetime.utcnow().isoformat()
    database.replace_one("hubs", {"id": target_hub["id"]}, target_hub)

    trucks = database.list_documents("trucks")
    for index in range(3):
        trucks.append(
            {
                "id": str(uuid4()),
                "truck_id": f"SIM-{target_hub['code']}-{index + 1}",
                "driver_name": f"Simulation Driver {index + 1}",
                "origin_hub": target_hub["id"],
                "current_hub": target_hub["id"],
                "assigned_hub": target_hub["id"],
                "shipment_volume": 10 + (index * 5),
                "eta_minutes": 25 + (index * 10),
                "priority": "priority",
                "status": "queued",
                "reroute_history": [],
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
    database.update_many("trucks", trucks, key_field="id")

    system_state = database.find_one("system_state", {"id": "system-state"}) or {}
    system_state["simulation_runs"] = system_state.get("simulation_runs", 0) + 1
    system_state["last_simulation_at"] = datetime.utcnow().isoformat()
    system_state.setdefault("incident_log", []).insert(
        0,
        {
            "time": datetime.utcnow().strftime("%H:%M"),
            "level": "SIMULATION",
            "message": f"Simulated overload at {target_hub['name']} with +{payload.inflow_increase} truck inflow.",
        },
    )
    database.replace_one("system_state", {"id": "system-state"}, system_state)

    prediction = predict_overload(target_hub)
    return {
        "message": "Simulation complete.",
        "hub": target_hub,
        "prediction": prediction,
    }


@router.post("/toggle-crisis-simulation", summary="Toggle a realistic fake overload scenario on or off")
def toggle_crisis_simulation(payload: ToggleSimulationRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    state = _system_state(database)
    if state.get("crisis_simulation_active"):
        return _restore_snapshot(database, state)

    hubs = database.list_documents("hubs")
    trucks = database.list_documents("trucks")
    shipments = database.list_documents("shipments")
    if not hubs:
        return {"active": False, "message": "No hubs available to simulate."}

    target_hub = _choose_target_hub(hubs, payload.hub_id)
    if not target_hub:
        return {"active": False, "message": "Target hub not found."}

    _snapshot_state(database, state)
    rng = np.random.default_rng()

    overload_spike = int(rng.integers(140, 240))
    queue_spike = int(rng.integers(18, 40))
    throughput_spike = int(rng.integers(22, 55))
    eta_spike = int(rng.integers(35, 90))

    impacted_hubs = [target_hub]
    alternate_ids = target_hub.get("alternative_hubs", [])[:2]
    impacted_hubs.extend([hub for hub in hubs if hub["id"] in alternate_ids])

    for index, hub in enumerate(hubs):
        if hub["id"] == target_hub["id"]:
            hub["current_load"] = min((hub.get("capacity") or hub.get("capacity_total", 0)) + overload_spike, int((hub.get("capacity") or hub.get("capacity_total", 0)) * 1.18))
            hub["truck_queue"] = hub.get("truck_queue", 0) + queue_spike
            hub["throughput_per_hour"] = hub.get("throughput_per_hour") or hub.get("shipment_rate", 0)
            hub["shipment_rate"] = hub["throughput_per_hour"] + throughput_spike
            hub["throughput_per_hour"] = hub["shipment_rate"]
            hub["avg_processing_time"] = round(hub.get("avg_processing_time", 30) + float(rng.integers(8, 18)), 1)
        elif hub["id"] in alternate_ids:
            relief_shift = int(rng.integers(30, 80))
            hub["current_load"] = min(hub.get("current_load", 0) + relief_shift, int((hub.get("capacity") or hub.get("capacity_total", 0)) * 0.78))
            hub["truck_queue"] = hub.get("truck_queue", 0) + int(rng.integers(4, 10))
            hub["throughput_per_hour"] = hub.get("throughput_per_hour") or hub.get("shipment_rate", 0)
            hub["shipment_rate"] = hub["throughput_per_hour"] + int(rng.integers(6, 18))
            hub["throughput_per_hour"] = hub["shipment_rate"]
            hub["avg_processing_time"] = round(hub.get("avg_processing_time", 30) + float(rng.integers(3, 9)), 1)
        hub["last_updated"] = datetime.utcnow().isoformat()
        hubs[index] = hub

    for shipment in shipments:
        if shipment.get("current_hub") == target_hub["id"]:
            shipment["status"] = "delayed" if rng.random() > 0.45 else "delay_risk"
            shipment["eta_delay_minutes"] = eta_spike
            shipment.setdefault("route_history", []).append(
                {
                    "event": "simulated_congestion",
                    "hub": target_hub["id"],
                    "source": payload.source or "dashboard",
                }
            )
        elif shipment.get("current_hub") in alternate_ids:
            shipment["status"] = "rerouted"
            shipment.setdefault("route_history", []).append(
                {
                    "event": "simulated_reroute_inflow",
                    "hub": shipment.get("current_hub"),
                    "source": payload.source or "dashboard",
                }
            )

    synthetic_truck_count = int(rng.integers(3, 7))
    for index in range(synthetic_truck_count):
        trucks.append(
            {
                "id": str(uuid4()),
                "truck_id": f"SIM-{target_hub['code']}-{index + 1}",
                "driver_name": f"Simulation Driver {index + 1}",
                "origin_hub": target_hub["id"],
                "current_hub": target_hub["id"],
                "assigned_hub": target_hub["id"],
                "shipment_volume": int(rng.integers(10, 26)),
                "eta_minutes": int(rng.integers(25, 95)),
                "priority": "priority",
                "status": "queued",
                "reroute_history": [],
                "updated_at": datetime.utcnow().isoformat(),
            }
        )

    database.update_many("hubs", hubs, key_field="id")
    database.update_many("trucks", trucks, key_field="id")
    database.update_many("shipments", shipments, key_field="id")

    state["simulation_runs"] = state.get("simulation_runs", 0) + 1
    state["last_simulation_at"] = datetime.utcnow().isoformat()
    state.setdefault("incident_log", []).insert(
        0,
        {
            "time": datetime.utcnow().strftime("%H:%M"),
            "level": "SIMULATION",
            "message": f"Simulated overload at {target_hub['name']} with +{overload_spike} load, +{queue_spike} queue, and downstream merchant pressure.",
        },
    )
    database.replace_one("system_state", {"id": "system-state"}, state)

    return {
        "active": True,
        "mode": "triggered",
        "message": f"Simulated crisis active at {target_hub['name']}. Toggle again to restore baseline conditions.",
        "scenario": {
            "hub_id": target_hub["id"],
            "hub_name": target_hub["name"],
            "overload_spike": overload_spike,
            "queue_spike": queue_spike,
            "throughput_spike": throughput_spike,
            "eta_spike": eta_spike,
            "affected_hubs": [hub["id"] for hub in impacted_hubs],
        },
    }
