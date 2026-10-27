"""Deterministic hydraulic what-if engine.

Reuses canonical component/edge capacities and observed loadings from
backend.intelligence.component_intelligence. Does NOT mutate that baseline.
"""

from __future__ import annotations

import copy
import re
from typing import Any

from backend.intelligence.component_intelligence import (
    CANONICAL_COMPONENT_IDS,
    CANONICAL_EDGE_IDS,
    COMPONENTS,
    EDGES,
)

# Loading ratio → state (spec thresholds).
STATE_GREEN = "green"
STATE_AMBER = "amber"
STATE_RED = "red"
STATE_BLINKING_RED = "blinking_red"
STATE_GREY = "grey"

# Rainfall conditions — multipliers on baseline observed loadings.
# Values chosen so scenarios differ meaningfully against existing capacities.
CONDITIONS: dict[str, dict[str, Any]] = {
    "normal_rainfall": {
        "id": "normal_rainfall",
        "label": "Normal Rainfall",
        "load_multiplier": 1.0,
        "depth_multiplier": 1.0,
        "detail": "Baseline loading from canonical observed flows",
        "fixture": "standard",
    },
    "heavy_storm": {
        "id": "heavy_storm",
        "label": "Heavy Storm",
        "load_multiplier": 1.75,
        "depth_multiplier": 1.15,
        "detail": "Elevated rainfall / hydraulic loading",
        "fixture": "stress",
    },
    "flooding": {
        "id": "flooding",
        "label": "Flooding",
        "load_multiplier": 2.25,
        "depth_multiplier": 1.25,
        "detail": "High sustained loading / downstream stress",
        "fixture": "stress",
    },
    "extreme_rainfall": {
        "id": "extreme_rainfall",
        "label": "Extreme Rainfall",
        "load_multiplier": 2.9,
        "depth_multiplier": 1.35,
        "detail": "Severe hydraulic loading",
        "fixture": "stress",
    },
    "cloudburst": {
        "id": "cloudburst",
        "label": "Cloudburst / Peak Event",
        "load_multiplier": 3.6,
        "depth_multiplier": 1.45,
        "detail": "Short-duration peak inflow / maximum stress",
        "fixture": "stress",
    },
}

# Frontend scenario option ids → condition ids
SCENARIO_OPTION_TO_CONDITION = {
    "standard": "normal_rainfall",
    "normal_rainfall": "normal_rainfall",
    "heavy-rain": "heavy_storm",
    "heavy_storm": "heavy_storm",
    "heavy-storm": "heavy_storm",
    "flooding": "flooding",
    "extreme_rainfall": "extreme_rainfall",
    "extreme-rainfall": "extreme_rainfall",
    "cloudburst": "cloudburst",
}

ALLOWED_ACTIONS = frozenset(
    {
        "inspect_component",
        "stress_edge",
        "stress_component",
        "reroute_flow",
        "disable_edge",
        "disable_component",
        "change_flow_split",
        "run_condition",
        "reset",
    }
)


def loading_state(ratio: float) -> str:
    if ratio < 0.70:
        return STATE_GREEN
    if ratio < 0.90:
        return STATE_AMBER
    if ratio <= 1.0:
        return STATE_RED
    return STATE_BLINKING_RED


def severity_for_state(state: str) -> str:
    return {
        STATE_GREEN: "low",
        STATE_AMBER: "moderate",
        STATE_RED: "high",
        STATE_BLINKING_RED: "critical",
        STATE_GREY: "critical",
    }.get(state, "low")


def resolve_condition_id(raw: str | None) -> str:
    if not raw:
        return "normal_rainfall"
    key = raw.strip().lower().replace(" ", "_").replace("/", "_")
    if key in CONDITIONS:
        return key
    mapped = SCENARIO_OPTION_TO_CONDITION.get(raw) or SCENARIO_OPTION_TO_CONDITION.get(key)
    if mapped:
        return mapped
    if "cloud" in key or "peak" in key:
        return "cloudburst"
    if "extreme" in key:
        return "extreme_rainfall"
    if "flood" in key:
        return "flooding"
    if "heavy" in key or "storm" in key:
        return "heavy_storm"
    if "normal" in key or "standard" in key:
        return "normal_rainfall"
    return "normal_rainfall"


