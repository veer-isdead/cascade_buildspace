"""Merchant Delivery Score (MDS) — integrates merchant_score_engine with hub capacity gates."""

from __future__ import annotations

from typing import Any

from backend.services.merchant_score_engine import calculate_merchant_score
from backend.services.overload_predictor import capacity_percent
from backend.services.performance_adjustment import (
    allocation_tier_label,
    capacity_access_status,
    improvement_insights_payload,
    normalize_tier,
    performance_adjustment_summary,
    recovery_plan_payload,
    recommended_dispatch_windows,
)

PEAK_GATE_UTIL_PERCENT = 75.0


def merchant_metrics_from_record(merchant: dict | None) -> dict[str, float]:
    """Pull MDS component metrics from a merchant document with sensible demo defaults."""
    if not merchant:
        return {
            "forecast_accuracy": 78.0,
            "packaging_quality": 80.0,
            "dispatch_timeliness": 82.0,
            "volume_consistency": 75.0,
            "cancellation_rate": 10.0,
        }
    return {
        "forecast_accuracy": float(merchant.get("forecast_accuracy", 78)),
        "packaging_quality": float(merchant.get("packaging_quality", 80)),
        "dispatch_timeliness": float(merchant.get("dispatch_timeliness", 82)),
        "volume_consistency": float(merchant.get("volume_consistency", 75)),
        "cancellation_rate": float(merchant.get("cancellation_rate", 10)),
    }


def tier_display_name(tier: str) -> str:
    t = normalize_tier(tier)
    return {
        "priority": "Priority partner",
        "standard": "Standard partner",
        "optimization": "Optimization partner",
    }[t]


def compute_mds(merchant: dict | None) -> dict[str, Any]:
    """Full MDS summary including breakdown for dashboards."""
    metrics = merchant_metrics_from_record(merchant)
    result = calculate_merchant_score(metrics)
    tier = normalize_tier(result["tier"])
    return {
        "score": result["score"],
        "tier": tier,
        "tier_label": tier_display_name(tier),
        "metrics": metrics,
        "breakdown": {
            "forecast_accuracy": metrics["forecast_accuracy"],
            "packaging_quality": metrics["packaging_quality"],
            "dispatch_timeliness": metrics["dispatch_timeliness"],
            "volume_consistency": metrics["volume_consistency"],
            "cancellation_rate_percent": metrics["cancellation_rate"],
        },
    }


def price_multiplier_for_tier(tier: str) -> float:
    """Performance-based pricing adjustment (partner framing)."""
    t = normalize_tier(tier)
    if t == "priority":
        return 0.9
    if t == "standard":
        return 1.0
    return 1.15


def peak_slot_times(utilization: float) -> set[str]:
    return {"08:00", "11:00", "14:00", "17:00"} if utilization > 70 else {"10:00", "15:00"}


def mds_public_payload(merchant: dict | None, hub: dict | None = None) -> dict[str, Any]:
    """API-friendly MDS block for merchant desk and dispatch flows (non-punitive copy)."""
    summary = compute_mds(merchant)
    tier = summary["tier"]
    mult = price_multiplier_for_tier(tier)
    util = round(capacity_percent(hub), 2) if hub else None
    gate_live = bool(
        hub is not None
        and util is not None
        and util >= PEAK_GATE_UTIL_PERCENT
        and summary["score"] < 70
    )
    insights = improvement_insights_payload(summary["score"], summary["breakdown"])
    adj = performance_adjustment_summary(tier, summary["score"], gate_live, util, mult)
    payload: dict[str, Any] = {
        "score": summary["score"],
        "tier": tier,
        "tier_label": summary["tier_label"],
        "allocation_tier_label": allocation_tier_label(tier),
        "capacity_access_status": capacity_access_status(tier, gate_live, util),
        "price_multiplier": mult,
        "hub_utilization_percent": util,
        "peak_network_gate_live": gate_live,
        "peak_gate_util_threshold": PEAK_GATE_UTIL_PERCENT,
        "breakdown": summary["breakdown"],
        "score_to_tier": "Performance shapes allocation: ≥85 Priority, 70–84 Standard, under 70 Optimization.",
        "performance_adjustment": adj,
        "improvement_insights": insights,
        "recovery_plan": recovery_plan_payload(),
        "recommended_dispatch_windows": recommended_dispatch_windows() if tier == "optimization" else [],
    }
    return payload
