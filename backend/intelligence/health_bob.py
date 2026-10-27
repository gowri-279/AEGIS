"""Monitor Health Bob — structured engineering intelligence from component data.

Bob explains. P1/P2/P3 remain authoritative for assessment/simulation numbers.
"""

from __future__ import annotations

from typing import Any

from backend.intelligence.bob_service import run_bob
from backend.intelligence.component_intelligence import (
    COMPONENTS,
    bob_component_context,
    get_component_intelligence,
    related_edges_for,
)
from backend.integration.scenarios import (
    FIXED_EVALUATION_TIME,
    FixtureId,
    resolve_assessment_inputs,
)
from backend.integration.workflow import run_integrated_assessment
from p2.sensor_simulator import simulate_readings


SCENARIO_TO_FIXTURE: dict[str, FixtureId] = {
    "NO_ACTION": "stress",
    "INCREASE_STORAGE": "standard",
    "INCREASE_CONVEYANCE": "standard",
    "DOWNSTREAM_REDESIGN": "standard",
    "REROUTE_L1": "standard",
    "REROUTE_L2": "standard",
    "ADD_PIPE": "standard",
    "REPLACE_PIPE": "standard",
    "BASELINE": "standard",
}


def _component_id(context: dict[str, Any]) -> str:
    node = context.get("node") or {}
    finding = context.get("finding") or {}
    return str(node.get("id") or finding.get("target_id") or "")


def _finding(context: dict[str, Any]) -> dict[str, Any]:
    return context.get("finding") if isinstance(context.get("finding"), dict) else {}


def _proposed_scenario(context: dict[str, Any]) -> str:
    category = str(_finding(context).get("category") or "")
    if category == "bottleneck":
        return "INCREASE_STORAGE"
    if category == "overflow":
        return "DOWNSTREAM_REDESIGN"
    return "INCREASE_CONVEYANCE"


def _intervention_label(scenario_id: str, component_id: str, comp: dict[str, Any] | None) -> str:
    ctype = (comp or {}).get("component_type")
    storage_target = component_id if ctype == "storage" else "L1"
    return {
        "BASELINE": "Baseline network assessment",
        "NO_ACTION": "Retain the existing configuration",
        "REROUTE_L1": "Divert peak flow toward L1 storage",
        "REROUTE_L2": "Divert peak flow toward L2 storage",
        "INCREASE_CONVEYANCE": f"Increase downstream conveyance capacity at {component_id}",
        "ADD_PIPE": f"Add parallel conveyance downstream of {component_id}",
        "REPLACE_PIPE": f"Replace constrained conduit near {component_id}",
        "INCREASE_STORAGE": f"Expand storage capacity at {storage_target}",
        "DOWNSTREAM_REDESIGN": f"Redesign the {component_id} → J4 → O1 downstream connection",
    }.get(scenario_id, f"Review engineering options at {component_id}")


def _run_assessment(fixture: FixtureId) -> dict[str, Any]:
    params = resolve_assessment_inputs(fixture=fixture)
    failure_modes = (
        {"WL-J3": params["wl_j3_failure_mode"]}
        if params["wl_j3_failure_mode"] is not None
        else None
    )
    readings = simulate_readings(
        failure_modes=failure_modes,
        now=FIXED_EVALUATION_TIME,
    )
    response = run_integrated_assessment(
        readings,
        proposed_volume_m3=params["proposed_volume_m3"],
        duration_seconds=params["duration_seconds"],
        recharge_eligibility=params["recharge_eligibility"],
        baseline_excess_volume_m3=params["baseline_excess_volume_m3"],
        scenario_id=params["scenario_id"],
        rainfall=params["rainfall"],
        intervention_assumptions=params["intervention_assumptions"],
    )
    response["fixture_id"] = params["fixture_id"]
    return response


