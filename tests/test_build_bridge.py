"""Focused Build bridge checks — active design binding + scenario mapping."""

import unittest

from backend.integration.build_bridge import (
    finalize_build_network,
    run_build_simulation,
)


ACTIVE_A = {
    "nodes": [
        {"id": "J3", "kind": "junction", "proposed": False},
        {"id": "J5", "kind": "junction", "proposed": True},
        {"id": "D01", "kind": "detention", "proposed": True},
        {"id": "O1", "kind": "outfall", "proposed": False},
    ],
    "links": [
        {"id": "P21", "from": "J3", "to": "J5", "proposed": True},
        {"id": "P22", "from": "J5", "to": "D01", "proposed": True},
    ],
}


class BuildBridgeTests(unittest.TestCase):
    def test_simulation_echoes_active_design_not_default_network(self):
        result = run_build_simulation(
            {
                "mode": "redesign",
                "rainfall_scenario": "extreme",
                "selected_candidate": "A",
                "revision": 2,
                "active_design": ACTIVE_A,
            }
        )
        self.assertEqual(result["display_metrics_source"], "frontend_v2")
        self.assertEqual(
            [n["id"] for n in result["active_design"]["nodes"]],
            ["J3", "J5", "D01", "O1"],
        )
        self.assertIn("J5", result["design_fingerprint"]["node_ids"])
        self.assertNotIn("BLR-SYNTHETIC-01", str(result["design_fingerprint"]))
        # Extreme rainfall maps onto stress → no feasible candidate from P3.
        self.assertEqual(result["recommendation_status"], "no_feasible_candidate")

    def test_standard_rainfall_recommends_c_l2(self):
        result = run_build_simulation(
            {
                "mode": "redesign",
                "rainfall_scenario": "normal",
                "selected_candidate": "A",
                "revision": 1,
                "active_design": ACTIVE_A,
            }
        )
        self.assertEqual(result["recommendation_status"], "recommended")
        self.assertEqual(result["selected_candidate_id"], "C-L2")

    def test_finalize_preserves_network_identity_and_design(self):
        entry = finalize_build_network(
            {
                "mode": "new",
                "network_id": "BLR-SYNTHETIC-02",
                "selected_candidate": "A",
                "revision": 3,
                "active_design": ACTIVE_A,
            }
        )
        self.assertEqual(entry["network_id"], "BLR-SYNTHETIC-02")
        self.assertEqual(entry["active_design"], ACTIVE_A)
        self.assertEqual(entry["revision"], 3)


if __name__ == "__main__":
    unittest.main()