def baseline_snapshot() -> dict[str, Any]:
    """Immutable copy of canonical edge/component hydraulic baselines."""
    return {
        "components": copy.deepcopy(COMPONENTS),
        "edges": copy.deepcopy(EDGES),
        "component_ids": list(CANONICAL_COMPONENT_IDS),
        "edge_ids": list(CANONICAL_EDGE_IDS),
    }


def _edge_flows_from_baseline(
    condition_id: str,
    *,
    disabled_edges: set[str],
    disabled_components: set[str],
    flow_split: dict[str, float] | None,
    reroute: dict[str, Any] | None,
    stress_edge_id: str | None,
    stress_component_id: str | None,
) -> dict[str, float]:
    cond = CONDITIONS[condition_id]
    mult = float(cond["load_multiplier"])
    flows: dict[str, float] = {}
    for eid in CANONICAL_EDGE_IDS:
        edge = EDGES[eid]
        flows[eid] = float(edge["observed_loading_m3_s"]) * mult

    # Stress focus: amplify the named edge/component path slightly more.
    if stress_edge_id and stress_edge_id in flows:
        flows[stress_edge_id] *= 1.15
    if stress_component_id:
        for eid, edge in EDGES.items():
            if edge["from"] == stress_component_id or edge["to"] == stress_component_id:
                flows[eid] *= 1.12

    # Default J3 outbound split from baseline relative shares among active branches.
    j3_out = ["E-J3-L1", "E-J3-R1", "E-J3-L2"]
    active_j3 = [e for e in j3_out if e not in disabled_edges]
    total_j3_in = flows["E-C1-J3"] + flows["E-C2-J3"]

    if flow_split:
        # Explicit percentages for named edges (remaining share redistributed).
        assigned = 0.0
        for eid, pct in flow_split.items():
            if eid in active_j3:
                flows[eid] = total_j3_in * (float(pct) / 100.0)
                assigned += float(pct)
        remainder = max(0.0, 100.0 - assigned)
        others = [e for e in active_j3 if e not in flow_split]
        if others and remainder > 0:
            share = remainder / len(others)
            for eid in others:
                flows[eid] = total_j3_in * (share / 100.0)
        elif others and remainder == 0:
            for eid in others:
                flows[eid] = 0.0
    else:
        # Scale J3 outbound so sum matches inlet under multiplier (preserve shares).
        base_sum = sum(float(EDGES[e]["observed_loading_m3_s"]) for e in active_j3) or 1.0
        for eid in active_j3:
            share = float(EDGES[eid]["observed_loading_m3_s"]) / base_sum
            flows[eid] = total_j3_in * share

    # Reroute: move percentage of flow from one J3 branch to another.
    if reroute:
        src = reroute.get("from_edge") or _branch_edge_for_node(str(reroute.get("from", "")))
        dst = reroute.get("to_edge") or _branch_edge_for_node(str(reroute.get("to", "")))
        pct = float(reroute.get("percentage", 100))
        if src and dst and src in flows and dst in flows and src not in disabled_edges:
            moved = flows[src] * (pct / 100.0)
            flows[src] -= moved
            if dst not in disabled_edges:
                flows[dst] += moved

    # Disable edges / components: zero flow and push residual onto sibling J3 branches if possible.
    for eid in list(flows):
        edge = EDGES[eid]
        if eid in disabled_edges or edge["from"] in disabled_components or edge["to"] in disabled_components:
            spilled = flows[eid]
            flows[eid] = 0.0
            if edge["from"] == "J3":
                alts = [e for e in j3_out if e != eid and e not in disabled_edges and EDGES[e]["to"] not in disabled_components]
                if alts and spilled > 0:
                    each = spilled / len(alts)
                    for alt in alts:
                        flows[alt] += each

    # Downstream conveyance follows upstream branch (deterministic bookkeeping).
    if "E-L1-J4" not in disabled_edges and "L1" not in disabled_components:
        flows["E-L1-J4"] = flows.get("E-J3-L1", 0.0) * 0.85
    else:
        flows["E-L1-J4"] = 0.0
    if "E-L2-J4" not in disabled_edges and "L2" not in disabled_components:
        flows["E-L2-J4"] = flows.get("E-J3-L2", 0.0) * 0.90
    else:
        flows["E-L2-J4"] = 0.0

    outlet = flows.get("E-L1-J4", 0.0) + flows.get("E-L2-J4", 0.0)
    if "E-J4-O1" in disabled_edges or "J4" in disabled_components or "O1" in disabled_components:
        flows["E-J4-O1"] = 0.0
    else:
        flows["E-J4-O1"] = outlet

    return flows


