from p3.models import CandidateEvaluation, Recommendation
from p3.ranking import rank_feasible_candidates


def decide_recommendation(
    candidates: list[CandidateEvaluation],
    j3_water_level_usable: bool = True,
) -> tuple[list[str], Recommendation]:
    """Select a feasible candidate under the approved contract."""

    if not j3_water_level_usable:
        return [], Recommendation(
            recommendation_status="abstained",
            selected_candidate_id=None,
            selection_basis=None,
            reason_codes=["J3_WATER_LEVEL_UNAVAILABLE"],
            uncertainty=["Critical WL-J3 data is unusable."],
            data_limitations=[
                "A defensible recommendation cannot be made without usable WL-J3 data."
            ],
        )

    feasible = [candidate for candidate in candidates if candidate.feasible]

    if not feasible:
        return [], Recommendation(
            recommendation_status="no_feasible_candidate",
            selected_candidate_id=None,
            selection_basis=None,
            reason_codes=["NO_FEASIBLE_CANDIDATE"],
            rationale=["No candidate passed all required hard constraints."],
        )

    # One feasible candidate does not need a ranking comparison.
    if len(feasible) == 1:
        selected = feasible[0]
        return [], Recommendation(
            recommendation_status="recommended",
            selected_candidate_id=selected.candidate_id,
            selection_basis="sole_feasible_candidate",
            rationale=[
                f"{selected.candidate_id} is the sole feasible candidate."
            ],
            data_limitations=[
                "Unavailable physical and ranking metrics remain null.",
                "Downstream capacity is not modeled; the recommendation is limited in scope.",
            ],
        )

    # With multiple feasible candidates, every candidate must have
    # both ranking metrics. Do not rank only a subset.
    metrics_available = all(
        candidate.modeled_network_utilization is not None
        and candidate.remaining_storage is not None
        for candidate in feasible
    )

    if not metrics_available:
        return [], Recommendation(
            recommendation_status="abstained",
            selected_candidate_id=None,
            selection_basis=None,
            reason_codes=["RANKING_METRICS_UNAVAILABLE"],
            uncertainty=[
                "Multiple feasible candidates exist, but required ranking metrics are unavailable."
            ],
            data_limitations=[
                "No candidate was selected because a complete deterministic comparison was unavailable."
            ],
        )

    ranking = rank_feasible_candidates(feasible)

    if not ranking:
        return [], Recommendation(
            recommendation_status="abstained",
            selected_candidate_id=None,
            selection_basis=None,
            reason_codes=["RANKING_METRICS_UNAVAILABLE"],
            uncertainty=["No evaluable ranking was produced."],
        )

    selected_candidate_id = ranking[0]

    return ranking, Recommendation(
        recommendation_status="recommended",
        selected_candidate_id=selected_candidate_id,
        selection_basis="deterministic_utilization_ranking",
        rationale=[
            f"{selected_candidate_id} was selected using deterministic utilization ranking."
        ],
        data_limitations=[
            "Downstream capacity is not modeled; the recommendation is limited in scope."
        ],
    )