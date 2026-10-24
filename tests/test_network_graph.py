import unittest

from backend.network.fixtures import build_demo_network
from backend.network.graph import (
    get_connectivity_diagnostics,
    get_edge,
    get_neighbors,
    get_network_summary,
    get_node,
    get_weakly_connected_components,
)
from backend.network.models import Edge, Network, Node


class NetworkGraphTests(unittest.TestCase):
    def setUp(self):
        self.network = build_demo_network()

    def test_get_node(self):
        self.assertEqual(get_node(self.network, "J3").node_type, "junction")

    def test_get_node_rejects_unknown_id(self):
        with self.assertRaises(KeyError):
            get_node(self.network, "UNKNOWN")

    def test_get_edge(self):
        edge = get_edge(self.network, "E-J3-L2")
        self.assertEqual(edge.source_node_id, "J3")
        self.assertEqual(edge.target_node_id, "L2")

    def test_get_edge_rejects_unknown_id(self):
        with self.assertRaises(KeyError):
            get_edge(self.network, "UNKNOWN")

    def test_outgoing_neighbors(self):
        neighbors = get_neighbors(self.network, "J3")
        self.assertEqual(
            [node.node_id for node in neighbors],
            ["L1", "R1", "L2"],
        )

    def test_incoming_neighbors(self):
        neighbors = get_neighbors(self.network, "L1", direction="incoming")
        self.assertEqual([node.node_id for node in neighbors], ["J3"])

    def test_both_direction_neighbors_do_not_duplicate_nodes(self):
        network = Network(
            network_id="two_way_test",
            nodes=[Node("A", "junction"), Node("B", "storage")],
            edges=[
                Edge("E1", "A", "B"),
                Edge("E2", "B", "A"),
            ],
        )
        neighbors = get_neighbors(network, "A", direction="both")
        self.assertEqual([node.node_id for node in neighbors], ["B"])

    def test_invalid_neighbor_direction(self):
        with self.assertRaises(ValueError):
            get_neighbors(self.network, "J3", direction="sideways")

    def test_demo_network_is_weakly_connected(self):
        diagnostics = get_connectivity_diagnostics(self.network)
        self.assertTrue(diagnostics["is_weakly_connected"])
        self.assertEqual(diagnostics["component_count"], 1)

    def test_disconnected_component_is_reported(self):
        network = Network(
            network_id="disconnected_test",
            nodes=[
                Node("A", "junction"),
                Node("B", "storage"),
                Node("C", "outlet"),
            ],
            edges=[Edge("E1", "A", "B")],
        )
        diagnostics = get_connectivity_diagnostics(network)
        self.assertFalse(diagnostics["is_weakly_connected"])
        self.assertEqual(diagnostics["component_count"], 2)
        self.assertEqual(
            diagnostics["components"],
            [["A", "B"], ["C"]],
        )

    def test_empty_network_is_not_reported_as_connected(self):
        network = Network(network_id="empty_test", nodes=[], edges=[])
        diagnostics = get_connectivity_diagnostics(network)
        self.assertFalse(diagnostics["is_weakly_connected"])
        self.assertEqual(diagnostics["component_count"], 0)

    def test_network_summary(self):
        summary = get_network_summary(self.network)
        self.assertEqual(summary["node_count"], 4)
        self.assertEqual(summary["edge_count"], 3)
        self.assertEqual(
            summary["node_type_counts"],
            {"junction": 1, "recharge": 1, "storage": 2},
        )
        self.assertTrue(summary["is_weakly_connected"])


if __name__ == "__main__":
    unittest.main()
