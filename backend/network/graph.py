"""Reusable graph operations for the canonical AEGIS network."""

from .models import Edge, Network, Node


def get_node(network: Network, node_id: str) -> Node:
    """Return a node by ID, or raise KeyError if it does not exist."""
    for node in network.nodes:
        if node.node_id == node_id:
            return node
    raise KeyError(f"Unknown node ID: {node_id}")


def get_edge(network: Network, edge_id: str) -> Edge:
    """Return an edge by ID, or raise KeyError if it does not exist."""
    for edge in network.edges:
        if edge.edge_id == edge_id:
            return edge
    raise KeyError(f"Unknown edge ID: {edge_id}")


def get_neighbors(
    network: Network,
    node_id: str,
    direction: str = "outgoing",
) -> list[Node]:
    """Return adjacent nodes in the requested direction.

    direction may be 'outgoing', 'incoming', or 'both'.
    Results follow the node order in the canonical network.
    """
    get_node(network, node_id)

    if direction not in {"outgoing", "incoming", "both"}:
        raise ValueError(
            "direction must be 'outgoing', 'incoming', or 'both'"
        )

    neighbor_ids = set()

    for edge in network.edges:
        if direction in {"outgoing", "both"} and edge.source_node_id == node_id:
            neighbor_ids.add(edge.target_node_id)

        if direction in {"incoming", "both"} and edge.target_node_id == node_id:
            neighbor_ids.add(edge.source_node_id)

    return [
        node for node in network.nodes
        if node.node_id in neighbor_ids
    ]


def get_weakly_connected_components(network: Network) -> list[list[str]]:
    """Return components when edge directions are ignored.

    This diagnoses structural connectivity; it does not imply that flow
    can travel in both directions.
    """
    adjacency = {node.node_id: set() for node in network.nodes}

    for edge in network.edges:
        if edge.source_node_id in adjacency and edge.target_node_id in adjacency:
            adjacency[edge.source_node_id].add(edge.target_node_id)
            adjacency[edge.target_node_id].add(edge.source_node_id)

    components = []
    visited = set()

    for node in network.nodes:
        start = node.node_id
        if start in visited:
            continue

        stack = [start]
        visited.add(start)
        component = []

        while stack:
            current = stack.pop()
            component.append(current)

            for neighbor_id in adjacency[current]:
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    stack.append(neighbor_id)

        # Keep component IDs in the canonical node order.
        component_set = set(component)
        components.append([
            item.node_id for item in network.nodes
            if item.node_id in component_set
        ])

    return components


def get_connectivity_diagnostics(network: Network) -> dict:
    """Report weak connectivity without changing the network."""
    components = get_weakly_connected_components(network)

    return {
        "network_id": network.network_id,
        "is_weakly_connected": len(components) == 1 and bool(network.nodes),
        "component_count": len(components),
        "components": components,
    }


def get_network_summary(network: Network) -> dict:
    """Return a compact structural summary of the network."""
    node_type_counts = {}

    for node in network.nodes:
        node_type_counts[node.node_type] = (
            node_type_counts.get(node.node_type, 0) + 1
        )

    diagnostics = get_connectivity_diagnostics(network)

    return {
        "network_id": network.network_id,
        "node_count": len(network.nodes),
        "edge_count": len(network.edges),
        "node_type_counts": dict(sorted(node_type_counts.items())),
        "is_weakly_connected": diagnostics["is_weakly_connected"],
        "component_count": diagnostics["component_count"],
    }
