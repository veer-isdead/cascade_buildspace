"""Merchant Delivery Score (MDS) engine — weighted reliability score for capacity partnership."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


class MerchantScoreResult(TypedDict):
    score: float
    tier: Literal["priority", "standard", "optimization"]


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def calculate_merchant_score(merchant_metrics: dict[str, Any] | None) -> MerchantScoreResult:
    """
    MDS = 0.30*forecast_accuracy + 0.25*packaging_quality + 0.20*dispatch_timeliness
          + 0.15*volume_consistency + 0.10*(100 - cancellation_rate)

    cancellation_rate is stored as a percentage 0–100 (e.g. 8 means 8%).
    """
    metrics = merchant_metrics or {}
    forecast_accuracy = _clamp(float(metrics.get("forecast_accuracy", 0)))
    packaging_quality = _clamp(float(metrics.get("packaging_quality", 0)))
    dispatch_timeliness = _clamp(float(metrics.get("dispatch_timeliness", 0)))
    volume_consistency = _clamp(float(metrics.get("volume_consistency", 0)))
    cancellation_rate = _clamp(float(metrics.get("cancellation_rate", 0)))

    score = round(
        0.30 * forecast_accuracy
        + 0.25 * packaging_quality
        + 0.20 * dispatch_timeliness
        + 0.15 * volume_consistency
        + 0.10 * (100.0 - cancellation_rate),
        1,
    )

    if score >= 85:
        tier: Literal["priority", "standard", "optimization"] = "priority"
    elif score >= 70:
        tier = "standard"
    else:
        tier = "optimization"

    return MerchantScoreResult(score=score, tier=tier)


# CamelCase alias for parity with product / integration specs
calculateMerchantScore = calculate_merchant_score
