from p2.sensor_simulator import simulate_readings
from backend.integration.workflow import run_integrated_assessment


NOW = "2026-10-23T12:00:00Z"


def test_stale_wl_j3_propagates_abstention_to_canonical_response():
    readings = simulate_readings(
        failure_modes={"WL-J3": "stale"},
        now=NOW,
    )

    response = run_integrated_assessment(
        readings,
        proposed_volume_m3=200,
        duration_seconds=600,
        recharge_eligibility="ineligible",
        baseline_excess_volume_m3=300,
    )

    # P2 detects unusable critical sensor data.
    assert response["assessed_state"]["decision_gate"] == "abstained"
    assert (
        response["assessed_state"]["critical_constraints"]["WL-J3-depth"]["reason_code"]
        == "CRITICAL_WL_J3_UNUSABLE"
    )

    # Candidate evaluations remain available for diagnostics.
    assert response["candidate_evaluations"]

    # P3 must abstain despite those candidate evaluations.
    recommendation = response["recommendation"]
    assert recommendation["recommendation_status"] == "abstained"
    assert recommendation["selected_candidate_id"] is None
    assert response["ranking"] == []
    assert recommendation["selection_basis"] is None
    assert recommendation["safety_qualified"] is False
    assert recommendation["recommendation_scope"] == "limited_mvp_scope"

    # Preserve P2's original risk findings in the canonical response.
    expected_findings = response["assessed_state"]["risk_findings"]
    assert response["risks"] == expected_findings
    assert "CRITICAL_WL_J3_UNUSABLE" in recommendation["reason_codes"]


import pytest


@pytest.mark.parametrize("failure_mode", ["missing", "invalid", "conflicting"])
def test_unusable_wl_j3_always_propagates_abstention(failure_mode):
    readings = simulate_readings(
        failure_modes={"WL-J3": failure_mode},
        now=NOW,
    )

    response = run_integrated_assessment(
        readings,
        proposed_volume_m3=200,
        duration_seconds=600,
        recharge_eligibility="ineligible",
        baseline_excess_volume_m3=300,
    )

    assert response["assessed_state"]["decision_gate"] == "abstained"
    assert response["candidate_evaluations"]

    recommendation = response["recommendation"]
    assert recommendation["recommendation_status"] == "abstained"
    assert recommendation["selected_candidate_id"] is None
    assert response["ranking"] == []
    assert recommendation["selection_basis"] is None
    assert recommendation["safety_qualified"] is False
    assert recommendation["recommendation_scope"] == "limited_mvp_scope"

    assert (
        response["risks"]
        == response["assessed_state"]["risk_findings"]
    )
