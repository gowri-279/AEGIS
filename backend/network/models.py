
from dataclasses import asdict, dataclass
from typing import Optional


@dataclass
class Node:
    node_id: str
    node_type: str
    elevation_m: Optional[float] = None
    storage_capacity_m3: Optional[float] = None
    initial_occupied_storage_m3: Optional[float] = None
    available_storage_m3: Optional[float] = None
    recharge_eligibility: Optional[str] = None


@dataclass
class Edge:
    edge_id: str
    source_node_id: str
    target_node_id: str
    capacity_m3_s: Optional[float] = None
    length_m: Optional[float] = None
    candidate_capacity_constraint_m3_s: Optional[float] = None
    capacity_constraint_candidate_id: Optional[str] = None

@dataclass
class Network:
    network_id: str
    nodes: list[Node]
    edges: list[Edge]
    network_version: str = "1.0"

    def to_dict(self) -> dict:
        """Return a JSON-serializable representation of the network."""
        return asdict(self)
