"""Focused Bob intelligence tests — subprocess mocked; no real BOB_API_KEY."""

from __future__ import annotations

import json
import os
import subprocess
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.intelligence.bob_service import run_bob, try_parse_json_message
from backend.intelligence.build_bob import V2_CANDIDATES, handle_build_bob_design
from backend.intelligence.monitor_bob import (
    ALLOWED_SIMULATION_ACTIONS,
    handle_monitor_bob,
)
from backend.main import app
from backend.integration.build_bridge import run_build_simulation


def _completed(stdout: str, returncode: int = 0) -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(
        args=["bob"], returncode=returncode, stdout=stdout, stderr=""
    )


class BobServiceTests(unittest.TestCase):
    def test_parses_successful_bob_json(self):
        payload = {"last_message": "J3 is the controlling junction under the supplied risks."}

        def runner(argv, env, timeout):
            self.assertIn("bob", argv[0])
            self.assertIn("--format", argv)
            self.assertIn("json", argv)
            self.assertEqual(env.get("BOB_API_KEY"), "test-key")
            return _completed(json.dumps(payload))

        with patch.dict(os.environ, {"BOB_API_KEY": "test-key"}):
            result = run_bob("Why is J3 a risk?", runner=runner)

        self.assertTrue(result["ok"])
        self.assertEqual(result["last_message"], payload["last_message"])
        self.assertIsNone(result["error"])

    def test_handles_timeout(self):
        def runner(argv, env, timeout):
            raise subprocess.TimeoutExpired(cmd=argv, timeout=timeout)

        with patch.dict(os.environ, {"BOB_API_KEY": "test-key"}):
            result = run_bob("Explain L2", runner=runner)

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "timeout")
        self.assertIsNone(result["last_message"])

    def test_missing_api_key(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BOB_API_KEY", None)
            result = run_bob("Explain", runner=lambda *a, **k: _completed("{}"))
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "missing_api_key")


