
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


    def test_non_finite_numeric_values_are_rejected(self):
        import math

        cases = [
            (self.network.nodes[0], "elevation_m"),
            (self.network.nodes[1], "storage_capacity_m3"),
            (self.network.nodes[1], "initial_occupied_storage_m3"),
            (self.network.nodes[1], "available_storage_m3"),
            (self.network.edges[0], "capacity_m3_s"),
            (self.network.edges[0], "length_m"),
            (self.network.edges[0], "candidate_capacity_constraint_m3_s"),
        ]

        for target, field in cases:
            for value in (math.nan, math.inf, -math.inf):
                with self.subTest(field=field, value=value):
                    original = getattr(target, field)
                    try:
                        setattr(target, field, value)
                        errors = validate_network(self.network)
                        self.assertTrue(
                            any("must be finite" in error for error in errors),
                            f"{field} accepted non-finite value {value}",
                        )
                    finally:
                        setattr(target, field, original)

    def test_unknown_numeric_values_remain_allowed(self):
        self.network.nodes[0].elevation_m = None
        self.network.edges[0].length_m = None
        self.assertEqual(validate_network(self.network), [])


if __name__ == "__main__":
    unittest.main()
