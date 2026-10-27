"""Canonical AEGIS component/edge model — deterministic, shared source of truth.

Static values only. Reuses canonical demo figures (L1 100/200 m³, J3 0.60/0.80 m, WL-J3 0.94).
Enrichment for Monitor Bob / profiles; does not override P1/P2/P3 calculated findings.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any


COMPONENTS: dict[str, dict[str, Any]] = {
    "C1": {
        "component_id": "C1",
        "name": "Collection Inlet C1",
        "component_type": "collection_inlet",
        "status": "Nominal",
        "elevation_m": 822.4,
        "storage_capacity_m3": None,
        "observed_storage_m3": None,
        "available_storage_m3": None,
        "flow_capacity_m3_s": 0.45,
        "observed_flow_m3_s": 0.18,
        "water_depth_m": None,
        "water_depth_threshold_m": None,
        "recharge_eligibility": None,
        "discharge_capacity_m3_s": None,
        "inflow_sources": ["catchment_west"],
        "downstream_components": ["J3"],
        "health_status": "nominal",
        "sensor": {
            "sensor_id": "FL-C1",
            "sensor_type": "inflow_rate",
            "status": "fresh",
            "confidence": 0.91,
            "observed_value": 0.18,
            "unit": "m³/s",
        },
        "sensor_status": "fresh",
        "sensor_confidence": 0.91,
        "relevant_threshold": {
            "variable": "inflow_m3_s",
            "observed": 0.18,
            "limit": 0.45,
            "unit": "m³/s",
        },
        "identified_constraint": None,
        "current_problem": None,
        "problem_severity": None,
        "downstream_sensitivity": "moderate",
        "engineering_significance": (
            "Western catchment inlet feeding J3; primary contributor to junction loading."
        ),
        "candidate_id": None,
        "feasibility": None,
        "constraint_checks": [],
    },
    "C2": {
        "component_id": "C2",
        "name": "Collection Inlet C2",
        "component_type": "collection_inlet",
        "status": "Nominal",
        "elevation_m": 821.8,
        "storage_capacity_m3": None,
        "observed_storage_m3": None,
        "available_storage_m3": None,
        "flow_capacity_m3_s": 0.40,
        "observed_flow_m3_s": 0.16,
        "water_depth_m": None,
        "water_depth_threshold_m": None,
        "recharge_eligibility": None,
        "discharge_capacity_m3_s": None,
        "inflow_sources": ["catchment_east"],
        "downstream_components": ["J3"],
        "health_status": "nominal",
        "sensor": {
            "sensor_id": "FL-C2",
            "sensor_type": "inflow_rate",
            "status": "fresh",
            "confidence": 0.89,
            "observed_value": 0.16,
            "unit": "m³/s",
        },
        "sensor_status": "fresh",
        "sensor_confidence": 0.89,
        "relevant_threshold": {
            "variable": "inflow_m3_s",
            "observed": 0.16,
            "limit": 0.40,
            "unit": "m³/s",
        },
        "identified_constraint": None,
        "current_problem": None,
        "problem_severity": None,
        "downstream_sensitivity": "moderate",
        "engineering_significance": (
            "Eastern catchment inlet feeding J3; combines with C1 at the controlling junction."
        ),
        "candidate_id": None,
        "feasibility": None,
        "constraint_checks": [],
    },
    "J3": {
        "component_id": "J3",
        "name": "Junction J3",
        "component_type": "junction",
        "status": "Attention",
        "elevation_m": 820.1,
        "storage_capacity_m3": None,
        "observed_storage_m3": None,
        "available_storage_m3": None,
        "flow_capacity_m3_s": 0.55,
        "observed_flow_m3_s": 0.34,
        "water_depth_m": 0.60,
        "water_depth_threshold_m": 0.80,
        "recharge_eligibility": None,
        "discharge_capacity_m3_s": None,
        "inflow_sources": ["C1", "C2"],
        "downstream_components": ["L1", "R1", "L2"],
        "health_status": "attention",
        "sensor": {
            "sensor_id": "WL-J3",
            "sensor_type": "water_depth",
            "status": "fresh",
            "confidence": 0.94,
            "observed_value": 0.60,
            "unit": "m",
        },
        "sensor_status": "fresh",
        "sensor_confidence": 0.94,
        "relevant_threshold": {
            "variable": "water_depth_m",
            "observed": 0.60,
            "limit": 0.80,
            "unit": "m",
        },
        "identified_constraint": "J3 water depth strictly below 0.80 m",
        "current_problem": "Elevated depth at J3",
        "problem_severity": "moderate",
        "downstream_sensitivity": "high",
        "engineering_significance": (
            "Controlling junction. Depth governs diversion eligibility toward L1/R1/L2; "
            "elevated depth concentrates surcharge risk toward the upstream catchment."
        ),
        "candidate_id": None,
        "feasibility": None,
        "constraint_checks": [
            {"description": "J3 water depth strictly below 0.80 m", "status": "pass"},
        ],
    },
    "L1": {
        "component_id": "L1",
        "name": "Storage L1",
        "component_type": "storage",
        "status": "Constrained",
        "elevation_m": 818.6,
        "storage_capacity_m3": 250.0,
        "observed_storage_m3": 100.0,
        "available_storage_m3": 100.0,
        "flow_capacity_m3_s": 0.30,
        "observed_flow_m3_s": 0.12,
        "water_depth_m": None,
        "water_depth_threshold_m": None,
        "recharge_eligibility": None,
        "discharge_capacity_m3_s": None,
        "inflow_sources": ["J3"],
        "downstream_components": ["J4"],
        "health_status": "constrained",
        "sensor": {
            "sensor_id": "ST-L1",
            "sensor_type": "storage_level",
            "status": "fresh",
            "confidence": 0.88,
            "observed_value": 100.0,
            "unit": "m³",
        },
        "sensor_status": "fresh",
        "sensor_confidence": 0.88,
        "relevant_threshold": {
            "variable": "available_storage_m3",
            "observed": 100.0,
            "limit": 200.0,
            "unit": "m³",
        },
        "identified_constraint": "Available storage ≥ diverted volume",
        "current_problem": "Limited storage at L1",
        "problem_severity": "low",
        "downstream_sensitivity": "high",
        "engineering_significance": (
            "Limited storage branch. Cannot absorb the standard 200 m³ diversion; "
            "routes residual load toward J4 when selected."
        ),
        "candidate_id": "C-L1",
        "feasibility": "infeasible",
        "constraint_checks": [
            {"description": "J3 water depth strictly below 0.80 m", "status": "pass"},
            {"description": "Available storage ≥ diverted volume", "status": "fail"},
        ],
    },
    "R1": {
        "component_id": "R1",
        "name": "Recharge R1",
        "component_type": "recharge",
        "status": "Ineligible",
        "elevation_m": 818.2,
        "storage_capacity_m3": None,
        "observed_storage_m3": None,
        "available_storage_m3": None,
        "flow_capacity_m3_s": 0.10,
        "observed_flow_m3_s": 0.02,
        "water_depth_m": None,
        "water_depth_threshold_m": None,
        "recharge_eligibility": "ineligible",
        "discharge_capacity_m3_s": None,
        "inflow_sources": ["J3"],
        "downstream_components": [],
        "health_status": "ineligible",
        "sensor": {
            "sensor_id": "RC-R1",
            "sensor_type": "recharge_rate",
            "status": "fresh",
            "confidence": 0.82,
            "observed_value": 0.02,
            "unit": "m³/s",
        },
        "sensor_status": "fresh",
        "sensor_confidence": 0.82,
        "relevant_threshold": None,
        "identified_constraint": "Recharge eligibility: ineligible (terminating branch)",
        "current_problem": None,
        "problem_severity": None,
        "downstream_sensitivity": "low",
        "engineering_significance": (
            "Terminating recharge branch. Not a preferred diversion route and has no "
            "connection onward to J4."
        ),
        "candidate_id": "C-R1",
        "feasibility": "ineligible",
        "constraint_checks": [
            {"description": "J3 water depth strictly below 0.80 m", "status": "pass"},
            {"description": "Recharge eligibility", "status": "fail"},
        ],
    },
    "L2": {
        "component_id": "L2",
        "name": "Storage L2",
        "component_type": "storage",
        "status": "Preferred candidate · observation stale",
        "elevation_m": 817.9,
        "storage_capacity_m3": 1200.0,
        "observed_storage_m3": 800.0,
        "available_storage_m3": 800.0,
        "flow_capacity_m3_s": 0.50,
        "observed_flow_m3_s": 0.22,
        "water_depth_m": None,
        "water_depth_threshold_m": None,
        "recharge_eligibility": None,
        "discharge_capacity_m3_s": None,
        "inflow_sources": ["J3"],
        "downstream_components": ["J4"],
        "health_status": "preferred_candidate",
        "sensor": {
            "sensor_id": "ST-L2",
            "sensor_type": "storage_level",
            "status": "stale",
            "confidence": 0.55,
            "observed_value": 800.0,
            "unit": "m³",
        },
        "sensor_status": "stale",
        "sensor_confidence": 0.55,
        "relevant_threshold": {
            "variable": "candidate_capacity_constraint_m3_s",
            "observed": 0.333,
            "limit": 0.5,
            "unit": "m³/s",
        },
        "identified_constraint": (
            "MVP candidate flow ≤ 0.5 m³/s; observation freshness reduced"
        ),
        "current_problem": None,
        "problem_severity": None,
        "downstream_sensitivity": "high",
        "engineering_significance": (
            "Primary feasible storage candidate under standard diversion. Larger available "
            "storage (800 m³) with a candidate capacity constraint of 0.5 m³/s; stale "
            "observation reduces confidence in L2-related recommendations."
        ),
        "candidate_id": "C-L2",
        "feasibility": "feasible",
        "constraint_checks": [
            {"description": "J3 water depth strictly below 0.80 m", "status": "pass"},
            {"description": "Available storage ≥ diverted volume", "status": "pass"},
            {"description": "Candidate capacity constraint ≤ 0.5 m³/s", "status": "pass"},
        ],
    },
    "J4": {
        "component_id": "J4",
        "name": "Downstream Junction J4",
        "component_type": "downstream_junction",
        "status": "Nominal",
        "elevation_m": 816.5,
        "storage_capacity_m3": None,
        "observed_storage_m3": None,
        "available_storage_m3": None,
        "flow_capacity_m3_s": 0.60,
        "observed_flow_m3_s": 0.28,
        "water_depth_m": None,
        "water_depth_threshold_m": None,
        "recharge_eligibility": None,
        "discharge_capacity_m3_s": None,
        "inflow_sources": ["L1", "L2"],
        "downstream_components": ["O1"],
        "health_status": "nominal",
        "sensor": {
            "sensor_id": "FL-J4",
            "sensor_type": "combined_flow",
            "status": "fresh",
            "confidence": 0.87,
            "observed_value": 0.28,
            "unit": "m³/s",
        },
        "sensor_status": "fresh",
        "sensor_confidence": 0.87,
        "relevant_threshold": {
            "variable": "combined_flow_m3_s",
            "observed": 0.28,
            "limit": 0.60,
            "unit": "m³/s",
        },
        "identified_constraint": "Downstream collector before outlet",
        "current_problem": None,
        "problem_severity": None,
        "downstream_sensitivity": "critical",
        "engineering_significance": (
            "Downstream collector combining L1/L2 discharges before O1. Sensitive to "
            "additional hydraulic transfer from storage branches."
        ),
        "candidate_id": None,
        "feasibility": None,
        "constraint_checks": [],
    },
    "O1": {
        "component_id": "O1",
        "name": "Outlet O1",
        "component_type": "outlet",
        "status": "Outlet constraint",
        "elevation_m": 815.0,
        "storage_capacity_m3": None,
        "observed_storage_m3": None,
        "available_storage_m3": None,
        "flow_capacity_m3_s": 0.70,
        "observed_flow_m3_s": 0.28,
        "water_depth_m": None,
        "water_depth_threshold_m": None,
        "recharge_eligibility": None,
        "discharge_capacity_m3_s": 0.70,
        "inflow_sources": ["J4"],
        "downstream_components": [],
        "health_status": "constraint",
        "sensor": {
            "sensor_id": "DS-O1",
            "sensor_type": "discharge",
            "status": "fresh",
            "confidence": 0.90,
            "observed_value": 0.28,
            "unit": "m³/s",
        },
        "sensor_status": "fresh",
        "sensor_confidence": 0.90,
        "relevant_threshold": {
            "variable": "discharge_m3_s",
            "observed": 0.28,
            "limit": 0.70,
            "unit": "m³/s",
        },
        "identified_constraint": (
            "Outlet / receiving water boundary — protect from peak transfer"
        ),
        "current_problem": None,
        "problem_severity": None,
        "downstream_sensitivity": "critical",
        "engineering_significance": (
            "Network outlet to the receiving water body. Interventions should avoid "
            "increasing direct peak hydraulic load at O1."
        ),
        "candidate_id": None,
        "feasibility": None,
        "constraint_checks": [],
    },
}


EDGES: dict[str, dict[str, Any]] = {
    "E-C1-J3": {
        "edge_id": "E-C1-J3",
        "from": "C1",
        "to": "J3",
        "type": "collector",
        "nominal_capacity_m3_s": 0.45,
        "observed_loading_m3_s": 0.18,
        "status": "nominal",
        "downstream_relationship": "inlet_to_control_junction",
    },
    "E-C2-J3": {
        "edge_id": "E-C2-J3",
        "from": "C2",
        "to": "J3",
        "type": "collector",
        "nominal_capacity_m3_s": 0.40,
        "observed_loading_m3_s": 0.16,
        "status": "nominal",
        "downstream_relationship": "inlet_to_control_junction",
    },
    "E-J3-L1": {
        "edge_id": "E-J3-L1",
        "from": "J3",
        "to": "L1",
        "type": "diversion",
        "nominal_capacity_m3_s": 0.30,
        "observed_loading_m3_s": 0.12,
        "status": "capacity_limited_branch",
        "downstream_relationship": "control_junction_to_limited_storage",
        "attention": "Feeds constrained L1 storage",
    },
    "E-J3-R1": {
        "edge_id": "E-J3-R1",
        "from": "J3",
        "to": "R1",
        "type": "recharge_branch",
        "nominal_capacity_m3_s": 0.10,
        "observed_loading_m3_s": 0.02,
        "status": "terminating_recharge",
        "downstream_relationship": "control_junction_to_ineligible_recharge",
        "attention": "Terminates at ineligible recharge",
    },
    "E-J3-L2": {
        "edge_id": "E-J3-L2",
        "from": "J3",
        "to": "L2",
        "type": "diversion",
        "nominal_capacity_m3_s": 0.50,
        "observed_loading_m3_s": 0.22,
        "status": "preferred_candidate_route",
        "downstream_relationship": "control_junction_to_primary_storage",
        "candidate_capacity_constraint_m3_s": 0.5,
    },
    "E-L1-J4": {
        "edge_id": "E-L1-J4",
        "from": "L1",
        "to": "J4",
        "type": "conveyance",
        "nominal_capacity_m3_s": 0.30,
        "observed_loading_m3_s": 0.10,
        "status": "nominal",
        "downstream_relationship": "limited_storage_to_downstream_junction",
    },
    "E-L2-J4": {
        "edge_id": "E-L2-J4",
        "from": "L2",
        "to": "J4",
        "type": "conveyance",
        "nominal_capacity_m3_s": 0.50,
        "observed_loading_m3_s": 0.20,
        "status": "nominal",
        "downstream_relationship": "primary_storage_to_downstream_junction",
    },
    "E-J4-O1": {
        "edge_id": "E-J4-O1",
        "from": "J4",
        "to": "O1",
        "type": "outlet_approach",
        "nominal_capacity_m3_s": 0.70,
        "observed_loading_m3_s": 0.28,
        "status": "outlet_approach",
        "downstream_relationship": "downstream_junction_to_outlet",
        "attention": "Protect O1 / receiving water from peak transfer",
    },
}


CANONICAL_COMPONENT_IDS = ("C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1")
CANONICAL_EDGE_IDS = (
    "E-C1-J3",
    "E-C2-J3",
    "E-J3-L1",
    "E-J3-R1",
    "E-J3-L2",
    "E-L1-J4",
    "E-L2-J4",
    "E-J4-O1",
)


def get_component_intelligence(component_id: str | None = None) -> dict[str, Any]:
    """Return full dataset or one component with incident edges + neighbors."""
    if not component_id:
        return {
            "components": [deepcopy(v) for v in COMPONENTS.values()],
            "edges": [deepcopy(v) for v in EDGES.values()],
        }
    component = COMPONENTS.get(component_id)
    if not component:
        return {"component": None, "edges": [], "neighbors": {}}
    incident = [
        deepcopy(edge)
        for edge in EDGES.values()
        if edge["from"] == component_id or edge["to"] == component_id
    ]
    upstream = [edge["from"] for edge in incident if edge["to"] == component_id]
    downstream = [edge["to"] for edge in incident if edge["from"] == component_id]
    return {
        "component": deepcopy(component),
        "edges": incident,
        "neighbors": {
            "upstream": upstream,
            "downstream": downstream,
            "upstream_detail": [
                deepcopy(COMPONENTS[i]) for i in upstream if i in COMPONENTS
            ],
            "downstream_detail": [
                deepcopy(COMPONENTS[i]) for i in downstream if i in COMPONENTS
            ],
        },
    }


def related_edges_for(component_id: str) -> list[dict[str, Any]]:
    return [
        deepcopy(edge)
        for edge in EDGES.values()
        if edge["from"] == component_id or edge["to"] == component_id
    ]


def bob_component_context(component_id: str) -> dict[str, Any]:
    """Structured Monitor Bob context for a selected component + neighbors/edges."""
    payload = get_component_intelligence(component_id)
    return {
        "selected_component": payload.get("component"),
        "related_edges": payload.get("edges") or [],
        "neighbors": payload.get("neighbors") or {},
        "topology_path": _topology_path(component_id, payload.get("neighbors") or {}),
    }


def _topology_path(component_id: str, neighbors: dict[str, Any]) -> str:
    upstream = neighbors.get("upstream") or []
    downstream = neighbors.get("downstream") or []
    left = " → ".join(upstream) if upstream else "—"
    right = " → ".join(downstream) if downstream else "—"
    return f"{left} → {component_id} → {right}"