class MonitorBobTests(unittest.TestCase):
    def test_explanation_from_bob(self):
        def runner(argv, env, timeout):
            return _completed(json.dumps({"last_message": "L2 was selected because candidate C-L2 ranks highest under the supplied constraints."}))

        with patch.dict(os.environ, {"BOB_API_KEY": "test-key"}):
            result = handle_monitor_bob(
                "Why was L2 selected?",
                {"recommendation": {"selected_candidate_id": "C-L2"}},
                runner=runner,
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["source"], "bob")
        self.assertIn("L2", result["explanation"])
        self.assertIsNone(result["simulation_request"])

    def test_simulation_request_allowlisted(self):
        bob_json = {
            "type": "simulation_request",
            "action": "disable_component",
            "parameters": {"component_id": "L2"},
            "explanation": "Evaluate network without L2.",
        }

        def runner(argv, env, timeout):
            return _completed(json.dumps({"last_message": json.dumps(bob_json)}))

        with patch.dict(os.environ, {"BOB_API_KEY": "test-key"}):
            result = handle_monitor_bob(
                "What if L2 is unavailable?",
                {"fixture_id": "standard"},
                runner=runner,
            )

        sim = result["simulation_request"]
        self.assertIsNotNone(sim)
        self.assertEqual(sim["type"], "simulation_request")
        self.assertEqual(sim["action"], "disable_component")
        self.assertIn(sim["action"], ALLOWED_SIMULATION_ACTIONS)
        self.assertNotIn("shell", sim)
        self.assertIsNotNone(result["hydraulic_result"])
        self.assertFalse(result["hydraulic_result"]["baseline_mutated"])

    def test_rejects_arbitrary_shell_action(self):
        bob_json = {
            "type": "simulation_request",
            "action": "run_shell",
            "shell": "rm -rf /",
            "parameters": {},
            "explanation": "bad",
        }

        def runner(argv, env, timeout):
            return _completed(json.dumps({"last_message": json.dumps(bob_json)}))

        with patch.dict(os.environ, {"BOB_API_KEY": "test-key"}):
            # Non-what-if message so heuristic does not invent a sim.
            result = handle_monitor_bob(
                "Summarize the current recommendation.",
                {},
                runner=runner,
            )

        self.assertIsNone(result["simulation_request"])
        self.assertIn("Summarize", "Summarize the current recommendation.")

    def test_api_monitor_bob_endpoint(self):
        client = TestClient(app)

        def fake_run_bob(prompt, runner=None, **kw):
            return {
                "ok": True,
                "error": None,
                "last_message": "J3 depth constraint is active in the supplied context.",
                "raw": None,
            }

        with patch("backend.intelligence.monitor_bob.run_bob", side_effect=fake_run_bob):
            response = client.post(
                "/api/v1/monitor/bob",
                json={"message": "Why is J3 a risk?", "context": {"risks": [{"id": "r1"}]}},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("J3", body["explanation"])
        self.assertNotIn("BOB_API_KEY", json.dumps(body))
        self.assertNotIn("test-key", json.dumps(body))


class BuildBobTests(unittest.TestCase):
    def test_parses_candidate_response(self):
        candidates = {
            "candidates": [
                {
                    "id": "A",
                    "name": "Bob Balanced",
                    "recommended": True,
                    "rationale": "Bob rationale A",
                    "reliability_considerations": "Stale L2",
                    "tradeoffs": ["Moderate build"],
                    "network_changes": ["Add J5"],
                    "flood_risk_impact": "-99%",
                    "confidence": 1,
                },
                {"id": "B", "name": "Bob Min", "recommended": False, "rationale": "Bob B"},
                {"id": "C", "name": "Bob Max", "recommended": False, "rationale": "Bob C"},
            ]
        }

        def runner(argv, env, timeout):
            return _completed(json.dumps({"last_message": json.dumps(candidates)}))

        with patch.dict(os.environ, {"BOB_API_KEY": "test-key"}):
            result = handle_build_bob_design({"mode": "redesign"}, runner=runner)

        self.assertTrue(result["ok"])
        self.assertEqual(result["source"], "bob")
        self.assertEqual(len(result["candidates"]), 3)
        a = result["candidates"][0]
        self.assertEqual(a["rationale"], "Bob rationale A")
        # V2 metrics preserved — Bob must not overwrite demo flood impact.
        self.assertEqual(a["flood_risk_impact"], V2_CANDIDATES[0]["flood_risk_impact"])
        self.assertNotEqual(a["flood_risk_impact"], "-99%")

    def test_malformed_falls_back_to_v2(self):
        def runner(argv, env, timeout):
            return _completed(json.dumps({"last_message": "not json candidates"}))

        with patch.dict(os.environ, {"BOB_API_KEY": "test-key"}):
            result = handle_build_bob_design({}, runner=runner)

        self.assertFalse(result["ok"])
        self.assertEqual(result["source"], "v2_fallback")
        self.assertEqual(len(result["candidates"]), 3)
        self.assertEqual(result["candidates"][0]["id"], "A")
        self.assertEqual(
            result["candidates"][0]["flood_risk_impact"],
            V2_CANDIDATES[0]["flood_risk_impact"],
        )

    def test_active_design_flow_intact(self):
        active = {
            "nodes": [
                {"id": "J3", "kind": "junction", "proposed": False},
                {"id": "J5", "kind": "junction", "proposed": True},
            ],
            "links": [{"id": "P21", "from": "J3", "to": "J5", "proposed": True}],
        }
        result = run_build_simulation(
            {
                "mode": "redesign",
                "rainfall_scenario": "normal",
                "selected_candidate": "A",
                "revision": 4,
                "active_design": active,
            }
        )
        self.assertEqual(result["active_design"], active)
        self.assertEqual(result["display_metrics_source"], "frontend_v2")

    def test_try_parse_json_message_fenced(self):
        parsed = try_parse_json_message('```json\n{"candidates":[]}\n```')
        self.assertEqual(parsed, {"candidates": []})


if __name__ == "__main__":
    unittest.main()
