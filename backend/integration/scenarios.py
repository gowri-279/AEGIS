"""Demo fixture presets mapped to existing P2/P3 assessment inputs."""

from typing import Any, Literal


FIXED_EVALUATION_TIME = "2026-10-23T14:30:00Z"

FixtureId = Literal["standard", "degraded", "critical_stale", "stress"]

FIXTURE_PRESETS: dict[str, dict[str, Any]] = {
    "standard": {
        "proposed_volume_m3": 200.0,
        "duration_seconds": 600.0,
        "scenario_id": "storage_and_recharge_demo",
        "wl_j3_failure_mode": None,
        "baseline_excess_volume_m3": 200.0,
    },
    "degraded": {
        "proposed_volume_m3": 200.0,
        "duration_seconds": 600.0,
        "scenario_id": "storage_and_recharge_demo",
        "wl_j3_failure_mode": "degraded",
        "baseline_excess_volume_m3": 200.0,
    },
    "critical_stale": {
        "proposed_volume_m3": 200.0,
        "duration_seconds": 600.0,
        "scenario_id": "storage_and_recharge_demo",
        "wl_j3_failure_mode": "stale",
        "baseline_excess_volume_m3": 200.0,
    },
    "stress": {
        "proposed_volume_m3": 900.0,
        "duration_seconds": 600.0,
        "scenario_id": "stress_demo",
        "wl_j3_failure_mode": None,
        "baseline_excess_volume_m3": 900.0,
    },
}


def resolve_assessment_inputs(
    *,
    fixture: str | None = None,
    fixture_id: str | None = None,
    proposed_volume_m3: float | None = None,
    diverted_volume: float | None = None,
    duration_seconds: float | None = None,
    duration: float | None = None,
    rainfall: float | None = None,
    intervention_assumptions: dict[str, Any] | None = None,
    recharge_eligibility: str | None = None,
    baseline_excess_volume_m3: float | None = None,
    scenario_id: str | None = None,
    wl_j3_failure_mode: str | None = None,
) -> dict[str, Any]:
    """Resolve frontend fixture IDs and aliases into P2/P3 workflow kwargs."""

    resolved_fixture = fixture or fixture_id or "standard"
    if resolved_fixture not in FIXTURE_PRESETS:
        raise ValueError(f"Unsupported fixture: {resolved_fixture}")

    preset = FIXTURE_PRESETS[resolved_fixture]
    volume = (
        proposed_volume_m3
        if proposed_volume_m3 is not None
        else diverted_volume
        if diverted_volume is not None
        else preset["proposed_volume_m3"]
    )
    resolved_duration = (
        duration_seconds
        if duration_seconds is not None
        else duration
        if duration is not None
        else preset["duration_seconds"]
    )
    failure = (
        wl_j3_failure_mode
        if wl_j3_failure_mode is not None
        else preset["wl_j3_failure_mode"]
    )
    baseline = (
        baseline_excess_volume_m3
        if baseline_excess_volume_m3 is not None
        else preset["baseline_excess_volume_m3"]
    )

    return {
        "fixture_id": resolved_fixture,
        "proposed_volume_m3": float(volume),
        "duration_seconds": float(resolved_duration),
        "wl_j3_failure_mode": failure,
        "recharge_eligibility": recharge_eligibility or "ineligible",
        "baseline_excess_volume_m3": float(baseline),
        "scenario_id": scenario_id or preset["scenario_id"],
        "rainfall": rainfall,
        "intervention_assumptions": intervention_assumptions,
    }
