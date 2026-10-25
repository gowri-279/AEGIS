
from typing import Any


def calculate_modeled_network_utilization(
    affected_edges: list[dict[str, Any]],
) -> float | None:
    """
    Calculate maximum post-intervention flow/capacity ratio.

    Only modeled affected edges with a defined positive capacity
    are eligible. Missing required flow data makes the overall
    utilization unavailable rather than treating it as zero.
    """

    utilizations = []

    for edge in affected_edges:
        capacity = edge.get("capacity_m3_s")

        # Edges without a defined positive capacity are not eligible.
        if capacity is None or capacity <= 0:
            continue

        flow = edge.get("post_intervention_flow_m3_s")

        # A required flow value cannot be assumed to be zero.
        if flow is None:
            return None

        if flow < 0:
            raise ValueError(
                "Post-intervention flow cannot be negative"
            )

        utilizations.append(flow / capacity)

    # No eligible edges means utilization is unavailable.
    if not utilizations:
        return None

    return max(utilizations)


def calculate_remaining_storage(
    capacity_m3: float | None,
    occupied_m3: float | None,
) -> float | None:
    """Calculate remaining storage when both inputs are valid."""

    if capacity_m3 is None or occupied_m3 is None:
        return None

    if capacity_m3 < 0 or occupied_m3 < 0:
        raise ValueError("Storage values cannot be negative")

    if occupied_m3 > capacity_m3:
        raise ValueError(
            "Occupied storage cannot exceed capacity"
        )

    return capacity_m3 - occupied_m3
