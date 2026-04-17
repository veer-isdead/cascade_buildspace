from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from backend.db import DatabaseManager, get_db
from backend.services.merchant_delivery_score import compute_mds, merchant_metrics_from_record
from backend.services.merchant_score_engine import calculate_merchant_score
from backend.services.performance_adjustment import normalize_tier
from backend.services.slot_pricing import generate_slot_board

router = APIRouter(prefix="/admin", tags=["Admin — Merchants"])


def _merchant_optimization_flags(merchant: dict) -> list[str]:
    return list(merchant.get("optimization_flags") or merchant.get("penalty_flags") or [])


class CapacitySimRequest(BaseModel):
    tier: str = Field(
        description="Simulated performance tier: priority | standard | optimization (legacy restricted maps to optimization)."
    )
    hub_id: str | None = None

    @field_validator("tier")
    @classmethod
    def _normalize_tier(cls, value: str) -> str:
        t = normalize_tier(value)
        if t not in ("priority", "standard", "optimization"):
            raise ValueError("tier must be priority, standard, or optimization")
        return t


def _synthetic_merchant_for_tier(tier: str) -> dict[str, Any]:
    """Fabricate metrics that land in the requested tier for simulation only."""
    t = normalize_tier(tier)
    presets = {
        "priority": {
            "forecast_accuracy": 92,
            "packaging_quality": 90,
            "dispatch_timeliness": 88,
            "volume_consistency": 86,
            "cancellation_rate": 4,
        },
        "standard": {
            "forecast_accuracy": 82,
            "packaging_quality": 78,
            "dispatch_timeliness": 80,
            "volume_consistency": 76,
            "cancellation_rate": 8,
        },
        "optimization": {
            "forecast_accuracy": 62,
            "packaging_quality": 58,
            "dispatch_timeliness": 55,
            "volume_consistency": 50,
            "cancellation_rate": 22,
        },
    }
    metrics = presets[t]
    score_result = calculate_merchant_score(metrics)
    return {
        "id": "sim-merchant",
        "merchant_id": f"SIM-{t.upper()}",
        "merchant_score": score_result["score"],
        **metrics,
    }


@router.get("/merchant-scores", summary="Merchant score monitoring for operations")
def list_merchant_scores(database: DatabaseManager = Depends(get_db)) -> dict:
    merchants = database.list_documents("merchants")
    rows = []
    for merchant in merchants:
        mds = compute_mds(merchant)
        flags = _merchant_optimization_flags(merchant)
        rows.append(
            {
                "merchant_id": merchant.get("merchant_id"),
                "internal_id": merchant.get("id"),
                "merchant_score": mds["score"],
                "tier_classification": mds["tier"],
                "score_tier": mds["tier"],
                "dispatch_reliability_percent": float(merchant.get("dispatch_success_rate", 94.0)),
                "optimization_flags": flags,
                "network_spike_signals": flags,
                "breakdown": mds["breakdown"],
            }
        )
    return {"merchants": rows}


@router.post("/simulate-merchant-capacity", summary="Preview slot allocation by performance tier")
def simulate_merchant_capacity(payload: CapacitySimRequest, database: DatabaseManager = Depends(get_db)) -> dict:
    hubs = database.list_documents("hubs")
    hub = next((h for h in hubs if h["id"] == payload.hub_id), None) if payload.hub_id else (hubs[0] if hubs else None)
    if not hub:
        return {"message": "No hub available.", "slots": [], "synthetic_merchant": None}

    tier = normalize_tier(payload.tier)
    synthetic = _synthetic_merchant_for_tier(tier)
    merchants = database.list_documents("merchants")
    reserved = {
        slot["slot_time"]
        for item in merchants
        for slot in item.get("booked_slots", [])
        if slot.get("hub_id") == hub["id"] and slot.get("status") == "booked"
    }
    slots = generate_slot_board(hub, reserved_slots=reserved, merchant=synthetic)
    return {
        "message": f"Simulated allocation for {tier} tier at {hub.get('name')}.",
        "hub_id": hub.get("id"),
        "synthetic_merchant": {
            "tier": tier,
            "score": synthetic["merchant_score"],
            "metrics": merchant_metrics_from_record(synthetic),
        },
        "slots": slots,
    }
