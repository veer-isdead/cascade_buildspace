from time import perf_counter


def capacity_percent(hub: dict) -> float:
    total_capacity = max(hub.get("capacity_total", 0), 1)
    current_load = hub.get("current_load", 0)
    return round((current_load / total_capacity) * 100, 2)


def calculate_overload_score(truck_queue: float, shipment_rate: float, hub_capacity: float) -> float:
    return round((truck_queue * 0.4) + (shipment_rate * 0.4) + (hub_capacity * 0.2), 2)


def predict_overload(hub: dict) -> dict:
    started = perf_counter()
    hub_capacity = capacity_percent(hub)
    overload_score = calculate_overload_score(
        truck_queue=hub.get("truck_queue", 0),
        shipment_rate=hub.get("shipment_rate", 0),
        hub_capacity=hub_capacity,
    )

    if overload_score > 80:
        status = "OVERLOAD"
    elif overload_score > 60 or hub_capacity > 85:
        status = "AT_RISK"
    else:
        status = "NORMAL"

    detection_time_ms = round((perf_counter() - started) * 1000, 3)
    return {
        "hub_id": hub.get("id"),
        "hub_name": hub.get("name"),
        "overload_score": overload_score,
        "status": status,
        "hub_capacity_percent": hub_capacity,
        "detection_time_ms": detection_time_ms,
    }
