
from dataclasses import dataclass


@dataclass
class SimulationResult:
    scenario_id: str
    proposed_volume_m3: float
    duration_seconds: float
    proposed_flow_m3_s: float
    selected_candidate_id: str | None
    residual_excess_volume_m3: float | None


@dataclass
class BaselineComparison:
    baseline_residual_excess_volume_m3: float
    intervention_residual_excess_volume_m3: float | None
    excess_volume_reduction_m3: float | None


def simulate_intervention(
    scenario_id: str,
    proposed_volume_m3: float,
    duration_seconds: float,
    selected_candidate_id: str | None,
    baseline_excess_volume_m3: float,
) -> SimulationResult:
    """Calculate illustrative volume bookkeeping for an intervention."""

    if duration_seconds <= 0:
        raise ValueError("duration_seconds must be greater than zero")

    if proposed_volume_m3 < 0:
        raise ValueError("proposed_volume_m3 cannot be negative")

    if baseline_excess_volume_m3 < 0:
        raise ValueError("baseline_excess_volume_m3 cannot be negative")

    flow = proposed_volume_m3 / duration_seconds

    if selected_candidate_id is None:
        residual_excess_m3 = baseline_excess_volume_m3
    else:
        residual_excess_m3 = max(
            0.0,
            baseline_excess_volume_m3 - proposed_volume_m3,
        )

    return SimulationResult(
        scenario_id=scenario_id,
        proposed_volume_m3=proposed_volume_m3,
        duration_seconds=duration_seconds,
        proposed_flow_m3_s=flow,
        selected_candidate_id=selected_candidate_id,
        residual_excess_volume_m3=residual_excess_m3,
    )


def compare_with_baseline(
    baseline_residual_excess_volume_m3: float,
    intervention_residual_excess_volume_m3: float | None,
) -> BaselineComparison:
    if baseline_residual_excess_volume_m3 < 0:
        raise ValueError("baseline residual volume cannot be negative")

    if (
        intervention_residual_excess_volume_m3 is not None
        and intervention_residual_excess_volume_m3 < 0
    ):
        raise ValueError("intervention residual volume cannot be negative")

    reduction = (
        None
        if intervention_residual_excess_volume_m3 is None
        else (
            baseline_residual_excess_volume_m3
            - intervention_residual_excess_volume_m3
        )
    )

    return BaselineComparison(
        baseline_residual_excess_volume_m3=baseline_residual_excess_volume_m3,
        intervention_residual_excess_volume_m3=intervention_residual_excess_volume_m3,
        excess_volume_reduction_m3=reduction,
    )
