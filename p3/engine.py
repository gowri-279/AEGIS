
from typing import Any

from p3.constraints import (
    check_edge_capacity,
    check_j3_water_level,
    check_recharge_eligibility,
    check_storage,
    evaluate_feasibility,
)
from p3.models import CandidateEvaluation
from p3.network_metrics import (
    calculate_modeled_network_utilization,
    calculate_remaining_storage,
)


def evaluate_candidate(
    candidate_id: str,
    proposed_volume_m3: float,
    duration_seconds: float,
    available_storage_m3: float | None,
    edge_capacity_m3_s: float | None,
    j3_water_depth_m: float | None,
    recharge_eligibility: str | None,
    j3_water_level_usable: bool = True,
    occupied_storage_m3: float | None = None,
    affected_edges: list[dict[str, Any]] | None = None,
) -> CandidateEvaluation:
    """Evaluate constraints and calculate available network metrics."""

    if duration_seconds <= 0:
        raise ValueError("Duration must be positive")

    if proposed_volume_m3 < 0:
        raise ValueError("Proposed volume cannot be negative")

    flow_m3_s = proposed_volume_m3 / duration_seconds
    checks = []

    if candidate_id != "C-R1":
        checks.append(
            check_storage(
                candidate_id,
                proposed_volume_m3,
                available_storage_m3,
            )
        )

    checks.append(
        check_edge_capacity(
            flow_m3_s,
            edge_capacity_m3_s,
        )
    )

    checks.append(
        check_j3_water_level(
            j3_water_depth_m,
            maximum_depth_m=0.80,
            usable=j3_water_level_usable,
        )
    )

    if candidate_id == "C-R1":
        checks.append(
            check_recharge_eligibility(
                candidate_id,
                recharge_eligibility,
            )
        )

    result = evaluate_feasibility(candidate_id, checks)

    # Use all supplied affected edges when available.
    # Otherwise, use the single edge from the existing demo interface.
    if affected_edges is None:
        edges_to_evaluate = []

        if edge_capacity_m3_s is not None:
            edges_to_evaluate.append(
                {
                    "post_intervention_flow_m3_s": flow_m3_s,
                    "capacity_m3_s": edge_capacity_m3_s,
                }
            )
    else:
        edges_to_evaluate = affected_edges

    result.modeled_network_utilization = (
        calculate_modeled_network_utilization(edges_to_evaluate)
    )

    # Available storage + occupied storage = total capacity.
    total_capacity_m3 = None

    if (
        available_storage_m3 is not None
        and occupied_storage_m3 is not None
    ):
        total_capacity_m3 = (
            available_storage_m3 + occupied_storage_m3
        )

    result.remaining_storage = calculate_remaining_storage(
        total_capacity_m3,
        occupied_storage_m3,
    )

    return result


def generate_demo_candidates(
    proposed_volume_m3: float,
    duration_seconds: float,
    j3_water_depth_m: float | None,
    recharge_eligibility: str | None,
    j3_water_level_usable: bool = True,
) -> list[CandidateEvaluation]:
    """Generate candidates for the standard synthetic fixture."""

    if duration_seconds <= 0:
        raise ValueError("Duration must be positive")

    candidate_config = [
        # ID, available storage, occupied storage, edge capacity, eligibility
        ("C-L1", 100.0, 900.0, 0.5, None),
        ("C-R1", None, None, 0.5, recharge_eligibility),
        ("C-L2", 800.0, 200.0, 0.5, None),
    ]

    results = []

    for (
        candidate_id,
        available_storage,
        occupied_storage,
        edge_capacity,
        eligibility,
    ) in candidate_config:
        results.append(
            evaluate_candidate(
                candidate_id=candidate_id,
                proposed_volume_m3=proposed_volume_m3,
                duration_seconds=duration_seconds,
                available_storage_m3=available_storage,
                edge_capacity_m3_s=edge_capacity,
                j3_water_depth_m=j3_water_depth_m,
                recharge_eligibility=eligibility,
                j3_water_level_usable=j3_water_level_usable,
                occupied_storage_m3=occupied_storage,
            )
        )

    return results
