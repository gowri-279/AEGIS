
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ConstraintCheck:
    constraint: str
    status: str  # passed, failed, not_evaluated
    reason_codes: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class CandidateEvaluation:
    candidate_id: str
    checks: list[ConstraintCheck] = field(default_factory=list)
    feasible: bool = False
    modeled_network_utilization: Optional[float] = None
    remaining_storage: Optional[float] = None


@dataclass
class SimulationResult:
    scenario_id: str
    proposed_volume_m3: float
    duration_seconds: float
    proposed_flow_m3_s: float
    selected_candidate_id: Optional[str] = None
    residual_excess_volume_m3: Optional[float] = None


@dataclass
class BaselineComparison:
    baseline_residual_excess_volume_m3: float
    intervention_residual_excess_volume_m3: Optional[float]
    excess_volume_reduction_m3: Optional[float]


@dataclass
class Recommendation:
    status: str  # recommended, no_feasible_candidate, abstained
    selected_candidate_id: Optional[str]
    recommendation_scope: str = "limited_mvp_scope"
    safety_qualified: bool = False
    reason_codes: list[str] = field(default_factory=list)


@dataclass
class P3Result:
    candidate_evaluations: list[CandidateEvaluation]
    simulation_result: SimulationResult
    baseline_comparison: BaselineComparison
    ranking: list[str]
    recommendation: Recommendation
