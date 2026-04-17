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
