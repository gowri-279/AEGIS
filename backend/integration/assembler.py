"""Canonical response assembly for the AEGIS MVP contract."""

from copy import deepcopy
from typing import Any


P1_INPUT_FIELDS = (
    "network",
    "network_state",
    "assessed_state",
    "scenario",
)

P3_OUTPUT_FIELDS = (
    "candidate_evaluations",
    "simulation_result",
    "baseline_comparison",
    "ranking",
    "recommendation",
)


def assemble_canonical_response(
    *,
    network: dict[str, Any],
    network_state: dict[str, Any],
    assessed_state: dict[str, Any],
    scenario: dict[str, Any],
    candidate_evaluations: Any,
    simulation_result: Any,
    baseline_comparison: Any,
    ranking: Any,
    recommendation: dict[str, Any],
) -> dict[str, Any]:
    """Combine P1 and P3 outputs without reimplementing decision logic.

    Risk findings in assessed_state are canonical. The top-level risks field
    is a mirror for consumers and is never independently recalculated here.
    """
    if not isinstance(assessed_state, dict):
        raise TypeError("assessed_state must be a dictionary")

    if "risk_findings" not in assessed_state:
        raise ValueError("assessed_state must contain risk_findings")

    if not isinstance(recommendation, dict):
        raise TypeError("recommendation must be a dictionary")

    return {
        "network": deepcopy(network),
        "network_state": deepcopy(network_state),
        "assessed_state": deepcopy(assessed_state),
        "scenario": deepcopy(scenario),
        "candidate_evaluations": deepcopy(candidate_evaluations),
        "simulation_result": deepcopy(simulation_result),
        "baseline_comparison": deepcopy(baseline_comparison),
        "ranking": deepcopy(ranking),
        "recommendation": deepcopy(recommendation),
        "risks": deepcopy(assessed_state["risk_findings"]),
    }