def _branch_edge_for_node(node_id: str) -> str | None:
    mapping = {"L1": "E-J3-L1", "L2": "E-J3-L2", "R1": "E-J3-R1"}
    return mapping.get(node_id.upper()) if node_id else None


def _component_loading(
    component_id: str,
    flows: dict[str, float],
    condition_id: str,
    disabled_components: set[str],
) -> tuple[float, float, str]:
    """Return (observed, capacity_or_threshold, state)."""
    if component_id in disabled_components:
        return 0.0, 0.0, STATE_GREY

    c = COMPONENTS[component_id]
    cond = CONDITIONS[condition_id]
    depth_mult = float(cond["depth_multiplier"])

    if component_id == "J3":
        depth = float(c["water_depth_m"] or 0.0) * depth_mult
        limit = float(c["water_depth_threshold_m"] or 0.8)
        ratio = depth / limit if limit else 0.0
        state = loading_state(ratio)
        if ratio > 1.0:
            state = STATE_BLINKING_RED
        return depth, limit, state

    if component_id in ("L1", "L2"):
        # Storage loading: inbound flow * duration proxy vs available storage.
        inbound_edge = "E-J3-L1" if component_id == "L1" else "E-J3-L2"
        inbound = flows.get(inbound_edge, 0.0)
        volume = inbound * 600.0  # same duration convention as P3 demos
        available = float(c["available_storage_m3"] or 0.0)
        capacity = float(c["storage_capacity_m3"] or available or 1.0)
        # Prefer available storage as the acceptance limit for diversion.
        limit = available if available > 0 else capacity
        ratio = volume / limit if limit else 0.0
        state = loading_state(ratio)
        return volume, limit, state

    if component_id == "O1":
        flow = flows.get("E-J4-O1", 0.0)
        cap = float(c["discharge_capacity_m3_s"] or c["flow_capacity_m3_s"] or 0.7)
        ratio = flow / cap if cap else 0.0
        return flow, cap, loading_state(ratio)

    if component_id == "R1":
        flow = flows.get("E-J3-R1", 0.0)
        cap = float(c["flow_capacity_m3_s"] or 0.1)
        ratio = flow / cap if cap else 0.0
        return flow, cap, loading_state(ratio)

    if component_id == "J4":
        flow = flows.get("E-L1-J4", 0.0) + flows.get("E-L2-J4", 0.0)
        cap = float(c["flow_capacity_m3_s"] or 0.6)
        ratio = flow / cap if cap else 0.0
        return flow, cap, loading_state(ratio)

    # Inlets C1/C2
    edge_id = "E-C1-J3" if component_id == "C1" else "E-C2-J3"
    flow = flows.get(edge_id, float(c["observed_flow_m3_s"] or 0.0))
    cap = float(c["flow_capacity_m3_s"] or 1.0)
    ratio = flow / cap if cap else 0.0
    return flow, cap, loading_state(ratio)


