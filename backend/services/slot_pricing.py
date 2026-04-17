from backend.services.overload_predictor import capacity_percent


def calculate_slot_price(base_price: float, hub_capacity_percent: float) -> float:
    if hub_capacity_percent <= 85:
        return round(base_price, 2)

    surcharge_multiplier = 1 + ((hub_capacity_percent - 85) / 100)
    return round(base_price * surcharge_multiplier, 2)


def generate_slot_board(hub: dict, reserved_slots: set[str] | None = None) -> list[dict]:
    reserved_slots = reserved_slots or set()
    utilization = capacity_percent(hub)
    price_anchor = calculate_slot_price(hub.get("slot_base_price", 850.0), utilization)
    peak_slots = {"08:00", "11:00", "14:00", "17:00"} if utilization > 70 else {"10:00", "15:00"}
    slot_times = [f"{hour:02d}:00" for hour in range(8, 19)]

    board: list[dict] = []
    for index, slot_time in enumerate(slot_times):
        peak_multiplier = 1.18 if slot_time in peak_slots else 1.0
        deal_multiplier = 0.92 if slot_time in {"15:00", "16:00"} and utilization < 90 else 1.0
        price = round(price_anchor * peak_multiplier * deal_multiplier + (index * 12), 2)

        if slot_time in reserved_slots:
            status = "reserved"
        elif slot_time in peak_slots:
            status = "peak"
        elif deal_multiplier < 1:
            status = "deal"
        else:
            status = "available"

        board.append(
            {
                "slot_time": slot_time,
                "status": status,
                "price": price,
                "hub_id": hub.get("id"),
                "hub_name": hub.get("name"),
            }
        )
    return board
