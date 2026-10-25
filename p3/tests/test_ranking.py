
from p3.models import CandidateEvaluation
from p3.ranking import rank_feasible_candidates


def test_ranking_uses_utilization_then_storage_then_id():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-B",
            feasible=True,
            modeled_network_utilization=0.4,
            remaining_storage=500,
        ),
        CandidateEvaluation(
            candidate_id="C-C",
            feasible=True,
            modeled_network_utilization=0.3,
            remaining_storage=200,
        ),
        CandidateEvaluation(
            candidate_id="C-A",
            feasible=True,
            modeled_network_utilization=0.3,
            remaining_storage=300,
        ),
    ]

    assert rank_feasible_candidates(candidates) == ["C-A", "C-C", "C-B"]


def test_missing_utilization_is_not_ranked():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-A",
            feasible=True,
            modeled_network_utilization=None,
            remaining_storage=1000,
        ),
        CandidateEvaluation(
            candidate_id="C-B",
            feasible=True,
            modeled_network_utilization=0.4,
            remaining_storage=200,
        ),
    ]

    assert rank_feasible_candidates(candidates) == ["C-B"]


def test_infeasible_candidates_are_never_ranked():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-A",
            feasible=False,
            modeled_network_utilization=0.1,
            remaining_storage=1000,
        )
    ]

    assert rank_feasible_candidates(candidates) == []
