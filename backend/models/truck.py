from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Truck(BaseModel):
    id: str
    truck_id: str
    driver_name: str
    origin_hub: str
    current_hub: str
    assigned_hub: str
    shipment_volume: int
    eta_minutes: int
    priority: Literal["standard", "priority", "critical"] = "standard"
    status: Literal["scheduled", "inbound", "queued", "rerouted", "delivered"] = "queued"
    reroute_history: list[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
