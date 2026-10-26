from math import isfinite

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

    def finite(value, label):
        if value is None:
            return False
        if not isfinite(value):
            errors.append(f"{label}: value must be finite")
            return False
        return True

    for node in network.nodes:
        numeric = {
            "elevation_m": node.elevation_m,
            "storage_capacity_m3": node.storage_capacity_m3,
            "initial_occupied_storage_m3": node.initial_occupied_storage_m3,
            "available_storage_m3": node.available_storage_m3,
        }
        valid = {
            name: finite(value, f"{node.node_id}.{name}")
            for name, value in numeric.items()
        }

        capacity = node.storage_capacity_m3
        occupied = node.initial_occupied_storage_m3
        available = node.available_storage_m3

        if valid["storage_capacity_m3"] and capacity < 0:
            errors.append(f"{node.node_id}: storage capacity cannot be negative")

        if valid["initial_occupied_storage_m3"] and occupied < 0:
            errors.append(f"{node.node_id}: occupied storage cannot be negative")

        if valid["available_storage_m3"] and available < 0:
            errors.append(f"{node.node_id}: available storage cannot be negative")

        if (
            valid["storage_capacity_m3"]
            and valid["initial_occupied_storage_m3"]
            and occupied > capacity
        ):
            errors.append(f"{node.node_id}: occupied storage exceeds capacity")

        if all(valid[name] for name in (
            "storage_capacity_m3",
            "initial_occupied_storage_m3",
            "available_storage_m3",
        )):
            if abs((capacity - occupied) - available) > 1e-9:
                errors.append(f"{node.node_id}: available storage is inconsistent")

        if node.recharge_eligibility not in (
            None, "eligible", "ineligible", "not_evaluated"
        ):
            errors.append(f"{node.node_id}: invalid recharge eligibility")

    for edge in network.edges:
        numeric = {
            "capacity_m3_s": edge.capacity_m3_s,
            "length_m": edge.length_m,
            "candidate_capacity_constraint_m3_s":
                edge.candidate_capacity_constraint_m3_s,
        }
        valid = {
            name: finite(value, f"{edge.edge_id}.{name}")
            for name, value in numeric.items()
        }

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

        if valid["capacity_m3_s"] and edge.capacity_m3_s <= 0:
            errors.append(f"{edge.edge_id}: capacity must be positive")

        if valid["length_m"] and edge.length_m < 0:
            errors.append(f"{edge.edge_id}: length cannot be negative")

        if (
            valid["candidate_capacity_constraint_m3_s"]
            and edge.candidate_capacity_constraint_m3_s <= 0
        ):
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
