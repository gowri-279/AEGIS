
import unittest

from backend.network.fixtures import build_demo_network, get_demo_network_dict
from backend.network.validation import validate_network


class NetworkFixtureTests(unittest.TestCase):
    def test_canonical_node_ids(self):
        network = build_demo_network()
        self.assertEqual(
            {node.node_id for node in network.nodes},
            {"C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"},
        )

    def test_canonical_edge_ids_and_directions(self):
        network = build_demo_network()
        edges = {edge.edge_id: edge for edge in network.edges}

        self.assertEqual(
            set(edges),
            {
                "E-J3-L1", "E-J3-R1", "E-J3-L2",
                "E-C1-J3", "E-C2-J3",
                "E-L1-J4", "E-L2-J4", "E-J4-O1",
            },
        )
        self.assertEqual((edges["E-J3-L1"].source_node_id,
                          edges["E-J3-L1"].target_node_id), ("J3", "L1"))
        self.assertEqual((edges["E-J3-R1"].source_node_id,
                          edges["E-J3-R1"].target_node_id), ("J3", "R1"))
        self.assertEqual((edges["E-J3-L2"].source_node_id,
                          edges["E-J3-L2"].target_node_id), ("J3", "L2"))

    def test_confirmed_fixture_values(self):
        nodes = {node.node_id: node for node in build_demo_network().nodes}

        self.assertEqual(nodes["L1"].available_storage_m3, 100.0)
        self.assertEqual(nodes["L2"].available_storage_m3, 800.0)
        self.assertEqual(nodes["R1"].recharge_eligibility, "ineligible")

    def test_capacity_constraint_is_separate_from_physical_capacity(self):
        edges = {edge.edge_id: edge for edge in build_demo_network().edges}
        edge = edges["E-J3-L2"]

        self.assertIsNone(edge.capacity_m3_s)
        self.assertEqual(edge.candidate_capacity_constraint_m3_s, 0.5)
        self.assertEqual(edge.capacity_constraint_candidate_id, "C-L2")
        self.assertIsNone(edges["E-J3-L1"].capacity_m3_s)
        self.assertIsNone(edges["E-J3-R1"].capacity_m3_s)

    def test_unspecified_properties_remain_unspecified(self):
        network = build_demo_network()

        for node in network.nodes:
            self.assertIsNone(node.elevation_m)

        for edge in network.edges:
            self.assertIsNone(edge.length_m)

        for node_id in ("L1", "L2"):
            node = next(n for n in network.nodes if n.node_id == node_id)
            self.assertIsNone(node.storage_capacity_m3)
            self.assertIsNone(node.initial_occupied_storage_m3)

    def test_network_version_is_exposed(self):
        network = build_demo_network()
        network_dict = get_demo_network_dict()

        self.assertEqual(network.network_version, "1.0")
        self.assertEqual(network_dict["network_version"], "1.0")

    def test_fixture_passes_structural_validation(self):
        self.assertEqual(validate_network(build_demo_network()), [])

    def test_fixture_is_json_serializable(self):
        result = get_demo_network_dict()
        self.assertEqual(result["network_id"], "aegis_demo_catchment")
        self.assertEqual(len(result["nodes"]), 8)
        self.assertEqual(len(result["edges"]), 8)


if __name__ == "__main__":
    unittest.main()
