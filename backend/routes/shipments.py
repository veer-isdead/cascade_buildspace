from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.db import DatabaseManager, get_db
from backend.services.routing_engine import reroute_shipment


router = APIRouter(tags=["Shipments"])


class ShipmentCreateRequest(BaseModel):
    origin: str
    destination: str
    current_hub: str
    status: str = "scheduled"
    eta: str
    route: list[str] = Field(default_factory=list)


@router.get("/shipments", summary="List shipments across the network")
def get_shipments(database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    shipments = [reroute_shipment(shipment, hubs) for shipment in database.list_documents("shipments")]
    return {"shipments": shipments}


@router.post("/shipments", summary="Create a shipment and optimize its route")
def create_shipment(payload: ShipmentCreateRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    if not next((hub for hub in hubs if hub["id"] == payload.current_hub), None):
        raise HTTPException(status_code=404, detail="Current hub not found.")

    shipment = {
        "id": str(uuid4()),
        "shipment_id": f"SHP-{uuid4().hex[:8].upper()}",
        "origin": payload.origin,
        "destination": payload.destination,
        "current_hub": payload.current_hub,
        "status": payload.status,
        "eta": payload.eta,
        "route": payload.route or [payload.origin, payload.current_hub, payload.destination],
        "created_at": datetime.utcnow().isoformat(),
        "route_history": [],
    }
    shipment = reroute_shipment(shipment, hubs)
    if shipment.get("rerouted"):
        shipment["status"] = "rerouted"

    database.insert_one("shipments", shipment)
    return {"message": "Shipment created successfully.", "shipment": shipment}


@router.get("/shipments/{shipment_id}", summary="Get a single shipment")
def get_shipment(shipment_id: str, database: DatabaseManager = Depends(get_db)) -> dict:
    shipment = database.find_one("shipments", {"shipment_id": shipment_id}) or database.find_one("shipments", {"id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    hubs = database.list_documents("hubs")
    return {"shipment": reroute_shipment(shipment, hubs)}
