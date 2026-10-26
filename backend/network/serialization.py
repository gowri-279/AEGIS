"""Frontend-facing serialization for the canonical AEGIS network.

This module exposes canonical infrastructure data only. It does not invent
physical measurements, spatial coordinates, or frontend presentation geometry.
"""

from .models import Network
from .validation import validate_network


def serialize_network(network: Network) -> dict:
    """Serialize a validated network into a generic frontend-facing schema.

    Unknown engineering properties remain None, which JSON serialization
    represents as null. Candidate-specific constraints remain separate from
    physical edge capacity.
    """
    errors = validate_network(network)
    if errors:
        raise ValueError(f"Invalid network: {errors}")

    return {
        "network_id": network.network_id,
        "network_version": network.network_version,
        "nodes": [
            {
                "id": node.node_id,
                "type": node.node_type,
                "elevation_m": node.elevation_m,
                "storage_capacity_m3": node.storage_capacity_m3,
                "initial_occupied_storage_m3": (
                    node.initial_occupied_storage_m3
                ),
                "available_storage_m3": node.available_storage_m3,
                "recharge_eligibility": node.recharge_eligibility,
            }
            for node in network.nodes
        ],
        "edges": [
            {
                "id": edge.edge_id,
                "from": edge.source_node_id,
                "to": edge.target_node_id,
                "capacity_m3_s": edge.capacity_m3_s,
                "length_m": edge.length_m,
                "candidate_capacity_constraint_m3_s": (
                    edge.candidate_capacity_constraint_m3_s
                ),
                "capacity_constraint_candidate_id": (
                    edge.capacity_constraint_candidate_id
                ),
            }
            for edge in network.edges
        ],
    }