def run_hydraulic_simulation(
    *,
    condition: str | None = "normal_rainfall",
    action: str | None = "run_condition",
    parameters: dict[str, Any] | None = None,
    apply_failure_transition: bool = True,
) -> dict[str, Any]:
    """Run a deterministic hydraulic evaluation. Never mutates COMPONENTS/EDGES."""
    params = dict(parameters or {})
    condition_id = resolve_condition_id(condition or params.get("condition"))
    action_name = (action or "run_condition").lower()
    if action_name not in ALLOWED_ACTIONS:
        raise ValueError(f"Action not allowlisted: {action_name}")

    disabled_edges: set[str] = set()
    disabled_components: set[str] = set()
    flow_split: dict[str, float] | None = None
    reroute: dict[str, Any] | None = None
    stress_edge_id = None
    stress_component_id = None
    inspect_id = None

    if action_name == "inspect_component":
        inspect_id = str(params.get("component_id") or params.get("target") or "").upper()
    elif action_name == "stress_edge":
        stress_edge_id = str(params.get("edge_id") or params.get("target") or "").upper()
        if params.get("condition"):
            condition_id = resolve_condition_id(str(params["condition"]))
    elif action_name == "stress_component":
        stress_component_id = str(params.get("component_id") or params.get("target") or "").upper()
        if params.get("condition"):
            condition_id = resolve_condition_id(str(params["condition"]))
    elif action_name == "reroute_flow":
        reroute = {
            "from": str(params.get("from") or "").upper(),
            "to": str(params.get("to") or "").upper(),
            "percentage": float(params.get("percentage", 100)),
        }
    elif action_name == "disable_edge":
        eid = str(params.get("edge_id") or params.get("target") or "").upper()
        if eid:
            disabled_edges.add(eid)
    elif action_name == "disable_component":
        cid = str(params.get("component_id") or params.get("target") or "").upper()
        if cid:
            disabled_components.add(cid)
            for eid, edge in EDGES.items():
                if edge["from"] == cid or edge["to"] == cid:
                    disabled_edges.add(eid)
    elif action_name == "change_flow_split":
        # Accept { "E-J3-L2": 70 } or { "to": "L2", "percentage": 70 }
        if "percentage" in params and (params.get("to") or params.get("edge_id")):
            target = str(params.get("edge_id") or _branch_edge_for_node(str(params.get("to", ""))) or "")
            if target:
                flow_split = {target: float(params["percentage"])}
        else:
            flow_split = {
                str(k).upper(): float(v)
                for k, v in params.items()
                if str(k).upper().startswith("E-")
            } or None
    elif action_name == "reset":
        condition_id = "normal_rainfall"
        # no modifications
    # run_condition: condition_id already set

    flows = _edge_flows_from_baseline(
        condition_id,
        disabled_edges=disabled_edges,
        disabled_components=disabled_components,
        flow_split=flow_split,
        reroute=reroute,
        stress_edge_id=stress_edge_id,
        stress_component_id=stress_component_id,
    )

    edge_results: list[dict[str, Any]] = []
    max_loading = 0.0
    bottleneck = None
    failed_edges: list[str] = []
    critical_edges: list[str] = []

    for eid in CANONICAL_EDGE_IDS:
        edge = EDGES[eid]
        capacity = float(edge.get("candidate_capacity_constraint_m3_s") or edge["nominal_capacity_m3_s"])
        flow = float(flows.get(eid, 0.0))
        if eid in disabled_edges or edge["from"] in disabled_components or edge["to"] in disabled_components:
            state = STATE_GREY
            ratio = 0.0
            sequence = [STATE_GREY]
        else:
            ratio = flow / capacity if capacity else 0.0
            state = loading_state(ratio)
            sequence = [STATE_GREEN]
            if ratio >= 0.70:
                sequence.append(STATE_AMBER)
            if ratio >= 0.90:
                sequence.append(STATE_RED)
            if ratio > 1.0:
                sequence.append(STATE_BLINKING_RED)
                if apply_failure_transition:
                    state = STATE_GREY
                    sequence.append(STATE_GREY)
                    failed_edges.append(eid)
                else:
                    critical_edges.append(eid)
            elif state == STATE_BLINKING_RED:
                critical_edges.append(eid)
            if ratio > max_loading:
                max_loading = ratio
                bottleneck = eid

        edge_results.append(
            {
                "edge_id": eid,
                "from": edge["from"],
                "to": edge["to"],
                "flow_m3_s": round(flow, 6),
                "capacity_m3_s": capacity,
                "loading_ratio": round(ratio, 6),
                "state": state,
                "state_sequence": sequence,
                "failed": state == STATE_GREY and eid in failed_edges,
                "disabled": eid in disabled_edges,
            }
        )

    # Propagate failure: if an upstream edge failed, mark immediate downstream edge grey when starved.
    failed_set = set(failed_edges) | disabled_edges
    by_id = {e["edge_id"]: e for e in edge_results}
    for eid in list(failed_set):
        edge = EDGES.get(eid)
        if not edge:
            continue
        # Downstream edges from the failed edge's `to` node with zero viable alternate.
        for down_id, down in EDGES.items():
            if down["from"] == edge["to"] and by_id[down_id]["flow_m3_s"] == 0.0 and down_id not in failed_set:
                # Only grey if all inbound to that node failed/disabled.
                inbound = [i for i, ed in EDGES.items() if ed["to"] == edge["to"]]
                if inbound and all(i in failed_set or by_id[i]["state"] == STATE_GREY for i in inbound):
                    by_id[down_id]["state"] = STATE_GREY
                    by_id[down_id]["state_sequence"] = list(by_id[down_id]["state_sequence"]) + [STATE_GREY]

    component_results: list[dict[str, Any]] = []
    storage_stress: list[str] = []
    failed_components: list[str] = []
    for cid in CANONICAL_COMPONENT_IDS:
        observed, limit, state = _component_loading(cid, flows, condition_id, disabled_components)
        ratio = (observed / limit) if limit else 0.0
        sequence = [STATE_GREEN]
        if state != STATE_GREY:
            if ratio >= 0.70:
                sequence.append(STATE_AMBER)
            if ratio >= 0.90:
                sequence.append(STATE_RED)
            if ratio > 1.0:
                sequence.append(STATE_BLINKING_RED)
                if apply_failure_transition:
                    state = STATE_GREY
                    sequence.append(STATE_GREY)
                    failed_components.append(cid)
        else:
            sequence = [STATE_GREY]
            failed_components.append(cid)
        if cid in ("L1", "L2") and ratio >= 0.70:
            storage_stress.append(cid)
        sensor = COMPONENTS[cid].get("sensor") or {}
        component_results.append(
            {
                "component_id": cid,
                "observed": round(float(observed), 6),
                "limit": round(float(limit), 6) if limit else None,
                "loading_ratio": round(ratio, 6),
                "state": state,
                "state_sequence": sequence,
                "sensor_confidence": sensor.get("confidence"),
                "sensor_status": sensor.get("status") or COMPONENTS[cid].get("sensor_status"),
                "sensor_id": sensor.get("sensor_id"),
                "disabled": cid in disabled_components,
            }
        )

    # Sensor board (deterministic, from component intelligence — never random).
    sensors = []
    for cid in CANONICAL_COMPONENT_IDS:
        c = COMPONENTS[cid]
        s = c.get("sensor")
        if not s:
            continue
        sensors.append(
            {
                "id": s["sensor_id"],
                "node_id": cid,
                "variable": s["sensor_type"],
                "unit": s.get("unit"),
                "status": s.get("status"),
                "confidence": s.get("confidence"),
                "raw_value": s.get("observed_value"),
                "effective_value": s.get("observed_value"),
                "critical": cid == "J3",
            }
        )

    unsafe_edges = [e["edge_id"] for e in edge_results if e["state"] in (STATE_RED, STATE_BLINKING_RED, STATE_GREY)]
    unsafe_components = [c["component_id"] for c in component_results if c["state"] in (STATE_RED, STATE_BLINKING_RED, STATE_GREY)]

    overall = STATE_GREEN
    for s in (STATE_AMBER, STATE_RED, STATE_BLINKING_RED, STATE_GREY):
        if any(e["state"] == s for e in edge_results) or any(c["state"] == s for c in component_results):
            overall = s

    # Visual payload for Monitor canvas (Bob / Simulate).
    edge_stages: dict[str, int] = {}
    for e in edge_results:
        if e["state"] == STATE_GREY and e["flow_m3_s"] == 0.0 and e["disabled"]:
            continue
        edge = EDGES[e["edge_id"]]
        stage = 0 if edge["from"] in ("C1", "C2") else 1 if edge["from"] == "J3" else 2 if edge["from"] in ("L1", "L2") else 3
        edge_stages[e["edge_id"]] = stage

    node_states: dict[str, Any] = {}
    for c in component_results:
        if c["state"] == STATE_GREEN and c["component_id"] not in unsafe_components:
            # Still include stressed-adjacent for clarity when not green-only run
            if c["loading_ratio"] < 0.70 and action_name == "run_condition" and condition_id == "normal_rainfall":
                continue
        node_states[c["component_id"]] = {
            "severity": severity_for_state(c["state"]),
            "hydraulicState": c["state"],
            **({"storageLevel": "raised"} if c["component_id"] in ("L1", "L2") and c["loading_ratio"] >= 0.70 else {}),
        }
    # Always annotate non-green components.
    for c in component_results:
        if c["state"] != STATE_GREEN:
            node_states[c["component_id"]] = {
                "severity": severity_for_state(c["state"]),
                "hydraulicState": c["state"],
                **({"storageLevel": "raised"} if c["component_id"] in ("L1", "L2") and c["state"] != STATE_GREEN else {}),
            }

    edge_states = {
        e["edge_id"]: {
            "hydraulicState": e["state"],
            "loading_ratio": e["loading_ratio"],
            "severity": severity_for_state(e["state"]),
        }
        for e in edge_results
    }

    cond = CONDITIONS[condition_id]
    result = {
        "ok": True,
        "condition_id": condition_id,
        "condition_label": cond["label"],
        "action": action_name,
        "parameters": params,
        "fixture": cond["fixture"],
        "overall_network_status": overall,
        "max_loading_ratio": round(max_loading, 6),
        "critical_bottleneck": bottleneck,
        "storage_stress": storage_stress,
        "affected_edges": unsafe_edges,
        "affected_components": unsafe_components,
        "failed_edges": failed_edges,
        "failed_components": failed_components,
        "downstream_impact": _downstream_impact(failed_edges, disabled_edges, edge_results),
        "sensor_considerations": [
            f"{s['id']} at {s['node_id']}: confidence {s['confidence']} ({s['status']})"
            for s in sensors
            if s.get("confidence") is not None and (s["confidence"] < 0.70 or s["status"] != "fresh")
        ],
        "edges": edge_results,
        "components": component_results,
        "sensors": sensors,
        "visual": {
            "scenarioId": f"HYDRAULIC_{condition_id.upper()}",
            "edgeStages": edge_stages,
            "nodeStates": node_states,
            "edgeStates": edge_states,
        },
        "baseline_mutated": False,
        "what_if": (
            False
            if action_name in ("reset", "run_condition", "inspect_component")
            and not (disabled_edges or disabled_components or flow_split or reroute or stress_edge_id or stress_component_id)
            else True
        ),
        "inspect": copy.deepcopy(COMPONENTS.get(inspect_id)) if inspect_id else None,
        "summary": _summary(condition_id, overall, bottleneck, max_loading, failed_edges, failed_components, storage_stress),
    }
    return result


