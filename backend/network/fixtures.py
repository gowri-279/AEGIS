from .models import Edge, Network, Node
from .validation import validate_network


def build_demo_network() -> Network:
    """Build the team-agreed, synthetic AEGIS MVP network.

    The C-L2 candidate-specific capacity constraint of 0.5 m³/s is
    retained separately from physical edge capacity. It is not evidence
    of a measured physical capacity.

    Unknown physical capacities, elevations, lengths, total storage
    capacities, initial occupancy, and downstream boundary conditions
    remain unspecified.
    """
    return Network(
        network_id="aegis_demo_catchment",
        nodes=[
            Node(node_id="C1", node_type="collection_inlet"),
            Node(node_id="C2", node_type="collection_inlet"),
            Node(node_id="J3", node_type="junction"),
            Node(
                node_id="L1",
                node_type="storage",
                available_storage_m3=100.0,
            ),
            Node(
                node_id="R1",
                node_type="recharge",
                recharge_eligibility="ineligible",
            ),
            Node(
                node_id="L2",
                node_type="storage",
                available_storage_m3=800.0,
            ),
            Node(node_id="J4", node_type="junction"),
            Node(node_id="O1", node_type="outlet"),
        ],
        edges=[
            # Original approved edges: preserve IDs and directions.
            Edge(
                edge_id="E-J3-L1",
                source_node_id="J3",
                target_node_id="L1",
            ),
            Edge(
                edge_id="E-J3-R1",
                source_node_id="J3",
                target_node_id="R1",
            ),
            Edge(
                edge_id="E-J3-L2",
                source_node_id="J3",
                target_node_id="L2",
                candidate_capacity_constraint_m3_s=0.5,
                capacity_constraint_candidate_id="C-L2",
            ),
            # Team-approved topology additions.
            Edge(
                edge_id="E-C1-J3",
                source_node_id="C1",
                target_node_id="J3",
            ),
            Edge(
                edge_id="E-C2-J3",
                source_node_id="C2",
                target_node_id="J3",
            ),
            Edge(
                edge_id="E-L1-J4",
                source_node_id="L1",
                target_node_id="J4",
            ),
            Edge(
                edge_id="E-L2-J4",
                source_node_id="L2",
                target_node_id="J4",
            ),
            Edge(
                edge_id="E-J4-O1",
                source_node_id="J4",
                target_node_id="O1",
            ),
        ],
    )


def get_demo_network_dict() -> dict:
    """Return the demo network as a JSON-serializable dictionary."""
    network = build_demo_network()
    errors = validate_network(network)

    if errors:
        raise ValueError(f"Invalid demo network: {errors}")

    return network.to_dict()
