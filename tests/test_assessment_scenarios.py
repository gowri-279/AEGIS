"""Scenario checks for the integrated P1 → P2 → P3 assessment pipeline.

These tests call the libraries and workflow directly (no FastAPI required).
"""

import unittest

from backend.integration.scenarios import (
    FIXED_EVALUATION_TIME,
    resolve_assessment_inputs,
)
from backend.integration.workflow import run_integrated_assessment
from p2.sensor_simulator import simulate_readings


def _run(fixture: str, **overrides):
    params = resolve_assessment_inputs(fixture=fixture, **overrides)
    failure_modes = (
        {"WL-J3": params["wl_j3_failure_mode"]}
        if params["wl_j3_failure_mode"] is not None
        else None
    )
    readings = simulate_readings(
        failure_modes=failure_modes,
        now=FIXED_EVALUATION_TIME,
    )
    response = run_integrated_assessment(
        readings,
        proposed_volume_m3=params["proposed_volume_m3"],
        duration_seconds=params["duration_seconds"],
        recharge_eligibility=params["recharge_eligibility"],
        baseline_excess_volume_m3=params["baseline_excess_volume_m3"],
        scenario_id=params["scenario_id"],
        rainfall=params["rainfall"],
        intervention_assumptions=params["intervention_assumptions"],
    )
    response["fixture_id"] = params["fixture_id"]
    return response


class AssessmentScenarioTests(unittest.TestCase):
    def test_standard_recommends_c_l2(self):
        response = _run("standard")
        self.assertEqual(response["fixture_id"], "standard")
        self.assertEqual(response["network"]["network_id"], "aegis_demo_catchment")
        self.assertEqual(response["network"]["network_version"], "1.0")
        self.assertEqual(len(response["network"]["nodes"]), 8)
        self.assertEqual(len(response["network"]["edges"]), 8)
        self.assertEqual(
            response["assessed_state"]["decision_gate"], "evaluate_candidates"
        )
        rec = response["recommendation"]
        self.assertEqual(rec["recommendation_status"], "recommended")
        self.assertEqual(rec["selected_candidate_id"], "C-L2")
        self.assertFalse(rec["safety_qualified"])
        self.assertEqual(rec["recommendation_scope"], "limited_mvp_scope")
        self.assertEqual(response["risks"], response["assessed_state"]["risk_findings"])

    def test_stress_has_no_feasible_candidate(self):
        response = _run("stress")
        rec = response["recommendation"]
        self.assertEqual(rec["recommendation_status"], "no_feasible_candidate")
        self.assertIsNone(rec["selected_candidate_id"])
        self.assertIn("NO_FEASIBLE_CANDIDATE", rec["reason_codes"])

    def test_critical_stale_abstains(self):
        response = _run("critical_stale")
        self.assertEqual(response["assessed_state"]["decision_gate"], "abstained")
        self.assertEqual(
            response["assessed_state"]["critical_constraints"]["WL-J3-depth"][
                "reason_code"
            ],
            "CRITICAL_WL_J3_UNUSABLE",
        )
        rec = response["recommendation"]
        self.assertEqual(rec["recommendation_status"], "abstained")
        self.assertIsNone(rec["selected_candidate_id"])
        self.assertIn("J3_WATER_LEVEL_UNAVAILABLE", rec["reason_codes"])
        self.assertIn("CRITICAL_WL_J3_UNUSABLE", rec["reason_codes"])

    def test_degraded_remains_evaluable(self):
        response = _run("degraded")
        wl = next(
            s
            for s in response["network_state"]["sensors"]
            if s["sensor_id"] == "WL-J3"
        )
        self.assertEqual(wl["quality_status"], "degraded")
        self.assertIsNotNone(wl["effective_value"])
        self.assertEqual(
            response["assessed_state"]["decision_gate"], "evaluate_candidates"
        )
        rec = response["recommendation"]
        self.assertEqual(rec["recommendation_status"], "recommended")
        self.assertEqual(rec["selected_candidate_id"], "C-L2")

    def test_diverted_volume_alias(self):
        response = _run("standard", diverted_volume=200, duration=600)
        self.assertEqual(response["scenario"]["diverted_volume"], 200)
        self.assertEqual(response["scenario"]["duration"], 600)
        self.assertEqual(
            response["recommendation"]["selected_candidate_id"], "C-L2"
        )


if __name__ == "__main__":
    unittest.main()
