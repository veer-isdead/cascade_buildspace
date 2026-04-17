from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Hub(BaseModel):
    id: str
    code: str
    name: str
    region: str
    location: str
    capacity: int
    current_load: int
    truck_queue: int
    throughput_per_hour: int
    avg_processing_time: float
    slot_base_price: float
    alert_threshold: float = 85.0
    status: Literal["NORMAL", "HIGH_LOAD", "BOTTLENECK"] = "NORMAL"
    alternative_hubs: list[str] = Field(default_factory=list)
    capacity_total: int | None = None
    shipment_rate: int | None = None
    last_detection_time_ms: float = 0.0
    last_updated: datetime = Field(default_factory=datetime.utcnow)
