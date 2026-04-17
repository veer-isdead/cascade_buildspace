from backend.services.merchant_delivery_score import (
    compute_mds,
    peak_slot_times,
    price_multiplier_for_tier,
)
from backend.services.overload_predictor import capacity_percent
from backend.services.performance_adjustment import normalize_tier


def calculate_slot_price(base_price: float, hub_capacity_percent: float) -> float:
    if hub_capacity_percent <= 85:
        return round(base_price, 2)

    surcharge_multiplier = 1 + ((hub_capacity_percent - 85) / 100)
    return round(base_price * surcharge_multiplier, 2)


def generate_slot_board(hub: dict, reserved_slots: set[str] | None = None, merchant: dict | None = None) -> list[dict]:
    """
    Build slot board with hub congestion, peak windows, and performance-adjusted allocation.
    Priority: guaranteed peak access and 0.9x partner factor; Optimization: reduced peak under load, 1.15x factor.
    """
    reserved_slots = reserved_slots or set()
    utilization = capacity_percent(hub)
    price_anchor = calculate_slot_price(hub.get("slot_base_price", 850.0), utilization)
    peak_slots = peak_slot_times(utilization)
    slot_times = [f"{hour:02d}:00" for hour in range(8, 19)]

    mds = compute_mds(merchant)
    tier = normalize_tier(mds["tier"])
    mds_mult = price_multiplier_for_tier(tier)

    board: list[dict] = []
    for index, slot_time in enumerate(slot_times):
        peak_multiplier = 1.18 if slot_time in peak_slots else 1.0
        deal_multiplier = 0.92 if slot_time in {"15:00", "16:00"} and utilization < 90 else 1.0
        base_price = round(price_anchor * peak_multiplier * deal_multiplier + (index * 12), 2)
        price = round(base_price * mds_mult, 2)

        routing_priority = "fast" if tier == "priority" else "standard" if tier == "standard" else "flex"

        if slot_time in reserved_slots:
            status = "reserved"
        elif tier == "optimization" and utilization >= 75.0 and slot_time in peak_slots:
            status = "peak_locked"
        elif slot_time in peak_slots:
            status = "peak"
        elif deal_multiplier < 1:
            status = "deal"
        elif tier == "optimization":
            status = "delayed"
        else:
            status = "available"

        dispatch_note = None
        if tier == "optimization" and status not in {"reserved", "peak_locked"}:
            dispatch_note = "We may shift dispatch slightly into an adjacent off-peak window when hubs are warm."
        if tier == "priority" and status == "peak":
            dispatch_note = "Priority routing — this peak window is held for your tier."

        board.append(
            {
                "slot_time": slot_time,
                "status": status,
                "price": price,
                "hub_id": hub.get("id"),
                "hub_name": hub.get("name"),
                "routing_priority": routing_priority,
                "dispatch_note": dispatch_note,
                "mds_tier": tier,
                "mds_score": mds["score"],
            }
        )
    return board


def slot_entry_for_time(hub: dict, slot_time: str, reserved_slots: set[str], merchant: dict | None) -> dict | None:
    board = generate_slot_board(hub, reserved_slots=reserved_slots, merchant=merchant)
    return next((row for row in board if row["slot_time"] == slot_time), None)


def is_slot_bookable(entry: dict | None) -> bool:
    if not entry:
        return False
    return entry["status"] not in {"reserved", "peak_locked"}
