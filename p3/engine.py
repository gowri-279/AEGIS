from typing import Any

from backend.network.fixtures import build_demo_network
from p3.constraints import (
    check_edge_capacity,
    check_j3_water_level,
    check_recharge_eligibility,
    check_storage,
    evaluate_feasibility,
)
from p3.models import CandidateEvaluation, ConstraintCheck
from p3.network_metrics import (
    calculate_modeled_network_utilization,
    calculate_remaining_storage,
)


def check_candidate_limit(
    candidate_id: str,
    flow_m3_s: float,
    candidate_limit_m3_s: float | None,
) -> ConstraintCheck:
    """Check a candidate-level flow limit separately from physical capacity."""

    details = {
        "candidate_id": candidate_id,
        "flow_m3_s": flow_m3_s,
        "candidate_limit_m3_s": candidate_limit_m3_s,
    }

    if candidate_limit_m3_s is None or candidate_limit_m3_s <= 0:
        return ConstraintCheck(
            constraint="candidate_flow_limit",
            status="not_evaluated",
            reason_codes=["CANDIDATE_LIMIT_UNAVAILABLE"],
            details=details,
        )

    if flow_m3_s <= candidate_limit_m3_s:
        return ConstraintCheck(
            constraint="candidate_flow_limit",
            status="passed",
            details=details,
        )

    return ConstraintCheck(
        constraint="candidate_flow_limit",
        status="failed",
        reason_codes=["CANDIDATE_FLOW_LIMIT_EXCEEDED"],
        details=details,
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
    candidate_limit_m3_s: float | None = None,
) -> CandidateEvaluation:
    """Evaluate candidate constraints and calculate supported network metrics."""

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

    # Check physical capacity when it is known.
    # If unavailable, keep it not evaluated only when no candidate limit exists.
    if edge_capacity_m3_s is not None:
        checks.append(
            check_edge_capacity(flow_m3_s, edge_capacity_m3_s)
        )
    elif candidate_limit_m3_s is None:
        checks.append(
            check_edge_capacity(flow_m3_s, None)
        )

    # Candidate-level limits are not physical edge capacities.
    if candidate_limit_m3_s is not None:
        checks.append(
            check_candidate_limit(
                candidate_id,
                flow_m3_s,
                candidate_limit_m3_s,
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

    # Only calculate utilization from known physical edge capacities.
    result.modeled_network_utilization = (
        calculate_modeled_network_utilization(affected_edges or [])
    )

    # Do not infer missing total capacity or occupied storage.
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
    """Evaluate candidates using the canonical P1 network fixture."""

    if duration_seconds <= 0:
        raise ValueError("Duration must be positive")

    network = build_demo_network()
    nodes = {node.node_id: node for node in network.nodes}

    candidate_to_node = {
        "C-L1": "L1",
        "C-R1": "R1",
        "C-L2": "L2",
    }

    results = []

    for candidate_id, node_id in candidate_to_node.items():
        node = nodes[node_id]
        candidate_limit_m3_s = None

        for edge in network.edges:
            if edge.capacity_constraint_candidate_id == candidate_id:
                candidate_limit_m3_s = (
                    edge.candidate_capacity_constraint_m3_s
                )
                break

        results.append(
            evaluate_candidate(
                candidate_id=candidate_id,
                proposed_volume_m3=proposed_volume_m3,
                duration_seconds=duration_seconds,
                available_storage_m3=node.available_storage_m3,
                edge_capacity_m3_s=None,
                j3_water_depth_m=j3_water_depth_m,
                recharge_eligibility=(
                    node.recharge_eligibility
                    if candidate_id == "C-R1"
                    else recharge_eligibility
                ),
                j3_water_level_usable=j3_water_level_usable,
                occupied_storage_m3=node.initial_occupied_storage_m3,
                affected_edges=[],
                candidate_limit_m3_s=candidate_limit_m3_s,
            )
        )

    return results