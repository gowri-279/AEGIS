"""Canonical component model coverage for all 8 AEGIS nodes + Bob context."""

from __future__ import annotations

import unittest

from backend.intelligence.component_intelligence import (
    CANONICAL_COMPONENT_IDS,
    CANONICAL_EDGE_IDS,
    COMPONENTS,
    EDGES,
    bob_component_context,
    get_component_intelligence,
)
from backend.intelligence.health_bob import build_structured_briefing


EXPECTED_TYPES = {
    "C1": "collection_inlet",
    "C2": "collection_inlet",
    "J3": "junction",
    "L1": "storage",
    "R1": "recharge",
    "L2": "storage",
    "J4": "downstream_junction",
    "O1": "outlet",
}


class CanonicalComponentModelTests(unittest.TestCase):
    def test_all_eight_components_exist(self):
        self.assertEqual(tuple(CANONICAL_COMPONENT_IDS), ("C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"))
        for component_id in CANONICAL_COMPONENT_IDS:
            self.assertIn(component_id, COMPONENTS)

    def test_all_canonical_edges_exist(self):
        self.assertEqual(len(CANONICAL_EDGE_IDS), 8)
        for edge_id in CANONICAL_EDGE_IDS:
            self.assertIn(edge_id, EDGES)
            edge = EDGES[edge_id]
            self.assertEqual(edge["edge_id"], edge_id)
            self.assertIn("from", edge)
            self.assertIn("to", edge)
            self.assertIn("nominal_capacity_m3_s", edge)

    def test_each_component_has_correct_type(self):
        for component_id, expected in EXPECTED_TYPES.items():
            self.assertEqual(COMPONENTS[component_id]["component_type"], expected)

    def test_l1_preserves_existing_values(self):
        l1 = COMPONENTS["L1"]
        self.assertEqual(l1["available_storage_m3"], 100.0)
        self.assertEqual(l1["observed_storage_m3"], 100.0)
        self.assertEqual(l1["current_problem"], "Limited storage at L1")
        self.assertEqual(l1["problem_severity"], "low")
        self.assertEqual(l1["candidate_id"], "C-L1")
        self.assertEqual(l1["feasibility"], "infeasible")
        self.assertEqual(l1["relevant_threshold"]["limit"], 200.0)
        self.assertTrue(
            any(
                "Available storage ≥ diverted volume" in c["description"] and c["status"] == "fail"
                for c in l1["constraint_checks"]
            )
        )

    def test_j3_preserves_wl_j3_confidence(self):
        j3 = COMPONENTS["J3"]
        self.assertEqual(j3["sensor"]["sensor_id"], "WL-J3")
        self.assertEqual(j3["sensor"]["confidence"], 0.94)
        self.assertEqual(j3["sensor"]["status"], "fresh")
        self.assertEqual(j3["water_depth_m"], 0.60)
        self.assertEqual(j3["water_depth_threshold_m"], 0.80)
        self.assertIn("0.80", j3["identified_constraint"])

    def test_l2_has_usable_storage_and_sensor_context(self):
        l2 = COMPONENTS["L2"]
        self.assertEqual(l2["available_storage_m3"], 800.0)
        self.assertEqual(l2["storage_capacity_m3"], 1200.0)
        self.assertEqual(l2["sensor_status"], "stale")
        self.assertEqual(l2["sensor_confidence"], 0.55)
        self.assertEqual(l2["candidate_id"], "C-L2")
        self.assertEqual(l2["feasibility"], "feasible")

    def test_component_lookup_returns_correct_component(self):
        for component_id in CANONICAL_COMPONENT_IDS:
            payload = get_component_intelligence(component_id)
            self.assertEqual(payload["component"]["component_id"], component_id)
            self.assertEqual(payload["component"]["component_type"], EXPECTED_TYPES[component_id])

    def test_bob_context_contains_selected_component_and_neighbors(self):
        ctx = bob_component_context("L2")
        self.assertEqual(ctx["selected_component"]["component_id"], "L2")
        self.assertIn("available_storage_m3", ctx["selected_component"])
        self.assertTrue(ctx["related_edges"])
        self.assertIn("J3", ctx["neighbors"]["upstream"])
        self.assertIn("J4", ctx["neighbors"]["downstream"])
        self.assertIn("L2", ctx["topology_path"])
        self.assertTrue(ctx["neighbors"]["upstream_detail"])
        self.assertTrue(ctx["neighbors"]["downstream_detail"])

    def test_component_data_is_deterministic(self):
        a = get_component_intelligence("J3")
        b = get_component_intelligence("J3")
        self.assertEqual(a, b)
        self.assertIsNot(a["component"], COMPONENTS["J3"])  # deepcopy isolation

    def test_health_bob_briefing_includes_bob_component_context(self):
        context = {
            "node": {"id": "L2", "type": "storage"},
            "finding": {
                "category": "overflow",
                "target_id": "L2",
                "title": "Overflow Risk",
                "severity": "high",
                "observed_value": None,
                "threshold": None,
                "potential_impact": "Downstream transfer risk",
                "evidence": [],
            },
            "upstream": ["J3"],
            "downstream": ["J4"],
            "candidates": [],
            "recommendation": {"recommendation_status": "recommended"},
            "network": {"nodes": [], "edges": []},
        }
        brief = build_structured_briefing(context, include_bob=False)
        self.assertEqual(brief["component_id"], "L2")
        self.assertIn("bob_component_context", brief)
        self.assertEqual(brief["bob_component_context"]["selected_component"]["component_id"], "L2")
        self.assertIn("J3", brief["bob_component_context"]["topology_path"])


if __name__ == "__main__":
    unittest.main()
