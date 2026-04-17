from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.db import DatabaseManager, get_db
from backend.services.overload_predictor import capacity_percent
from backend.services.slot_pricing import calculate_slot_price, generate_slot_board


router = APIRouter(tags=["Merchants"])


class BookSlotRequest(BaseModel):
    merchant_id: str
    hub_id: str
    slot_time: str
    shipment_count: int = 1


@router.post("/book-slot", summary="Book a shipment slot for a merchant")
def book_slot(payload: BookSlotRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    merchant = database.find_one("merchants", {"merchant_id": payload.merchant_id}) or database.find_one(
        "merchants", {"id": payload.merchant_id}
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found.")

    hub = database.find_one("hubs", {"id": payload.hub_id})
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found.")

    all_merchants = database.list_documents("merchants")
    reserved_slots = {
        slot["slot_time"]
        for item in all_merchants
        for slot in item.get("booked_slots", [])
        if slot.get("hub_id") == payload.hub_id and slot.get("status") == "booked"
    }
    if payload.slot_time in reserved_slots:
        raise HTTPException(status_code=409, detail="Selected slot is already reserved.")

    slot_price = calculate_slot_price(hub.get("slot_base_price", 0.0), capacity_percent(hub))
    slot_record = {
        "hub_id": payload.hub_id,
        "slot_time": payload.slot_time,
        "price": slot_price,
        "shipment_count": payload.shipment_count,
        "status": "booked",
    }
    merchant.setdefault("booked_slots", []).append(slot_record)
    database.replace_one("merchants", {"id": merchant["id"]}, merchant)

    system_state = database.find_one("system_state", {"id": "system-state"}) or {}
    system_state["total_shipments_processed"] = system_state.get("total_shipments_processed", 0) + payload.shipment_count
    database.replace_one("system_state", {"id": "system-state"}, system_state)

    return {"message": "Shipment slot booked successfully.", "booking": slot_record, "merchant": merchant}


@router.get("/merchant-slots", summary="Get available merchant slots and existing bookings")
def get_merchant_slots(
    merchant_id: str | None = Query(default=None),
    hub_id: str | None = Query(default=None),
    database: DatabaseManager = Depends(get_db),
) -> dict:
    merchants = database.list_documents("merchants")
    hubs = database.list_documents("hubs")
    selected_hub = next((hub for hub in hubs if hub["id"] == hub_id), None) if hub_id else hubs[0] if hubs else None

    reserved_slots = {
        slot["slot_time"]
        for merchant in merchants
        for slot in merchant.get("booked_slots", [])
        if selected_hub and slot.get("hub_id") == selected_hub["id"] and slot.get("status") == "booked"
    }
    slots = generate_slot_board(selected_hub, reserved_slots=reserved_slots) if selected_hub else []

    selected_merchant = None
    if merchant_id:
        selected_merchant = next(
            (merchant for merchant in merchants if merchant["merchant_id"] == merchant_id or merchant["id"] == merchant_id),
            None,
        )

    return {
        "active_hub": selected_hub,
        "slots": slots,
        "merchant": selected_merchant,
        "bookings": selected_merchant.get("booked_slots", []) if selected_merchant else [],
        "merchants": merchants,
    }
