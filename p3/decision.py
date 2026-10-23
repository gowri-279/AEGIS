
from p3.models import CandidateEvaluation, Recommendation
from p3.ranking import rank_feasible_candidates


def decide_recommendation(
    candidates: list[CandidateEvaluation],
    j3_water_level_usable: bool = True,
) -> tuple[list[str], Recommendation]:
    """Rank feasible candidates and determine the recommendation state."""

    # Critical J3 data is unusable: the system must abstain.
    if not j3_water_level_usable:
        return [], Recommendation(
            recommendation_status="abstained",
            selected_candidate_id=None,
            recommendation_scope="limited_mvp_scope",
            safety_qualified=False,
            reason_codes=["J3_WATER_LEVEL_UNAVAILABLE"],
            uncertainty=["Critical WL-J3 data is unusable."],
            data_limitations=["A defensible recommendation cannot be made without usable WL-J3 data."],
        )

    feasible_candidates = [
        candidate for candidate in candidates
        if candidate.feasible
    ]

    # No feasible candidate, while critical data is usable.
    if not feasible_candidates:
        return [], Recommendation(
            recommendation_status="no_feasible_candidate",
            selected_candidate_id=None,
            recommendation_scope="limited_mvp_scope",
            safety_qualified=False,
            reason_codes=["NO_FEASIBLE_CANDIDATE"],
            rationale=["No candidate passed all required hard constraints."],
        )

    # Rank only candidates with evaluable ranking metrics.
    ranking = rank_feasible_candidates(candidates)

    # Do not select a candidate if utilization-based ranking is unavailable.
    if not ranking:
        return [], Recommendation(
            recommendation_status="abstained",
            selected_candidate_id=None,
            recommendation_scope="limited_mvp_scope",
            safety_qualified=False,
            reason_codes=["RANKING_METRICS_UNAVAILABLE"],
            uncertainty=["Feasible candidates exist, but ranking metrics are unavailable."],
            data_limitations=["A candidate cannot be selected without evaluable modeled network utilization and remaining storage."],
        )

    selected_candidate_id = ranking[0]

    return ranking, Recommendation(
        recommendation_status="recommended",
        selected_candidate_id=selected_candidate_id,
        recommendation_scope="limited_mvp_scope",
        safety_qualified=False,
        rationale=[
            f"{selected_candidate_id} ranked highest among candidates eligible for deterministic ranking."
        ],
        data_limitations=[
            "Downstream capacity is not modeled; the recommendation is limited in scope."
        ],
    )
