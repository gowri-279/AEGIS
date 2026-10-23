
import unittest

from backend.network.models import Edge, Network, Node
from backend.network.validation import validate_network


class NetworkValidationTests(unittest.TestCase):
    def setUp(self):
        self.network = Network(
            network_id="test_network",
            nodes=[
                Node(node_id="J3", node_type="junction"),
                Node(node_id="L1", node_type="storage"),
            ],
            edges=[
                Edge(
                    edge_id="E-J3-L1",
                    source_node_id="J3",
                    target_node_id="L1",
                    capacity_m3_s=0.5,
                )
            ],
        )

    def test_valid_network(self):
        self.assertEqual(validate_network(self.network), [])

    def test_duplicate_node_ids_are_rejected(self):
        self.network.nodes.append(
            Node(node_id="J3", node_type="junction")
        )
        self.assertTrue(
            any("node IDs must be unique" in error
                for error in validate_network(self.network))
        )

    def test_unknown_edge_endpoint_is_rejected(self):
        self.network.edges[0].target_node_id = "UNKNOWN"
        self.assertTrue(
            any("unknown target node" in error
                for error in validate_network(self.network))
        )

    def test_non_positive_edge_capacity_is_rejected(self):
        self.network.edges[0].capacity_m3_s = 0
        self.assertTrue(
            any("capacity must be positive" in error
                for error in validate_network(self.network))
        )

    def test_occupied_storage_cannot_exceed_capacity(self):
        self.network.nodes[1].storage_capacity_m3 = 100
        self.network.nodes[1].initial_occupied_storage_m3 = 120
        self.assertTrue(
            any("occupied storage exceeds capacity" in error
                for error in validate_network(self.network))
        )


if __name__ == "__main__":
    unittest.main()
