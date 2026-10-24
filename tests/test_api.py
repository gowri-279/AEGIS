import unittest

from fastapi.testclient import TestClient

from backend.main import app


class NetworkAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_endpoint(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_network_endpoint_returns_canonical_topology(self):
        response = self.client.get("/api/v1/network")

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["network_id"], "aegis_demo_catchment")
        self.assertEqual(data["network_version"], "1.0")
        self.assertEqual(len(data["nodes"]), 8)
        self.assertEqual(len(data["edges"]), 8)

    def test_network_edges_reference_existing_nodes(self):
        data = self.client.get("/api/v1/network").json()
        node_ids = {node["id"] for node in data["nodes"]}

        for edge in data["edges"]:
            self.assertIn(edge["from"], node_ids)
            self.assertIn(edge["to"], node_ids)

    def test_unknown_physical_properties_are_json_null(self):
        data = self.client.get("/api/v1/network").json()

        j3 = next(node for node in data["nodes"] if node["id"] == "J3")
        self.assertIsNone(j3["elevation_m"])

        edge = next(
            edge for edge in data["edges"] if edge["id"] == "E-J3-L2"
        )
        self.assertIsNone(edge["capacity_m3_s"])
        self.assertEqual(edge["candidate_capacity_constraint_m3_s"], 0.5)


if __name__ == "__main__":
    unittest.main()
