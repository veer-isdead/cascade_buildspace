from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Shipment(BaseModel):
    id: str
    shipment_id: str
    origin: str
    destination: str
    current_hub: str
    status: Literal["scheduled", "in_transit", "delay_risk", "delayed", "rerouted", "delivered"] = "scheduled"
    eta: datetime | str
    route: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    route_history: list[dict] = Field(default_factory=list)
