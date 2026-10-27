
from p3.models import CandidateEvaluation


def rank_feasible_candidates(
    candidates: list[CandidateEvaluation],
) -> list[str]:
    """Rank only feasible candidates using the frozen contract rules."""

    feasible = [candidate for candidate in candidates if candidate.feasible]

    # A missing utilization value must never give a candidate a ranking
    # advantage. Exclude candidates without a valid utilization metric.
    rankable = [
        candidate
        for candidate in feasible
        if candidate.modeled_network_utilization is not None
        and candidate.remaining_storage is not None
    ]

    rankable.sort(
        key=lambda candidate: (
            candidate.modeled_network_utilization,
            -candidate.remaining_storage,
            candidate.candidate_id,
        )
    )

    return [candidate.candidate_id for candidate in rankable]