def build_structured_briefing(
    context: dict[str, Any],
    *,
    scenario_id: str | None = None,
    assessment: dict[str, Any] | None = None,
    include_bob: bool = True,
) -> dict[str, Any]:
    """Deterministic structured Health Bob briefing from component intelligence."""
    component_id = _component_id(context)
    finding = _finding(context)
    intel = get_component_intelligence(component_id)
    comp = intel.get("component") or COMPONENTS.get(component_id)
    neighbors = intel.get("neighbors") or {}
    edges = intel.get("edges") or related_edges_for(component_id)

    observed = finding.get("observed_value")
    threshold = finding.get("threshold")
    unit = finding.get("unit") or ""
    title = finding.get("title") or f"Attention at {component_id}"
    severity = finding.get("severity") or "unknown"
    category = finding.get("category") or "attention"

    obs_bits = []
    if observed is not None and threshold is not None:
        obs_bits.append(f"Observed {observed} {unit} against threshold {threshold} {unit}".strip())
    elif comp and isinstance(comp.get("relevant_threshold"), dict):
        thr = comp["relevant_threshold"]
        obs_bits.append(
            f"Observed {thr.get('observed')} against limit {thr.get('limit')} ({thr.get('variable')})"
        )
    if comp and comp.get("identified_constraint"):
        obs_bits.append(str(comp["identified_constraint"]))
    existing_problem = (
        f"{component_id}: {title} ({severity}). "
        + (" ".join(obs_bits) if obs_bits else str(finding.get("potential_impact") or ""))
    ).strip()

    upstream = neighbors.get("upstream") or context.get("upstream") or []
    downstream = neighbors.get("downstream") or context.get("downstream") or []
    significance = (comp or {}).get("engineering_significance") or finding.get("potential_impact") or ""
    sensor_note = ""
    if comp and comp.get("sensor_status"):
        sensor_note = (
            f" Sensor {comp.get('sensor_status')}"
            + (
                f" (confidence {comp.get('sensor_confidence')})"
                if comp.get("sensor_confidence") is not None
                else ""
            )
            + "."
        )
    why_it_matters = (
        f"{significance} Topology: {', '.join(map(str, upstream)) or 'none'} → {component_id} → "
        f"{', '.join(map(str, downstream)) or 'none'}.{sensor_note} "
        f"Downstream sensitivity: {(comp or {}).get('downstream_sensitivity', 'unknown')}."
    ).strip()

    if category == "bottleneck":
        if_no_action = (
            f"Leaving {component_id} unchanged keeps available storage below the diversion "
            f"requirement. Excess volume remains concentrated at the controlling junction and "
            f"propagates toward {', '.join(map(str, downstream)) or 'downstream nodes'}, increasing "
            f"loading on the corridor to J4/O1."
        )
    elif category == "overflow":
        if_no_action = (
            f"Without intervention at {component_id}, peak loading continues toward "
            f"{', '.join(map(str, downstream)) or 'the downstream corridor'}. "
            f"Receiving components (J4/O1) remain exposed to uncontrolled transfer."
        )
    elif category == "hydraulic_overload":
        if_no_action = (
            f"If depth at {component_id} continues to rise toward the hard threshold, "
            f"upstream inlets ({', '.join(map(str, upstream)) or 'C1/C2'}) face surcharge pressure and "
            f"diversion options toward L1/L2 become more constrained."
        )
    else:
        if_no_action = (
            f"Without addressing the finding at {component_id}, the current health/status "
            f"({(comp or {}).get('health_status', 'attention')}) persists and downstream "
            f"sensitivity remains {(comp or {}).get('downstream_sensitivity', 'elevated')}."
        )
    no_action_consequences = [
        f"{component_id} remains in {(comp or {}).get('health_status', 'attention')} state.",
        f"Downstream path {component_id} → {' → '.join(map(str, downstream)) if downstream else 'network'} stays exposed.",
        "No AEGIS simulation has yet quantified a failure event for this no-action path.",
    ]

    proposed = scenario_id or _proposed_scenario(context)
    intervention = _intervention_label(proposed, component_id, comp)
    if proposed == "INCREASE_STORAGE":
        why_solution = (
            f"Storage expansion addresses the bottleneck at "
            f"{component_id if (comp or {}).get('component_type') == 'storage' else 'L1'} "
            f"where observed storage is below the diversion volume, reducing reliance on "
            f"undersized branches and protecting the J4 → O1 corridor."
        )
    elif proposed == "DOWNSTREAM_REDESIGN":
        why_solution = (
            f"Downstream redesign targets the {component_id} → J4 → O1 relationship so peak "
            f"transfer is managed before it reaches the outlet/receiving water."
        )
    elif proposed == "REROUTE_L2":
        why_solution = (
            "Routing toward L2 uses the feasible storage candidate (800 m³ available under "
            "standard assessment) instead of the constrained L1 branch."
        )
    elif proposed == "REROUTE_L1":
        why_solution = (
            "Routing toward L1 is evaluated against the known 100 m³ available storage; "
            "AEGIS constraints determine whether this branch can accept the diversion."
        )
    else:
        why_solution = (
            f"Increasing conveyance at {component_id} reduces local depth/loading concentration "
            f"and improves the ability to move flow toward eligible downstream storage."
        )

    result_text: str
    simulation_metrics: dict[str, Any]
    if assessment:
        rec = assessment.get("recommendation") or {}
        sim = assessment.get("simulation_result") or assessment.get("simulation") or {}
        selected = rec.get("selected_candidate_id")
        status = rec.get("recommendation_status")
        diverted = sim.get("proposed_volume_m3", sim.get("diverted_volume_m3"))
        proposed_flow = sim.get("proposed_flow_m3_s", sim.get("proposed_flow_m3s"))
        residual = sim.get("residual_excess_volume_m3")
        parts = [f"AEGIS assessment status: {status}."]
        if selected:
            parts.append(f"Selected candidate: {selected}.")
        if diverted is not None:
            parts.append(f"Diverted volume: {diverted} m³.")
        if proposed_flow is not None:
            parts.append(f"Proposed flow: {proposed_flow} m³/s.")
        if residual is not None:
            parts.append(f"Residual excess: {residual} m³.")
        rationale = rec.get("rationale") or []
        if isinstance(rationale, list) and rationale:
            parts.append("Rationale: " + "; ".join(str(x) for x in rationale[:3]))
        result_text = " ".join(parts)
        simulation_metrics = {
            "recommendation_status": status,
            "selected_candidate_id": selected,
            "diverted_volume_m3": diverted,
            "proposed_flow_m3s": proposed_flow,
            "residual_excess_volume_m3": residual,
            "fixture_id": assessment.get("fixture_id"),
            "from_simulation": True,
        }
    else:
        result_text = (
            f"Engineering expectation: {intervention} is expected to relieve concentration at "
            f"{component_id} and improve downstream manageability toward "
            f"{', '.join(map(str, downstream)) or 'J4/O1'}. Run the proposed solution to obtain "
            f"deterministic AEGIS assessment metrics."
        )
        simulation_metrics = {"from_simulation": False}

    bob_source = "deterministic"
    bob_error = None
    if include_bob:
        bob = run_bob(
            "You are AEGIS Health Bob. Explain the finding using ONLY the supplied text. "
            "Do not invent percentages or claim hydraulic failure. Reply in 2-3 sentences.\n"
            f"PROBLEM:{existing_problem}\nWHY:{why_it_matters}\n"
        )
        if bob.get("ok") and bob.get("last_message"):
            why_it_matters = bob["last_message"]
            bob_source = "bob"
        else:
            bob_error = bob.get("error")

    bob_ctx = bob_component_context(component_id) if component_id else {}

    return {
        "ok": True,
        "source": bob_source,
        "error": bob_error,
        "component_id": component_id,
        "scenario_id": proposed,
        "component_intelligence": comp,
        "bob_component_context": bob_ctx,
        "related_edges": edges,
        "existing_problem": existing_problem,
        "why_it_matters": why_it_matters,
        "if_no_action": if_no_action,
        "no_action_consequences": no_action_consequences,
        "proposed_solution": intervention,
        "why_solution": why_solution,
        "result": result_text,
        "simulation_metrics": simulation_metrics,
        "title": (
            f"AEGIS simulation · {simulation_metrics.get('recommendation_status')}"
            if assessment
            else title
        ),
        "explanation": (
            if_no_action
            if proposed == "NO_ACTION" and not assessment
            else (result_text if assessment else why_solution)
        ),
        "consequences": (
            no_action_consequences
            if not assessment
            else [
                result_text,
                "Canonical topology unchanged; values from AEGIS P1/P2/P3 assessment.",
            ]
        ),
        "intervention": intervention,
        "supported": True,
        "steps": [
            f"Assess the proposed option: {intervention}.",
            "Confirm observations and sensor reliability at the selected component.",
            "Re-run AEGIS assessment with the intervention parameters.",
            "Verify storage constraints and downstream capacity at J4 and O1.",
            "Submit for implementation review after engineer approval.",
        ],
    }


