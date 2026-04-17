from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.db import DatabaseManager, get_db
from backend.services.reroute_engine import reroute_truck


router = APIRouter(tags=["Trucks"])


class RerouteTruckRequest(BaseModel):
    truck_id: str
    target_hub_id: str | None = None


@router.get("/trucks", summary="List active trucks")
def get_trucks(database: DatabaseManager = Depends(get_db)) -> dict:
    return {"trucks": database.list_documents("trucks")}


@router.post("/reroute-truck", summary="Reroute one truck to an alternate hub")
def reroute_truck_endpoint(payload: RerouteTruckRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    trucks = database.list_documents("trucks")
    truck = next((item for item in trucks if item["truck_id"] == payload.truck_id or item["id"] == payload.truck_id), None)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found.")

    hubs = database.list_documents("hubs")
    updated_truck = reroute_truck(truck, hubs, payload.target_hub_id)
    updated_truck["updated_at"] = datetime.utcnow().isoformat()
    database.replace_one("trucks", {"id": updated_truck["id"]}, updated_truck)
    return {"message": "Truck rerouted successfully.", "truck": updated_truck}