def _downstream_impact(failed_edges: list[str], disabled_edges: set[str], edge_results: list[dict[str, Any]]) -> str:
    if not failed_edges and not disabled_edges:
        return "No simulated edge failure; downstream loading follows the selected condition."
    targets = []
    for eid in set(failed_edges) | disabled_edges:
        edge = EDGES.get(eid)
        if edge:
            targets.append(f"{edge['to']} via {eid}")
    greys = [e["edge_id"] for e in edge_results if e["state"] == STATE_GREY]
    return (
        "Simulated unavailable path(s): "
        + (", ".join(targets) if targets else "none")
        + f". Grey/unavailable edges: {', '.join(greys) if greys else 'none'}."
    )


def _summary(
    condition_id: str,
    overall: str,
    bottleneck: str | None,
    max_loading: float,
    failed_edges: list[str],
    failed_components: list[str],
    storage_stress: list[str],
) -> str:
    parts = [
        f"Condition {CONDITIONS[condition_id]['label']}: overall {overall}.",
        f"Peak edge loading ratio {max_loading:.2f}"
        + (f" at {bottleneck}." if bottleneck else "."),
    ]
    if storage_stress:
        parts.append(f"Storage stress at {', '.join(storage_stress)}.")
    if failed_edges:
        parts.append(f"Simulated edge failure: {', '.join(failed_edges)}.")
    if failed_components:
        parts.append(f"Simulated component failure: {', '.join(failed_components)}.")
    return " ".join(parts)


