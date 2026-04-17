from fastapi import APIRouter, Depends

from backend.db import DatabaseManager, get_db
from backend.services.bottleneck_detector import detect_bottlenecks, hub_utilization


router = APIRouter(tags=["Alerts"])


@router.get("/alerts", summary="Get operational alerts")
def get_alerts(database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    shipments = database.list_documents("shipments")
    bottlenecks = detect_bottlenecks(hubs)
    system_state = database.find_one("system_state", {"id": "system-state"}) or {}

    alerts = [
        {
            "type": "hub",
            "severity": "high",
            "message": f"{hub['name']} congestion detected",
            "hub_id": hub["id"],
        }
        for hub in bottlenecks
    ]

    delay_risks = [
        shipment for shipment in shipments if shipment.get("status") in {"delayed", "delay_risk"}
    ]
    alerts.extend(
        {
            "type": "shipment",
            "severity": "medium" if shipment.get("status") == "delay_risk" else "high",
            "message": f"Shipment delay risk for {shipment['shipment_id']}",
            "shipment_id": shipment["shipment_id"],
        }
        for shipment in delay_risks
    )

    if system_state.get("crisis_simulation_active"):
        alerts.insert(
            0,
            {
                "type": "simulation",
                "severity": "high",
                "message": "Simulated crisis active. Trigger again to restore normal hub operations.",
            },
        )

    if not alerts:
        alerts.append(
            {
                "type": "network",
                "severity": "info",
                "message": f"Network stable. Average utilization {round(sum(hub_utilization(hub) for hub in hubs) / len(hubs) * 100, 1) if hubs else 0}%",
            }
        )

    return {"alerts": alerts}
