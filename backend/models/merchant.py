from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MerchantSlot(BaseModel):
    hub_id: str
    slot_time: str
    price: float
    shipment_count: int = 1
    status: Literal["booked", "completed", "cancelled"] = "booked"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Merchant(BaseModel):
    id: str
    merchant_id: str
    name: str
    company: str
    contact_email: str
    preferred_hub: str
    booked_slots: list[MerchantSlot] = Field(default_factory=list)
    merchant_score: float | None = None
    forecast_accuracy: float | None = None
    packaging_quality: float | None = None
    dispatch_timeliness: float | None = None
    volume_consistency: float | None = None
    cancellation_rate: float | None = None
    dispatch_success_rate: float | None = None
    optimization_flags: list[str] = Field(default_factory=list)
