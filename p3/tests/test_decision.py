
from p3.decision import decide_recommendation
from p3.models import CandidateEvaluation


def test_unusable_j3_data_causes_abstention():
    ranking, recommendation = decide_recommendation(
        [],
        j3_water_level_usable=False,
    )

    assert ranking == []
    assert recommendation.status == "abstained"
    assert recommendation.selected_candidate_id is None
    assert recommendation.selection_basis is None
    assert recommendation.safety_qualified is False
    assert "J3_WATER_LEVEL_UNAVAILABLE" in recommendation.reason_codes


def test_no_feasible_candidate_returns_no_feasible_status():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-L2",
            feasible=False,
        )
    ]

    ranking, recommendation = decide_recommendation(candidates)

    assert ranking == []
    assert recommendation.status == "no_feasible_candidate"
    assert recommendation.selected_candidate_id is None
    assert recommendation.selection_basis is None


def test_sole_feasible_candidate_selected_without_ranking_metrics():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-L2",
            feasible=True,
            modeled_network_utilization=None,
            remaining_storage=800.0,
        )
    ]

    ranking, recommendation = decide_recommendation(candidates)

    assert ranking == []
    assert recommendation.status == "recommended"
    assert recommendation.selected_candidate_id == "C-L2"
    assert recommendation.selection_basis == "sole_feasible_candidate"
    assert recommendation.safety_qualified is False


def test_rankable_feasible_candidate_is_recommended():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-L2",
            feasible=True,
            modeled_network_utilization=0.5,
            remaining_storage=800.0,
        )
    ]

    ranking, recommendation = decide_recommendation(candidates)

    assert ranking == []
    assert recommendation.status == "recommended"
    assert recommendation.selected_candidate_id == "C-L2"
    assert recommendation.selection_basis == "sole_feasible_candidate"
    assert recommendation.safety_qualified is False


def test_infeasible_candidate_is_not_recommended():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-L1",
            feasible=False,
            modeled_network_utilization=0.2,
            remaining_storage=100.0,
        ),
        CandidateEvaluation(
            candidate_id="C-L2",
            feasible=True,
            modeled_network_utilization=0.5,
            remaining_storage=800.0,
        ),
    ]

    ranking, recommendation = decide_recommendation(candidates)

    assert ranking == []
    assert recommendation.status == "recommended"
    assert recommendation.selected_candidate_id == "C-L2"
    assert recommendation.selection_basis == "sole_feasible_candidate"


def test_multiple_feasible_candidates_with_missing_metrics_abstain():
    candidates = [
        CandidateEvaluation(
            candidate_id="C-L1",
            feasible=True,
            modeled_network_utilization=0.2,
            remaining_storage=100.0,
        ),
        CandidateEvaluation(
            candidate_id="C-L2",
            feasible=True,
            modeled_network_utilization=None,
            remaining_storage=800.0,
        ),
    ]

    ranking, recommendation = decide_recommendation(candidates)

    assert ranking == []
    assert recommendation.status == "abstained"
    assert recommendation.selected_candidate_id is None
    assert recommendation.selection_basis is None
    assert "RANKING_METRICS_UNAVAILABLE" in recommendation.reason_codes