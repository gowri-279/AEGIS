"""Focused tests for deterministic hydraulic what-if simulation."""

from __future__ import annotations

import copy
import unittest

from fastapi.testclient import TestClient

from backend.intelligence.component_intelligence import COMPONENTS, EDGES
from backend.intelligence.monitor_bob import handle_monitor_bob
from backend.main import app
from backend.simulation.hydraulic_whatif import (
    ALLOWED_ACTIONS,
    CONDITIONS,
    baseline_snapshot,
    loading_state,
    parse_bob_action,
    run_hydraulic_simulation,
)


class ConditionTests(unittest.TestCase):
    def test_five_conditions_exist(self):
        self.assertEqual(
            set(CONDITIONS),
            {
                "normal_rainfall",
                "heavy_storm",
                "flooding",
                "extreme_rainfall",
                "cloudburst",
            },
        )

    def test_conditions_are_deterministic(self):
        a = run_hydraulic_simulation(condition="cloudburst", action="run_condition")
        b = run_hydraulic_simulation(condition="cloudburst", action="run_condition")
        self.assertEqual(a["edges"], b["edges"])
        self.assertEqual(a["components"], b["components"])
        self.assertFalse(a["baseline_mutated"])


class TopologyTests(unittest.TestCase):
    def test_canonical_topology_preserved(self):
        before = baseline_snapshot()
        run_hydraulic_simulation(condition="extreme_rainfall", action="run_condition")
        run_hydraulic_simulation(
            action="disable_edge",
            parameters={"edge_id": "E-J3-L2"},
            condition="heavy_storm",
        )
        after = baseline_snapshot()
        self.assertEqual(before["edges"], after["edges"])
        self.assertEqual(before["components"], after["components"])
        self.assertEqual(COMPONENTS["L2"]["available_storage_m3"], 800)
        self.assertEqual(EDGES["E-J3-L2"]["nominal_capacity_m3_s"], 0.5)


class LoadingStateTests(unittest.TestCase):
    def test_green_amber_red_blinking(self):
        self.assertEqual(loading_state(0.5), "green")
        self.assertEqual(loading_state(0.75), "amber")
        self.assertEqual(loading_state(0.95), "red")
        self.assertEqual(loading_state(1.05), "blinking_red")

    def test_failed_threshold_becomes_grey(self):
        result = run_hydraulic_simulation(condition="cloudburst", action="run_condition")
        criticalish = [e for e in result["edges"] if e["loading_ratio"] > 1.0 or e["state"] == "grey"]
        self.assertTrue(criticalish)
        for edge in result["edges"]:
            if edge["loading_ratio"] > 1.0:
                self.assertEqual(edge["state"], "grey")
                self.assertIn("blinking_red", edge["state_sequence"])
                self.assertIn("grey", edge["state_sequence"])


class WhatIfTests(unittest.TestCase):
    def test_reroute_flow(self):
        baseline = run_hydraulic_simulation(condition="heavy_storm", action="run_condition")
        whatif = run_hydraulic_simulation(
            condition="heavy_storm",
            action="reroute_flow",
            parameters={"from": "L1", "to": "L2", "percentage": 100},
        )
        base_l2 = next(e for e in baseline["edges"] if e["edge_id"] == "E-J3-L2")
        wi_l2 = next(e for e in whatif["edges"] if e["edge_id"] == "E-J3-L2")
        wi_l1 = next(e for e in whatif["edges"] if e["edge_id"] == "E-J3-L1")
        self.assertGreater(wi_l2["flow_m3_s"], base_l2["flow_m3_s"])
        self.assertEqual(wi_l1["flow_m3_s"], 0.0)
        self.assertTrue(whatif["what_if"])
        self.assertFalse(whatif["baseline_mutated"])

    def test_disable_edge(self):
        result = run_hydraulic_simulation(
            condition="heavy_storm",
            action="disable_edge",
            parameters={"edge_id": "E-J3-L2"},
        )
        edge = next(e for e in result["edges"] if e["edge_id"] == "E-J3-L2")
        self.assertEqual(edge["state"], "grey")
        self.assertEqual(edge["flow_m3_s"], 0.0)
        self.assertFalse(result["baseline_mutated"])

    def test_disable_component(self):
        result = run_hydraulic_simulation(
            condition="heavy_storm",
            action="disable_component",
            parameters={"component_id": "L2"},
        )
        l2 = next(c for c in result["components"] if c["component_id"] == "L2")
        self.assertEqual(l2["state"], "grey")
        e = next(e for e in result["edges"] if e["edge_id"] == "E-J3-L2")
        self.assertEqual(e["state"], "grey")

    def test_reset_restores_baseline_condition(self):
        run_hydraulic_simulation(
            condition="cloudburst",
            action="disable_edge",
            parameters={"edge_id": "E-J3-L2"},
        )
        reset = run_hydraulic_simulation(action="reset")
        self.assertEqual(reset["condition_id"], "normal_rainfall")
        self.assertFalse(reset["what_if"])
        self.assertFalse(any(e["disabled"] for e in reset["edges"]))


