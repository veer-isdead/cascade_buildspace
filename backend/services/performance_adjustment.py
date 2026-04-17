"""Performance Adjustment System — capacity and pricing signals without punitive framing."""

from __future__ import annotations

from typing import Any, Literal

TierName = Literal["priority", "standard", "optimization"]


def normalize_tier(tier: str) -> TierName:
    """Map legacy records to current tier names."""
    t = (tier or "standard").strip().lower()
    if t == "restricted":
        return "optimization"
    if t in ("priority", "standard", "optimization"):
        return t  # type: ignore[return-value]
    return "standard"


def allocation_tier_label(tier: str) -> str:
    t = normalize_tier(tier)
    return {
        "priority": "Priority Allocation",
        "standard": "Standard Allocation",
        "optimization": "Optimization Allocation",
    }[t]


def capacity_access_status(tier: str, peak_gate_live: bool, hub_util_percent: float | None) -> str:
    t = normalize_tier(tier)
    util = hub_util_percent if hub_util_percent is not None else 0.0
    if t == "priority":
        return "Full peak access with partner capacity reserved for your tier."
    if t == "standard":
        if peak_gate_live:
            return "Standard peak access available; network is busy — book early for best windows."
        return "Standard peak access available."
    if peak_gate_live or util >= 75.0:
        return "Peak windows are being adjusted for network balance; off-peak and adjacent slots remain open."
    return "Optimization tier: focus on off-peak and flexible windows while the network is calmer."


def recommended_dispatch_windows() -> list[str]:
    """Guidance copy for merchants in the optimization band (merchant-facing)."""
    return [
        "2:00 PM – 6:00 PM — off-peak corridor with steadier hub flow",
        "9:00 PM – 12:00 AM — late-evening window with lighter queue pressure",
    ]


def improvement_insights_payload(score: float, breakdown: dict[str, Any]) -> dict[str, Any] | None:
    if score >= 70:
        return None
    bullets: list[str] = []
    if breakdown.get("packaging_quality", 100) < 75:
        bullets.append("Packaging compliance")
    if breakdown.get("dispatch_timeliness", 100) < 75:
        bullets.append("Dispatch timeliness")
    if breakdown.get("forecast_accuracy", 100) < 80:
        bullets.append("Forecast accuracy")
    if not bullets:
        bullets = ["Packaging compliance", "Dispatch timeliness", "Forecast accuracy"]
    return {
        "title": "Network Optimization Notice",
        "lead": "Recent dispatch patterns indicate opportunities to improve reliability.",
        "body": "Improving the following metrics can unlock Priority Allocation during peak periods:",
        "bullets": bullets,
    }


def recovery_plan_payload() -> dict[str, Any]:
    return {
        "title": "Score Recovery Plan",
        "subtitle": "Complete the following for 5 dispatch cycles:",
        "checklist": [
            "Dispatch within scheduled window",
            "Maintain forecast accuracy above 80%",
            "Follow packaging guidelines",
        ],
        "estimated_score_improvement_points": 8,
        "footnote": "Progress updates automatically as signals stabilize — no extra paperwork.",
    }


def performance_adjustment_summary(
    tier: str, score: float, peak_gate_live: bool, util: float | None, price_multiplier: float
) -> dict[str, Any]:
    """Single object for dashboards describing soft adjustments."""
    t = normalize_tier(tier)
    return {
        "system_name": "Performance Adjustment System",
        "tier": t,
        "allocation_label": allocation_tier_label(tier),
        "capacity_access_status": capacity_access_status(tier, peak_gate_live, util),
        "routing_note": "Fastest routing priority"
        if t == "priority"
        else "Balanced routing"
        if t == "standard"
        else "Dispatch may shift to off-peak windows when the network is warm",
        "price_adjustment_factor": price_multiplier,
    }
