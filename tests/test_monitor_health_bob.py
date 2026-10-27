"""Focused Monitor Health Bob + component intelligence tests."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.intelligence.component_intelligence import (
    CANONICAL_COMPONENT_IDS,
    COMPONENTS,
    EDGES,
    get_component_intelligence,
)
from backend.intelligence.health_bob import build_structured_briefing, run_health_bob_scenario
from backend.main import app


L1_CONTEXT = {
    "node": {"id": "L1", "type": "storage", "label": "Storage L1"},
    "finding": {
        "id": "RK-L1-CAP",
        "category": "bottleneck",
        "target_id": "L1",
        "title": "Limited storage at L1",
        "observed_value": 100,
        "threshold": 200,
        "unit": "m³",
        "severity": "low",
        "confidence": None,
        "evidence": ["Available storage 100 m³ below scenario volume"],
        "potential_impact": "L1 cannot absorb the standard diversion.",
    },
    "upstream": ["J3"],
    "downstream": ["J4"],
    "candidates": [
        {
            "id": "C-L1",
            "node_id": "L1",
            "eligible": True,
            "feasible": False,
            "available_storage_m3": 100,
        },
        {
            "id": "C-L2",
            "node_id": "L2",
            "eligible": True,
            "feasible": True,
            "available_storage_m3": 800,
        },
    ],
    "recommendation": {"recommendation_status": "recommended", "selected_candidate_id": "C-L2"},
    "network": {
        "nodes": [
            {"id": "J3", "type": "junction"},
            {"id": "L1", "type": "storage"},
            {"id": "L2", "type": "storage"},
            {"id": "J4", "type": "junction"},
        ],
        "edges": [
            {"id": "E-J3-L1", "from": "J3", "to": "L1"},
            {"id": "E-J3-L2", "from": "J3", "to": "L2"},
            {"id": "E-L1-J4", "from": "L1", "to": "J4"},
            {"id": "E-L2-J4", "from": "L2", "to": "J4"},
        ],
    },
}


class ComponentIntelligenceTests(unittest.TestCase):
    def test_covers_canonical_topology(self):
        for component_id in CANONICAL_COMPONENT_IDS:
            self.assertIn(component_id, COMPONENTS)
            item = COMPONENTS[component_id]
            self.assertEqual(item["component_id"], component_id)
            self.assertIn("engineering_significance", item)
        self.assertEqual(len(EDGES), 8)
        # Preserve known demo figures
        self.assertEqual(COMPONENTS["L1"]["observed_storage_m3"], 100.0)
        self.assertEqual(COMPONENTS["L1"]["relevant_threshold"]["limit"], 200.0)
        self.assertEqual(COMPONENTS["J3"]["relevant_threshold"]["observed"], 0.60)
        self.assertEqual(COMPONENTS["J3"]["relevant_threshold"]["limit"], 0.80)
        self.assertEqual(COMPONENTS["L2"]["observed_storage_m3"], 800.0)

    def test_get_component_intelligence_includes_neighbors(self):
        payload = get_component_intelligence("J3")
        self.assertEqual(payload["component"]["component_id"], "J3")
        self.assertEqual(set(payload["neighbors"]["upstream"]), {"C1", "C2"})
        self.assertEqual(set(payload["neighbors"]["downstream"]), {"L1", "R1", "L2"})
        self.assertGreaterEqual(len(payload["edges"]), 5)


class HealthBobBriefingTests(unittest.TestCase):
    def test_briefing_includes_engineering_fields_and_component_context(self):
        with patch("backend.intelligence.health_bob.run_bob", return_value={"ok": False, "error": "missing_api_key"}):
            brief = build_structured_briefing(L1_CONTEXT, include_bob=False)

        self.assertEqual(brief["component_id"], "L1")
        self.assertIsNotNone(brief["component_intelligence"])
        self.assertIn("existing_problem", brief)
        self.assertIn("why_it_matters", brief)
        self.assertIn("if_no_action", brief)
        self.assertIn("proposed_solution", brief)
        self.assertIn("why_solution", brief)
        self.assertIn("result", brief)
        self.assertIn("L1", brief["existing_problem"])
        self.assertIn("100", brief["existing_problem"])
        self.assertNotIn("authored intervention demonstration", brief["if_no_action"].lower())
        self.assertNotIn("fixed no-action demonstration", brief["if_no_action"].lower())
        self.assertNotIn("This fixed no-action", brief["explanation"])

    def test_no_action_text_is_not_old_hardcoded_demo(self):
        result = run_health_bob_scenario(L1_CONTEXT, "NO_ACTION", include_bob=False)
        text = f"{result['explanation']} {result.get('if_no_action', '')} {result.get('result', '')}".lower()
        self.assertNotIn("fixed no-action demonstration", text)
        self.assertNotIn("authored intervention demonstration", text)
        self.assertNotIn("no new capacity, discharge, improvement percentage", text)
        self.assertIn("l1", text)

    def test_proposed_solution_uses_deterministic_simulation(self):
        result = run_health_bob_scenario(L1_CONTEXT, "INCREASE_STORAGE", include_bob=False)
        metrics = result["simulation_metrics"]
        self.assertTrue(metrics.get("from_simulation"))
        self.assertEqual(metrics.get("fixture_id"), "standard")
        self.assertEqual(metrics.get("recommendation_status"), "recommended")
        self.assertEqual(metrics.get("selected_candidate_id"), "C-L2")
        self.assertEqual(metrics.get("diverted_volume_m3"), 200.0)
        self.assertIn("AEGIS assessment", result["result"])
        self.assertIn("200.0 m³", result["result"])
        self.assertNotIn("authored intervention demonstration", result["explanation"].lower())

    def test_api_endpoints(self):
        client = TestClient(app)
        intel = client.get("/api/v1/monitor/component-intelligence", params={"component_id": "L1"})
        self.assertEqual(intel.status_code, 200)
        self.assertEqual(intel.json()["component"]["observed_storage_m3"], 100.0)

        with patch("backend.intelligence.health_bob.run_bob", return_value={"ok": False, "error": "missing_api_key"}):
            brief = client.post("/api/v1/monitor/health-bob", json={"context": L1_CONTEXT})
        self.assertEqual(brief.status_code, 200)
        body = brief.json()
        self.assertIn("existing_problem", body)
        self.assertEqual(body["component_id"], "L1")

        scenario = client.post(
            "/api/v1/monitor/health-bob/scenario",
            json={"context": L1_CONTEXT, "scenario_id": "INCREASE_STORAGE"},
        )
        self.assertEqual(scenario.status_code, 200)
        sim = scenario.json()
        self.assertTrue(sim["simulation_metrics"]["from_simulation"])
        self.assertEqual(sim["simulation_metrics"]["selected_candidate_id"], "C-L2")


if __name__ == "__main__":
    unittest.main()
