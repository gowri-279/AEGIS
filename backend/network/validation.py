
from .models import Network


def validate_network(network: Network) -> list[str]:
    """Return validation errors; an empty list means the structure is valid."""
    errors = []

    if not network.network_id.strip():
        errors.append("network_id must not be empty")

    node_ids = [node.node_id for node in network.nodes]
    edge_ids = [edge.edge_id for edge in network.edges]

    if any(not node_id.strip() for node_id in node_ids):
        errors.append("node IDs must not be empty")

    if len(node_ids) != len(set(node_ids)):
        errors.append("node IDs must be unique")

    if any(not edge_id.strip() for edge_id in edge_ids):
        errors.append("edge IDs must not be empty")

    if len(edge_ids) != len(set(edge_ids)):
        errors.append("edge IDs must be unique")

    known_nodes = set(node_ids)

    for node in network.nodes:
        capacity = node.storage_capacity_m3
        occupied = node.initial_occupied_storage_m3
        available = node.available_storage_m3

        if capacity is not None and capacity < 0:
            errors.append(f"{node.node_id}: storage capacity cannot be negative")

        if occupied is not None and occupied < 0:
            errors.append(f"{node.node_id}: occupied storage cannot be negative")

        if available is not None and available < 0:
            errors.append(f"{node.node_id}: available storage cannot be negative")

        if capacity is not None and occupied is not None and occupied > capacity:
            errors.append(f"{node.node_id}: occupied storage exceeds capacity")

        if capacity is not None and occupied is not None and available is not None:
            if abs((capacity - occupied) - available) > 1e-9:
                errors.append(f"{node.node_id}: available storage is inconsistent")

        if node.recharge_eligibility not in (None, "eligible", "ineligible", "not_evaluated"):
            errors.append(f"{node.node_id}: invalid recharge eligibility")

    for edge in network.edges:
        if edge.source_node_id not in known_nodes:
            errors.append(
                f"{edge.edge_id}: unknown source node {edge.source_node_id}"
            )

        if edge.target_node_id not in known_nodes:
            errors.append(
                f"{edge.edge_id}: unknown target node {edge.target_node_id}"
            )

        if edge.source_node_id == edge.target_node_id:
            errors.append(f"{edge.edge_id}: source and target must differ")

        if edge.capacity_m3_s is not None and edge.capacity_m3_s <= 0:
            errors.append(f"{edge.edge_id}: capacity must be positive")

        if edge.length_m is not None and edge.length_m < 0:
            errors.append(f"{edge.edge_id}: length cannot be negative")

        if edge.candidate_capacity_constraint_m3_s is not None:
            if edge.candidate_capacity_constraint_m3_s <= 0:
                errors.append(
                    f"{edge.edge_id}: candidate capacity constraint must be positive"
                )

        if (
            edge.candidate_capacity_constraint_m3_s is not None
            and not edge.capacity_constraint_candidate_id
        ):
            errors.append(
                f"{edge.edge_id}: candidate ID required for candidate capacity constraint"
            )

    return errors
