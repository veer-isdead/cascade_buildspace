from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Hub(BaseModel):
    id: str
    code: str
    name: str
    region: str
    location: str
    capacity_total: int
    current_load: int
    truck_queue: int
    shipment_rate: int
    slot_base_price: float
    alert_threshold: float = 85.0
    status: Literal["NORMAL", "AT_RISK", "OVERLOAD"] = "NORMAL"
    alternative_hubs: list[str] = Field(default_factory=list)
    last_detection_time_ms: float = 0.0
    last_updated: datetime = Field(default_factory=datetime.utcnow)