class BobActionTests(unittest.TestCase):
    def test_allowlisted_only(self):
        self.assertIn("reroute_flow", ALLOWED_ACTIONS)
        self.assertIn("disable_edge", ALLOWED_ACTIONS)
        self.assertNotIn("run_shell", ALLOWED_ACTIONS)

    def test_parser_examples(self):
        cases = [
            ("What if all flow from L1 is diverted to L2?", "reroute_flow"),
            ("What if E-J3-L2 is removed?", "disable_edge"),
            ("Can this pipe handle the cloudburst?", "stress_edge"),
            ("What happens if L2 becomes unavailable?", "disable_component"),
            ("What if 70% of J3 flow goes through L2?", "change_flow_split"),
            ("What happens under extreme rainfall?", "run_condition"),
        ]
        for message, action in cases:
            parsed = parse_bob_action(message)
            self.assertIsNotNone(parsed, message)
            self.assertEqual(parsed["action"], action, message)

    def test_bob_receives_context_and_runs_simulation(self):
        result = handle_monitor_bob(
            "What if E-J3-L2 is removed?",
            {
                "fixture_id": "standard",
                "sensors": [{"id": "WL-J3", "confidence": 0.94}],
                "network": {"nodes": [{"id": "L2"}]},
            },
            runner=lambda *a, **k: type("R", (), {"returncode": 1, "stdout": "", "stderr": ""})(),
        )
        # Missing API key → fallback heuristic still produces structured request + hydraulic.
        self.assertIsNotNone(result["simulation_request"])
        self.assertEqual(result["simulation_request"]["action"], "disable_edge")
        self.assertIsNotNone(result["hydraulic_result"])
        self.assertFalse(result["hydraulic_result"]["baseline_mutated"])
        # Explanation uses simulation numbers, not invented ones.
        self.assertIn("SIMULATION", result["explanation"])
        self.assertIn(str(result["hydraulic_result"]["max_loading_ratio"]), result["explanation"])

    def test_sensor_confidence_populated(self):
        result = run_hydraulic_simulation(condition="normal_rainfall")
        confidences = {s["node_id"]: s["confidence"] for s in result["sensors"]}
        for cid in ("C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"):
            self.assertIn(cid, confidences)
            self.assertIsNotNone(confidences[cid])
        self.assertEqual(confidences["J3"], 0.94)

    def test_api_endpoints(self):
        client = TestClient(app)
        conditions = client.get("/api/v1/monitor/hydraulic-conditions")
        self.assertEqual(conditions.status_code, 200)
        self.assertEqual(len(conditions.json()["conditions"]), 5)
        sim = client.post(
            "/api/v1/monitor/hydraulic-simulate",
            json={"condition": "flooding", "action": "run_condition"},
        )
        self.assertEqual(sim.status_code, 200)
        body = sim.json()
        self.assertEqual(body["condition_id"], "flooding")
        self.assertEqual(len(body["edges"]), 8)
        self.assertFalse(body["baseline_mutated"])


class ComponentStateTests(unittest.TestCase):
    def test_component_states_deterministic(self):
        a = run_hydraulic_simulation(condition="flooding")
        b = run_hydraulic_simulation(condition="flooding")
        self.assertEqual(a["components"], b["components"])
        # Conditions differ
        normal = run_hydraulic_simulation(condition="normal_rainfall")
        cloud = run_hydraulic_simulation(condition="cloudburst")
        self.assertNotEqual(normal["overall_network_status"], cloud["overall_network_status"] if cloud["max_loading_ratio"] != normal["max_loading_ratio"] else normal["max_loading_ratio"])
        self.assertLess(normal["max_loading_ratio"], cloud["max_loading_ratio"])


if __name__ == "__main__":
    unittest.main()
