import unittest

from backend.integration.assembler import assemble_canonical_response


class CanonicalResponseAssemblerTests(unittest.TestCase):
    def setUp(self):
        self.assessed_state = {
            "risk_findings": [
                {"risk_id": "RISK-1", "severity": "high"}
            ]
        }
        self.recommendation = {
            "recommendation_status": "recommended",
            "selected_candidate_id": "C-L2",
            "recommendation_scope": "limited_mvp_scope",
            "safety_qualified": False,
            "rationale": [],
            "uncertainty": [],
            "data_limitations": [],
        }

    def assemble(self):
        return assemble_canonical_response(
            network={"network_id": "aegis_demo_catchment"},
            network_state={"sensors": []},
            assessed_state=self.assessed_state,
            scenario={"scenario_id": "storage_and_recharge_demo"},
            candidate_evaluations=[],
            simulation_result={},
            baseline_comparison={},
            ranking=[],
            recommendation=self.recommendation,
        )

    def test_combines_all_p1_and_p3_fields(self):
        response = self.assemble()

        expected_fields = {
            "network",
            "network_state",
            "assessed_state",
            "scenario",
            "candidate_evaluations",
            "simulation_result",
            "baseline_comparison",
            "ranking",
            "recommendation",
            "risks",
        }
        self.assertEqual(set(response), expected_fields)

    def test_top_level_risks_mirror_canonical_risk_findings(self):
        response = self.assemble()

        self.assertEqual(
            response["risks"],
            response["assessed_state"]["risk_findings"],
        )

    def test_output_does_not_mutate_input_data(self):
        response = self.assemble()
        response["risks"].append({"risk_id": "EXTRA"})

        self.assertEqual(len(self.assessed_state["risk_findings"]), 1)

    def test_missing_risk_findings_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "risk_findings"):
            assemble_canonical_response(
                network={},
                network_state={},
                assessed_state={},
                scenario={},
                candidate_evaluations=[],
                simulation_result={},
                baseline_comparison={},
                ranking=[],
                recommendation=self.recommendation,
            )


if __name__ == "__main__":
    unittest.main()
