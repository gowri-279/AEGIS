
from typing import Any

from p3.models import CandidateEvaluation, ConstraintCheck


REQUIRED_CONSTRAINTS = {
    "storage",
    "edge_capacity",
    "j3_water_level",
    "recharge_eligibility",
}


def check_storage(
    candidate_id: str,
    proposed_volume_m3: float,
    available_storage_m3: float | None,
) -> ConstraintCheck:
    if available_storage_m3 is None:
        return ConstraintCheck(
            "storage", "not_evaluated", ["STORAGE_DATA_UNAVAILABLE"]
        )

    if proposed_volume_m3 <= available_storage_m3:
        return ConstraintCheck(
            "storage",
            "passed",
            details={
                "proposed_volume_m3": proposed_volume_m3,
                "available_storage_m3": available_storage_m3,
            },
        )

    return ConstraintCheck(
        "storage",
        "failed",
        ["INSUFFICIENT_STORAGE"],
        {
            "proposed_volume_m3": proposed_volume_m3,
            "available_storage_m3": available_storage_m3,
        },
    )


def check_edge_capacity(
    flow_m3_s: float,
    edge_capacity_m3_s: float | None,
) -> ConstraintCheck:
    if edge_capacity_m3_s is None or edge_capacity_m3_s <= 0:
        return ConstraintCheck(
            "edge_capacity", "not_evaluated", ["EDGE_CAPACITY_UNAVAILABLE"]
        )

    if flow_m3_s <= edge_capacity_m3_s:
        return ConstraintCheck(
            "edge_capacity",
            "passed",
            details={
                "flow_m3_s": flow_m3_s,
                "capacity_m3_s": edge_capacity_m3_s,
            },
        )

    return ConstraintCheck(
        "edge_capacity",
        "failed",
        ["EDGE_CAPACITY_EXCEEDED"],
        {"flow_m3_s": flow_m3_s, "capacity_m3_s": edge_capacity_m3_s},
    )


def check_j3_water_level(
    water_depth_m: float | None,
    maximum_depth_m: float = 0.80,
    usable: bool = True,
) -> ConstraintCheck:
    if not usable or water_depth_m is None:
        return ConstraintCheck(
            "j3_water_level", "not_evaluated", ["J3_WATER_LEVEL_UNAVAILABLE"]
        )

    if water_depth_m < maximum_depth_m:
        return ConstraintCheck(
            "j3_water_level",
            "passed",
            details={
                "water_depth_m": water_depth_m,
                "maximum_depth_m": maximum_depth_m,
            },
        )

    return ConstraintCheck(
        "j3_water_level",
        "failed",
        ["J3_WATER_LEVEL_LIMIT_REACHED"],
        {
            "water_depth_m": water_depth_m,
            "maximum_depth_m": maximum_depth_m,
        },
    )


def check_recharge_eligibility(
    candidate_id: str,
    eligibility: str | None,
) -> ConstraintCheck:
    if eligibility == "eligible":
        return ConstraintCheck("recharge_eligibility", "passed")

    if eligibility == "ineligible":
        return ConstraintCheck(
            "recharge_eligibility", "failed", ["RECHARGE_INELIGIBLE"]
        )

    return ConstraintCheck(
        "recharge_eligibility",
        "not_evaluated",
        ["RECHARGE_ELIGIBILITY_UNAVAILABLE"],
    )



def evaluate_feasibility(
    candidate_id: str,
    checks: list[ConstraintCheck],
) -> CandidateEvaluation:
    required_constraints = {
        "storage",
        "edge_capacity",
        "j3_water_level",
    }

    # Recharge eligibility is required only for the recharge candidate.
    if candidate_id == "C-R1":
        required_constraints.add("recharge_eligibility")

    by_name = {check.constraint: check for check in checks}

    feasible = all(
        by_name.get(name) is not None
        and by_name[name].status == "passed"
        for name in required_constraints
    )

    return CandidateEvaluation(
        candidate_id=candidate_id,
        checks=checks,
        feasible=feasible,
    )

