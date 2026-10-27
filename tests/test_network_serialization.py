import unittest

from backend.network.fixtures import build_demo_network
from backend.network.serialization import serialize_network


class TestNetworkSerialization(unittest.TestCase):
    def test_exposes_network_version_and_generic_topology(self):
        result = serialize_network(build_demo_network())

        self.assertEqual(result["network_id"], "aegis_demo_catchment")
        self.assertEqual(result["network_version"], "1.0")
        self.assertEqual(len(result["nodes"]), 8)
        self.assertEqual(len(result["edges"]), 8)

        self.assertEqual(
            set(result["nodes"][0]),
            {
                "id",
                "type",
                "elevation_m",
                "storage_capacity_m3",
                "initial_occupied_storage_m3",
                "available_storage_m3",
                "recharge_eligibility",
            },
        )
        self.assertEqual(
            set(result["edges"][0]),
            {
                "id",
                "from",
                "to",
                "capacity_m3_s",
                "length_m",
                "candidate_capacity_constraint_m3_s",
                "capacity_constraint_candidate_id",
            },
        )

    def test_preserves_connections_without_hardcoded_rendering_rules(self):
        result = serialize_network(build_demo_network())
        node_ids = {node["id"] for node in result["nodes"]}

        for edge in result["edges"]:
            self.assertIn(edge["from"], node_ids)
            self.assertIn(edge["to"], node_ids)

    def test_unknown_physical_values_remain_none(self):
        result = serialize_network(build_demo_network())

        j3 = next(node for node in result["nodes"] if node["id"] == "J3")
        self.assertIsNone(j3["elevation_m"])

        edge = next(
            edge for edge in result["edges"] if edge["id"] == "E-J3-L2"
        )
        self.assertIsNone(edge["capacity_m3_s"])
        self.assertEqual(edge["candidate_capacity_constraint_m3_s"], 0.5)
        self.assertEqual(edge["capacity_constraint_candidate_id"], "C-L2")

    def test_invalid_network_is_rejected(self):
        network = build_demo_network()
        network.edges[0].target_node_id = "UNKNOWN"

        with self.assertRaisesRegex(ValueError, "Invalid network"):
            serialize_network(network)


if __name__ == "__main__":
    unittest.main()
