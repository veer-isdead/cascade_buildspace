from statistics import mean

from backend.services.bottleneck_detector import hub_utilization


def build_kpi_snapshot(hubs: list[dict], shipments: list[dict]) -> dict:
    total_shipments = len(shipments)
    delayed_shipments = [shipment for shipment in shipments if shipment.get("status") in {"delayed", "delay_risk"}]
    average_processing_time = round(
        mean([hub.get("avg_processing_time", 0) for hub in hubs]) if hubs else 0,
        2,
    )
    average_utilization = round(
        mean([hub_utilization(hub) for hub in hubs]) if hubs else 0,
        4,
    )
    total_throughput = sum(hub.get("throughput_per_hour") or hub.get("shipment_rate", 0) for hub in hubs)

    return {
        "total_shipments": total_shipments,
        "average_processing_time": average_processing_time,
        "delay_rate": round((len(delayed_shipments) / total_shipments), 4) if total_shipments else 0,
        "hub_utilization": average_utilization,
        "throughput": total_throughput,
        "hub_breakdown": [
            {
                "hub_id": hub["id"],
                "name": hub["name"],
                "utilization": round(hub_utilization(hub), 4),
                "throughput": hub.get("throughput_per_hour") or hub.get("shipment_rate", 0),
                "avg_processing_time": hub.get("avg_processing_time", 0),
            }
            for hub in hubs
        ],
    }
