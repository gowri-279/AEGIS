
from p3.models import CandidateEvaluation, Recommendation
from p3.ranking import rank_feasible_candidates


def decide_recommendation(
    candidates: list[CandidateEvaluation],
    j3_water_level_usable: bool = True,
) -> tuple[list[str], Recommendation]:
    """Rank feasible candidates and determine the recommendation state."""

    # Critical J3 data is unusable: abstain.
    if not j3_water_level_usable:
        return [], Recommendation(
            status="abstained",
            selected_candidate_id=None,
            recommendation_scope="limited_mvp_scope",
            safety_qualified=False,
            reason_codes=["J3_WATER_LEVEL_UNAVAILABLE"],
        )

    # Only genuinely feasible candidates count as feasible.
    feasible_candidates = [
        candidate for candidate in candidates
        if candidate.feasible
    ]

    # No feasible candidates, with usable J3 data.
    if not feasible_candidates:
        return [], Recommendation(
            status="no_feasible_candidate",
            selected_candidate_id=None,
            recommendation_scope="limited_mvp_scope",
            safety_qualified=False,
            reason_codes=["NO_FEASIBLE_CANDIDATE"],
        )

    # Rank feasible candidates using the existing ranking rules.
    ranking = rank_feasible_candidates(candidates)

    # Feasible candidates exist, but the ranking metrics are insufficient.
    if not ranking:
        return [], Recommendation(
            status="abstained",
            selected_candidate_id=None,
            recommendation_scope="limited_mvp_scope",
            safety_qualified=False,
            reason_codes=["RANKING_METRICS_UNAVAILABLE"],
        )

    # Recommend the highest-ranked candidate.
    return ranking, Recommendation(
        status="recommended",
        selected_candidate_id=ranking[0],
        recommendation_scope="limited_mvp_scope",
        safety_qualified=False,
    )
