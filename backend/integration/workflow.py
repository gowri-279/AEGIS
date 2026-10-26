"""Orchestrate P2 sensor assessment, P3 decisions, and canonical assembly."""

from dataclasses import asdict

from backend.integration.assembler import assemble_canonical_response
from backend.network.fixtures import build_demo_network
from backend.network.serialization import serialize_network
from p2.risk_assessment import assess_network, UNUSABLE_STATUSES
from p3.decision import decide_recommendation
from p3.engine import generate_demo_candidates
from p3.simulation import compare_with_baseline, simulate_intervention


def run_integrated_assessment(
    readings: list[dict],
    *,
    proposed_volume_m3: float,
    duration_seconds: float,
    recharge_eligibility: str | None,
    baseline_excess_volume_m3: float,
    scenario_id: str = "storage_and_recharge_demo",
) -> dict:
    """Run the P2 -> P3 -> canonical-response workflow."""

    # P2 is authoritative for sensor usability and risk findings.
    p2_result = assess_network(readings)
    readings_by_id = {item["sensor_id"]: item for item in readings}
    wl_j3 = readings_by_id.get("WL-J3")

    j3_usable = (
        p2_result["decision_gate"] != "abstained"
        and wl_j3 is not None
        and wl_j3.get("effective_value") is not None
        and wl_j3.get("quality_status") not in UNUSABLE_STATUSES
    )

    j3_depth = (
        wl_j3.get("effective_value")
        if wl_j3 is not None
        else None
    )

    # Keep candidate evaluations available for diagnostics, even on abstention.
    candidates = generate_demo_candidates(
        proposed_volume_m3=proposed_volume_m3,
        duration_seconds=duration_seconds,
        j3_water_depth_m=j3_depth,
        recharge_eligibility=recharge_eligibility,
        j3_water_level_usable=j3_usable,
    )

    ranking, recommendation = decide_recommendation(
        candidates,
        j3_water_level_usable=j3_usable,
    )

    # Preserve P2's specific gate reason when it is available.
    if p2_result["decision_gate"] == "abstained":
        gate_reason = p2_result["critical_constraints"]["WL-J3-depth"].get(
            "reason_code"
        )
        if gate_reason and gate_reason not in recommendation.reason_codes:
            recommendation.reason_codes.append(gate_reason)

    selected_id = recommendation.selected_candidate_id

    simulation = simulate_intervention(
        scenario_id=scenario_id,
        proposed_volume_m3=proposed_volume_m3,
        duration_seconds=duration_seconds,
        selected_candidate_id=selected_id,
        baseline_excess_volume_m3=baseline_excess_volume_m3,
    )

    comparison = compare_with_baseline(
        baseline_residual_excess_volume_m3=baseline_excess_volume_m3,
        intervention_residual_excess_volume_m3=(
            simulation.residual_excess_volume_m3
        ),
    )

    network = serialize_network(build_demo_network())

    return assemble_canonical_response(
        network=network,
        network_state={"sensors": readings},
        assessed_state=p2_result,
        scenario={
            "scenario_id": scenario_id,
            "proposed_volume_m3": proposed_volume_m3,
            "duration_seconds": duration_seconds,
            "recharge_eligibility": recharge_eligibility,
        },
        candidate_evaluations=[asdict(item) for item in candidates],
        simulation_result=asdict(simulation),
        baseline_comparison=asdict(comparison),
        ranking=ranking,
        recommendation=asdict(recommendation),
    )
