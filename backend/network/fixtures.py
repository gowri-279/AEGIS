
from .models import Edge, Network, Node
from .validation import validate_network


def build_demo_network() -> Network:
    """Build the team-agreed, synthetic AEGIS MVP network.

    CONTRACT.md v1.0 confirms the C-L2 candidate-level capacity constraint
    of 0.5 m³/s. Mapping that constraint to E-J3-L2 is a team-agreed MVP
    implementation decision, not a physical edge capacity established
    independently by the contract.

    Unspecified physical capacities, elevations, lengths, total storage
    capacities, and initial occupancy remain None.
    """
    return Network(
        network_id="aegis_demo_catchment",
        nodes=[
            Node(
                node_id="J3",
                node_type="junction",
                elevation_m=None,
            ),
            Node(
                node_id="L1",
                node_type="storage",
                elevation_m=None,
                storage_capacity_m3=None,
                initial_occupied_storage_m3=None,
                available_storage_m3=100.0,
            ),
            Node(
                node_id="R1",
                node_type="recharge",
                elevation_m=None,
                recharge_eligibility="ineligible",
            ),
            Node(
                node_id="L2",
                node_type="storage",
                elevation_m=None,
                storage_capacity_m3=None,
                initial_occupied_storage_m3=None,
                available_storage_m3=800.0,
            ),
        ],
        edges=[
            Edge(
                edge_id="E-J3-L1",
                source_node_id="J3",
                target_node_id="L1",
                capacity_m3_s=None,
                length_m=None,
            ),
            Edge(
                edge_id="E-J3-R1",
                source_node_id="J3",
                target_node_id="R1",
                capacity_m3_s=None,
                length_m=None,
            ),
            Edge(
                edge_id="E-J3-L2",
                source_node_id="J3",
                target_node_id="L2",
                capacity_m3_s=None,
                length_m=None,
                candidate_capacity_constraint_m3_s=0.5,
                capacity_constraint_candidate_id="C-L2",
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