def run_health_bob_scenario(
    context: dict[str, Any],
    scenario_id: str,
    *,
    include_bob: bool = False,
) -> dict[str, Any]:
    """Run allowlisted Health Bob scenario; proposed solutions use AEGIS assessment."""
    fixture = SCENARIO_TO_FIXTURE.get(scenario_id, "standard")
    assessment = None
    if scenario_id != "BASELINE":
        assessment = _run_assessment(fixture)

    # Proposed solutions attach assessment metrics. NO_ACTION uses stress for consequence
    # context but does not claim an improvement percentage.
    attach_assessment = assessment if scenario_id not in {"NO_ACTION", "BASELINE"} else None
    briefing = build_structured_briefing(
        context,
        scenario_id=scenario_id,
        assessment=attach_assessment,
        include_bob=include_bob,
    )

    if scenario_id == "NO_ACTION" and assessment:
        rec = assessment.get("recommendation") or {}
        briefing["if_no_action"] = (
            briefing["if_no_action"]
            + f" Under the stress assessment fixture, recommendation status is "
            f"{rec.get('recommendation_status')}."
        )
        briefing["explanation"] = briefing["if_no_action"]
        briefing["consequences"] = briefing["no_action_consequences"]
        briefing["simulation_metrics"] = {
            "recommendation_status": rec.get("recommendation_status"),
            "selected_candidate_id": rec.get("selected_candidate_id"),
            "fixture_id": fixture,
            "from_simulation": True,
            "scenario": "NO_ACTION",
        }
        briefing["result"] = (
            "No-action path evaluated against the AEGIS stress fixture for consequence context. "
            "No improvement metric is claimed because no intervention was applied."
        )

    component_id = _component_id(context)
    status = ((assessment or {}).get("recommendation") or {}).get("recommendation_status")
    improved = scenario_id not in {"NO_ACTION", "BASELINE"} and status == "recommended"

    # Preserve prior visual heuristics for REROUTE_L1 infeasibility demos.
    if scenario_id == "REROUTE_L1":
        candidates = context.get("candidates") or []
        l1 = next((c for c in candidates if isinstance(c, dict) and c.get("node_id") == "L1"), None)
        if l1 is not None and (not l1.get("eligible") or l1.get("feasible") is not True):
            improved = False
            briefing["supported"] = False
            briefing["title"] = "L1 remains constrained — not a preferred route"
            briefing["explanation"] = (
                "The supplied L1 candidate is ineligible, infeasible or undetermined. "
                "Additional diversion does not resolve that constraint."
            )
            briefing["result"] = briefing["explanation"]

    unknown = False
    rec_ctx = context.get("recommendation") or {}
    if rec_ctx.get("recommendation_status") == "abstained":
        unknown = True
    if any(
        isinstance(c, dict) and c.get("feasible") is None
        for c in (context.get("candidates") or [])
    ):
        unknown = True
    if unknown and scenario_id not in {"NO_ACTION", "BASELINE"}:
        briefing["supported"] = False
        briefing["title"] = "Outcome unavailable — observations require review"
        briefing["explanation"] = (
            "The supplied response abstains or leaves feasibility undetermined. "
            "Obtain reliable observations before asserting an intervention outcome."
        )
        briefing["result"] = briefing["explanation"]
        improved = False

    node_states: dict[str, Any] = {}
    if unknown and scenario_id not in {"NO_ACTION", "BASELINE"}:
        node_states = {}
    elif scenario_id == "NO_ACTION":
        node_states[component_id] = {"severity": "critical"}
    elif scenario_id == "REROUTE_L1" and not improved:
        node_states["L1"] = {"severity": "critical", "storageLevel": "raised"}
    elif improved or scenario_id not in {"NO_ACTION", "BASELINE"}:
        target = component_id
        if scenario_id == "INCREASE_STORAGE" and COMPONENTS.get(component_id, {}).get("component_type") != "storage":
            target = "L1"
        if scenario_id == "REROUTE_L2":
            target = "L2"
        if scenario_id == "REROUTE_L1":
            target = "L1"
        if improved:
            node_states[target] = {
                "severity": "moderate",
                **(
                    {"storageLevel": "settled"}
                    if COMPONENTS.get(target, {}).get("component_type") == "storage"
                    else {}
                ),
            }
        else:
            node_states[target] = {"severity": "critical"}

    # Edge stages: reuse directed topology lookup (frontend may overlay).
    edge_stages: dict[str, int] = {}
    network = context.get("network") or {}
    edges = network.get("edges") if isinstance(network, dict) else None
    if edges and not unknown:
        excluded = {
            c.get("node_id")
            for c in (context.get("candidates") or [])
            if isinstance(c, dict) and (not c.get("eligible") or c.get("feasible") is None)
        }
        branch = "L1" if scenario_id == "REROUTE_L1" else "L2" if scenario_id == "REROUTE_L2" else None
        nodes = {n.get("id"): n for n in (network.get("nodes") or []) if isinstance(n, dict)}
        for edge in edges:
            if not isinstance(edge, dict):
                continue
            if edge.get("to") in excluded or edge.get("from") in excluded:
                continue
            if (nodes.get(edge.get("from")) or {}).get("type") == "recharge":
                continue
            if branch and (
                (edge.get("from") == "J3" and edge.get("to") != branch)
                or (edge.get("from") in {"L1", "L2"} and edge.get("from") != branch)
            ):
                continue
            src = edge.get("from")
            edge_stages[str(edge.get("id"))] = (
                0 if src in {"C1", "C2"} else 1 if src == "J3" else 3 if src == "J4" else 2
            )

    briefing["visual"] = {
        "scenarioId": scenario_id,
        "edgeStages": edge_stages,
        "nodeStates": node_states,
    }
    briefing["scenarioId"] = scenario_id
    if assessment and scenario_id not in {"NO_ACTION", "BASELINE"}:
        briefing["source"] = "aegis"
    return briefing
