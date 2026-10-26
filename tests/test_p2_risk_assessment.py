import unittest
from datetime import datetime, timezone

from p2.risk_assessment import assess_network
from p2.sensor_simulator import simulate_readings


NOW = "2026-10-23T12:00:00Z"


class P2RiskAssessmentTests(unittest.TestCase):
    def readings(self, failure_modes=None, water_level=0.60):
        sensors = [
            {"sensor_id": "WL-J3", "sensor_type": "water_level", "value": water_level},
            {"sensor_id": "FL-L1", "sensor_type": "flow", "value": 0.333333},
        ]
        return simulate_readings(
            sensors=sensors,
            failure_modes=failure_modes,
            now=NOW,
        )

    def test_usable_wl_j3_allows_candidate_evaluation(self):
        result = assess_network(self.readings())
        self.assertEqual(result["decision_gate"], "evaluate_candidates")
        self.assertEqual(result["critical_constraints"]["WL-J3-depth"]["status"], "passed")

    def test_wl_j3_at_threshold_fails(self):
        result = assess_network(self.readings(water_level=0.80))
        self.assertEqual(result["critical_constraints"]["WL-J3-depth"]["status"], "failed")
        self.assertTrue(any(
            finding["risk_type"] == "water_level_threshold_exceeded"
            for finding in result["risk_findings"]
        ))

    def test_wl_j3_above_threshold_fails(self):
        result = assess_network(self.readings(water_level=0.81))
        self.assertEqual(result["critical_constraints"]["WL-J3-depth"]["status"], "failed")

    def test_stale_critical_sensor_causes_abstention(self):
        result = assess_network(self.readings({"WL-J3": "stale"}))
        self.assertEqual(result["decision_gate"], "abstained")
        self.assertEqual(result["critical_constraints"]["WL-J3-depth"]["status"], "not_evaluated")

    def test_missing_critical_sensor_causes_abstention(self):
        result = assess_network(self.readings({"WL-J3": "missing"}))
        self.assertEqual(result["decision_gate"], "abstained")

    def test_conflicting_critical_sensor_causes_abstention(self):
        result = assess_network(self.readings({"WL-J3": "conflicting"}))
        self.assertEqual(result["decision_gate"], "abstained")

    def test_degraded_but_usable_sensor_is_evaluated_with_warning(self):
        result = assess_network(self.readings({"WL-J3": "degraded"}))
        self.assertEqual(result["decision_gate"], "evaluate_candidates")
        self.assertTrue(any(
            finding["risk_type"] == "sensor_reliability_warning"
            for finding in result["risk_findings"]
        ))

    def test_modeled_edge_overload_is_reported(self):
        result = assess_network(
            self.readings(),
            modeled_edges=[{
                "edge_id": "E-L1",
                "flow_m3_s": 1.5,
                "capacity_m3_s": 0.5,
            }],
        )
        self.assertTrue(any(
            finding["risk_type"] == "hydraulic_overload"
            for finding in result["risk_findings"]
        ))

    def test_downstream_capacity_is_never_assumed(self):
        result = assess_network(self.readings())
        self.assertEqual(result["downstream_capacity"]["status"], "not_evaluated")
        self.assertFalse(result["safety_qualified"])

    def test_simulator_supports_all_required_failure_modes(self):
        modes = {
            "WL-J3": "stale",
            "RF-J3": "missing",
            "FL-L1": "invalid",
            "PR-L1": "conflicting",
            "WQ-J3": "degraded",
        }
        readings = simulate_readings(failure_modes=modes, now=NOW)
        statuses = {item["sensor_id"]: item["quality_status"] for item in readings}
        self.assertEqual(statuses["WL-J3"], "stale")
        self.assertEqual(statuses["RF-J3"], "missing")
        self.assertEqual(statuses["FL-L1"], "invalid")
        self.assertEqual(statuses["PR-L1"], "conflicting")
        self.assertEqual(statuses["WQ-J3"], "degraded")


if __name__ == "__main__":
    unittest.main()
