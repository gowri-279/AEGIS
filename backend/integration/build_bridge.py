"""Minimal Build bridge over the existing P1 → P2 → P3 assessment pipeline.

Preserves the caller's active design verbatim. Does not invent V2 display metrics.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from backend.integration.scenarios import FIXED_EVALUATION_TIME, resolve_assessment_inputs
from backend.integration.workflow import run_integrated_assessment
from p2.sensor_simulator import simulate_readings


# Map Build rainfall labels onto existing assessment fixtures.
RAINFALL_TO_FIXTURE = {
    "normal": "standard",
    "normal rainfall": "standard",
    "standard": "standard",
    "heavy": "stress",
    "heavy rainfall": "stress",
    "extreme": "stress",
    "extreme rainfall": "stress",
    "degraded": "degraded",
    "critical_stale": "critical_stale",
    "stress": "stress",
}


def _fixture_for_rainfall(rainfall_scenario: str | None, explicit: str | None) -> str:
    if explicit:
        return explicit
    key = (rainfall_scenario or "standard").strip().lower()
    return RAINFALL_TO_FIXTURE.get(key, "standard")


def run_build_simulation(payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluate the CURRENT active design context via P1/P2/P3.

    Returns the live assessment plus an echoed active_design fingerprint so the
    frontend can verify the simulation did not revert to a default topology.
    """
    active_design = payload.get("active_design")
    if not isinstance(active_design, dict):
        raise ValueError("active_design is required")

    nodes = active_design.get("nodes") or []
    links = active_design.get("links") or []
    if not isinstance(nodes, list) or not isinstance(links, list):
        raise ValueError("active_design.nodes and active_design.links are required")

    fixture = _fixture_for_rainfall(
        payload.get("rainfall_scenario"),
        payload.get("fixture"),
    )
    params = resolve_assessment_inputs(
        fixture=fixture,
        proposed_volume_m3=payload.get("proposed_volume_m3"),
        diverted_volume=payload.get("diverted_volume"),
        duration_seconds=payload.get("duration_seconds"),
        duration=payload.get("duration"),
        scenario_id=payload.get("scenario_id"),
        rainfall=payload.get("rainfall"),
        intervention_assumptions={
            "mode": payload.get("mode"),
            "selected_candidate": payload.get("selected_candidate"),
            "terrain_id": payload.get("terrain_id"),
            "objectives": payload.get("objectives"),
            "constraints": payload.get("constraints"),
            "revision": payload.get("revision"),
        },
    )

    failure_modes = (
        {"WL-J3": params["wl_j3_failure_mode"]}
        if params["wl_j3_failure_mode"] is not None
        else None
    )
    readings = simulate_readings(
        failure_modes=failure_modes,
        now=FIXED_EVALUATION_TIME,
    )
    assessment = run_integrated_assessment(
        readings,
        proposed_volume_m3=params["proposed_volume_m3"],
        duration_seconds=params["duration_seconds"],
        recharge_eligibility=params["recharge_eligibility"],
        baseline_excess_volume_m3=params["baseline_excess_volume_m3"],
        scenario_id=params["scenario_id"],
        rainfall=params["rainfall"],
        intervention_assumptions=params["intervention_assumptions"],
    )
    assessment["fixture_id"] = params["fixture_id"]

    recommendation = assessment.get("recommendation") or {}
    warnings: list[str] = []
    reason_codes = recommendation.get("reason_codes") or []
    if "CRITICAL_WL_J3_UNUSABLE" in reason_codes:
        warnings.append("Critical WL-J3 observation is unusable; recommendation abstained.")
    if "J3_WATER_LEVEL_UNAVAILABLE" in reason_codes:
        warnings.append("J3 water-level data unavailable for hard-constraint evaluation.")
    if recommendation.get("recommendation_status") == "no_feasible_candidate":
        warnings.append("No feasible intervention candidate under the selected rainfall stress.")

    # Fingerprint proves the response is bound to the applied design, not a default network.
    design_fingerprint = {
        "node_ids": [n.get("id") for n in nodes if isinstance(n, dict)],
        "link_ids": [link.get("id") for link in links if isinstance(link, dict)],
        "revision": payload.get("revision"),
        "selected_candidate": payload.get("selected_candidate"),
        "mode": payload.get("mode"),
    }

    return {
        "status": "ok",
        "fixture_id": params["fixture_id"],
        "rainfall_scenario": payload.get("rainfall_scenario"),
        "active_design": deepcopy(active_design),
        "design_fingerprint": design_fingerprint,
        "assessment": assessment,
        "recommendation_status": recommendation.get("recommendation_status"),
        "selected_candidate_id": recommendation.get("selected_candidate_id"),
        "reason_codes": reason_codes,
        "engineering_warnings": warnings,
        # Explicitly empty: frontend retains authored V2 display metrics.
        "display_metrics_source": "frontend_v2",
    }


# In-memory finalized networks for demo persistence (no database).
_FINALIZED: dict[str, dict[str, Any]] = {}


def finalize_build_network(payload: dict[str, Any]) -> dict[str, Any]:
    """Store a finalized active design in memory for demo handoff."""
    network_id = payload.get("network_id")
    active_design = payload.get("active_design")
    if not network_id or not isinstance(active_design, dict):
        raise ValueError("network_id and active_design are required")
    entry = {
        "network_id": network_id,
        "mode": payload.get("mode"),
        "revision": payload.get("revision"),
        "selected_candidate": payload.get("selected_candidate"),
        "active_design": deepcopy(active_design),
        "status": "finalized",
    }
    _FINALIZED[str(network_id)] = entry
    return entry


def list_finalized_networks() -> list[dict[str, Any]]:
    return list(_FINALIZED.values())