def parse_bob_action(message: str) -> dict[str, Any] | None:
    """Deterministic NL → allowlisted structured simulation action."""
    q = message.lower().strip()
    if not q:
        return None

    # Reset
    if re.search(r"\b(reset|clear what-?if|restore baseline|undo what-?if)\b", q):
        return {
            "type": "simulation_request",
            "action": "reset",
            "parameters": {},
            "explanation": "Clear what-if modifications and restore the baseline hydraulic state.",
        }

    # Inspect
    m = re.search(r"\b(what(?:'s| is) happening at|inspect|status of|tell me about)\s+([a-z0-9-]+)", q)
    if m:
        cid = m.group(2).upper()
        if cid in COMPONENTS:
            return {
                "type": "simulation_request",
                "action": "inspect_component",
                "parameters": {"component_id": cid},
                "explanation": f"Inspect component {cid} using canonical AEGIS intelligence.",
            }

    # Disable / remove edge
    m = re.search(r"\b(e-[a-z0-9-]+)\b", q)
    edge_token = m.group(1).upper() if m else None
    if edge_token and edge_token in EDGES and re.search(r"remove|disable|unavailable|without|block|closed|out of service", q):
        return {
            "type": "simulation_request",
            "action": "disable_edge",
            "parameters": {"edge_id": edge_token},
            "explanation": f"What-if: disable edge {edge_token} without mutating the canonical network.",
        }

    # Disable component
    for cid in CANONICAL_COMPONENT_IDS:
        if re.search(rf"\b{cid.lower()}\b", q) and re.search(
            r"unavailable|removed|offline|disable|without|stop using|out of service|cannot be used", q
        ):
            return {
                "type": "simulation_request",
                "action": "disable_component",
                "parameters": {"component_id": cid},
                "explanation": f"What-if: treat {cid} as unavailable under the current condition.",
            }

    # Reroute / divert
    m = re.search(
        r"(?:divert|reroute|route).{0,40}?\bfrom\s+([a-z0-9-]+)\s+to\s+([a-z0-9-]+)|"
        r"(?:all|100%?).{0,20}?\b(?:flow|water).{0,40}?\b([a-z0-9-]+).{0,20}?\b([a-z0-9-]+)|"
        r"divert(?:ed)?\s+(?:all\s+)?(?:flow\s+)?from\s+([a-z0-9-]+)\s+to\s+([a-z0-9-]+)",
        q,
    )
    if m or (re.search(r"divert|reroute", q) and re.search(r"\bl1\b", q) and re.search(r"\bl2\b", q)):
        if m:
            groups = [g for g in m.groups() if g]
            src, dst = (groups[0].upper(), groups[1].upper()) if len(groups) >= 2 else ("L1", "L2")
        else:
            src, dst = "L1", "L2"
        pct = 100
        pm = re.search(r"(\d{1,3})\s*%", q)
        if pm:
            pct = int(pm.group(1))
        return {
            "type": "simulation_request",
            "action": "reroute_flow",
            "parameters": {"from": src, "to": dst, "percentage": pct},
            "explanation": f"What-if: divert {pct}% of flow from {src} to {dst}.",
        }

    # Change flow split e.g. 70% through L2 / E-J3-L2
    m = re.search(r"(\d{1,3})\s*%\s*(?:of\s+)?(?:j3\s+)?flow\s+(?:goes\s+)?(?:through|via|to)\s+([a-z0-9-]+)", q)
    if m:
        pct = int(m.group(1))
        target = m.group(2).upper()
        edge_id = target if target in EDGES else _branch_edge_for_node(target)
        if edge_id:
            return {
                "type": "simulation_request",
                "action": "change_flow_split",
                "parameters": {"edge_id": edge_id, "to": EDGES[edge_id]["to"], "percentage": pct},
                "explanation": f"What-if: route {pct}% of J3 outflow through {edge_id}.",
            }

    # Stress edge / can this pipe handle …
    if edge_token and edge_token in EDGES and re.search(r"handle|stress|can\b|capacity|cope|withstand", q):
        cond = "cloudburst" if re.search(r"cloud|peak", q) else resolve_condition_id(
            "extreme_rainfall" if "extreme" in q else "heavy_storm" if re.search(r"heavy|storm", q) else "flooding" if "flood" in q else "normal_rainfall"
        )
        if re.search(r"cloud|peak", q):
            cond = "cloudburst"
        return {
            "type": "simulation_request",
            "action": "stress_edge",
            "parameters": {"edge_id": edge_token, "condition": cond},
            "explanation": f"Stress edge {edge_token} under {CONDITIONS[cond]['label']}.",
        }

    # Stress component
    for cid in CANONICAL_COMPONENT_IDS:
        if re.search(rf"\b{cid.lower()}\b", q) and re.search(r"handle|stress|can\b|capacity|cope|withstand|rainfall", q):
            cond = resolve_condition_id(
                "cloudburst"
                if re.search(r"cloud|peak", q)
                else "extreme_rainfall"
                if "extreme" in q
                else "heavy_storm"
                if re.search(r"heavy|storm", q)
                else "flooding"
                if "flood" in q
                else "normal_rainfall"
            )
            return {
                "type": "simulation_request",
                "action": "stress_component",
                "parameters": {"component_id": cid, "condition": cond},
                "explanation": f"Stress component {cid} under {CONDITIONS[cond]['label']}.",
            }

    # Generic "this pipe" when edge mentioned earlier pattern failed — stress E-J3-L2 under cloudburst
    if re.search(r"\b(this pipe|the pipe|pipe)\b", q) and re.search(r"handle|cloudburst|stress|capacity", q):
        cond = "cloudburst" if re.search(r"cloud|peak", q) else "extreme_rainfall"
        return {
            "type": "simulation_request",
            "action": "stress_edge",
            "parameters": {"edge_id": "E-J3-L2", "condition": cond},
            "explanation": f"Stress preferred diversion edge E-J3-L2 under {CONDITIONS[cond]['label']}.",
        }

    # Run rainfall condition
    if re.search(r"cloud|peak event", q):
        return {
            "type": "simulation_request",
            "action": "run_condition",
            "parameters": {"condition": "cloudburst"},
            "explanation": "Run Cloudburst / Peak Event hydraulic condition.",
        }
    if re.search(r"extreme", q) and re.search(r"rain|storm|simulat|what|happen|condition", q):
        return {
            "type": "simulation_request",
            "action": "run_condition",
            "parameters": {"condition": "extreme_rainfall"},
            "explanation": "Run Extreme Rainfall hydraulic condition.",
        }
    if re.search(r"flood", q):
        return {
            "type": "simulation_request",
            "action": "run_condition",
            "parameters": {"condition": "flooding"},
            "explanation": "Run Flooding hydraulic condition.",
        }
    if re.search(r"heavy", q) and re.search(r"rain|storm", q):
        return {
            "type": "simulation_request",
            "action": "run_condition",
            "parameters": {"condition": "heavy_storm"},
            "explanation": "Run Heavy Storm hydraulic condition.",
        }
    if re.search(r"normal|standard", q) and re.search(r"rain|simulat|scenario|condition", q):
        return {
            "type": "simulation_request",
            "action": "run_condition",
            "parameters": {"condition": "normal_rainfall"},
            "explanation": "Run Normal Rainfall hydraulic condition.",
        }

    if re.search(r"simulat|what[- ]?if|run condition|rainfall condition", q):
        return {
            "type": "simulation_request",
            "action": "run_condition",
            "parameters": {"condition": "heavy_storm"},
            "explanation": "Run Heavy Storm as a default allowlisted what-if condition.",
        }

    # Bare inspect by component id mention with question
    for cid in CANONICAL_COMPONENT_IDS:
        if re.search(rf"\b{cid.lower()}\b", q) and re.search(r"what|status|how|depth|storage|confidence", q):
            return {
                "type": "simulation_request",
                "action": "inspect_component",
                "parameters": {"component_id": cid},
                "explanation": f"Inspect component {cid}.",
            }

    return None


def explain_from_result(sim: dict[str, Any], bob_intent: str | None = None) -> str:
    """Build Bob prose strictly from simulation result numbers."""
    lines = [
        "### WHAT I UNDERSTAND",
        bob_intent or sim.get("parameters", {}).get("explanation") or sim.get("summary", ""),
        "",
        "### SIMULATION",
        f"Running `{sim['action']}` under **{sim['condition_label']}** via the deterministic AEGIS hydraulic engine.",
        "",
        "### RESULT",
        sim["summary"],
        f"Overall network status: **{sim['overall_network_status']}**.",
        f"Maximum loading ratio: **{sim['max_loading_ratio']}**"
        + (f" at `{sim['critical_bottleneck']}`." if sim.get("critical_bottleneck") else "."),
    ]
    if sim.get("failed_edges"):
        lines.append(f"Simulated edge failure (grey): {', '.join(sim['failed_edges'])}.")
    if sim.get("failed_components"):
        lines.append(f"Simulated component failure (grey): {', '.join(sim['failed_components'])}.")
    if sim.get("storage_stress"):
        lines.append(f"Storage stress: {', '.join(sim['storage_stress'])}.")
    if sim.get("sensor_considerations"):
        lines.append("Sensor confidence notes: " + "; ".join(sim["sensor_considerations"]) + ".")
    lines.extend(
        [
            "",
            "### VISUAL STATE",
            "The network visualization reflects simulation states "
            "(green / amber / red / blinking red → grey for simulated failure).",
            "",
            "### ENGINEERING INTERPRETATION",
            sim.get("downstream_impact") or "See edge and component loading tables in the simulation result.",
            "",
            "Baseline canonical network was **not** mutated (`baseline_mutated: false`).",
        ]
    )
    if sim.get("inspect"):
        intel = sim["inspect"]
        lines.extend(
            [
                "",
                f"### INSPECT {intel.get('component_id')}",
                f"Status: {intel.get('status')}; sensor confidence: {intel.get('sensor_confidence')}; "
                f"problem: {intel.get('current_problem') or 'none'}.",
            ]
        )
    return "\n".join(lines)
