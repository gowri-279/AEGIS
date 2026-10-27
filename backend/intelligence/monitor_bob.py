"""Monitor Bob: explanation + allowlisted what-if simulation intents."""

from __future__ import annotations

import json
import re
from typing import Any

from backend.intelligence.bob_service import run_bob, try_parse_json_message


# Allowlisted simulation actions only — mapped onto existing assessment fixtures.
ALLOWED_SIMULATION_ACTIONS = {
    "run_standard": {
        "action": "run_standard",
        "fixture": "standard",
        "scenario_option_id": "standard",
    },
    "run_stress": {
        "action": "run_stress",
        "fixture": "stress",
        "scenario_option_id": "heavy-rain",
    },
    "run_degraded": {
        "action": "run_degraded",
        "fixture": "degraded",
        "scenario_option_id": "degraded",
    },
    "run_critical_stale": {
        "action": "run_critical_stale",
        "fixture": "critical_stale",
        "scenario_option_id": "sensor-failure",
    },
    "reroute_away_from_l2": {
        "action": "reroute_away_from_l2",
        "fixture": "stress",
        "scenario_option_id": "heavy-rain",
        "visual": "l2-unavailable",
    },
    "increase_j3_conveyance": {
        "action": "increase_j3_conveyance",
        "fixture": "standard",
        "scenario_option_id": "standard",
    },
}


def _heuristic_simulation_action(message: str) -> dict[str, Any] | None:
    q = message.lower()
    if re.search(r"\bl2\b", q) and re.search(
        r"unavailable|removed|offline|without|fail|reroute|route more|divert", q
    ):
        return {
            "type": "simulation_request",
            **ALLOWED_SIMULATION_ACTIONS["reroute_away_from_l2"],
            "parameters": {"target_node": "L2"},
            "explanation": "Illustrative what-if: evaluate the network if L2 is unavailable.",
        }
    if re.search(r"degrad", q) and re.search(r"sensor|wl-j3|j3", q):
        return {
            "type": "simulation_request",
            **ALLOWED_SIMULATION_ACTIONS["run_degraded"],
            "parameters": {},
            "explanation": "Run the degraded WL-J3 assessment fixture.",
        }
    if re.search(r"stale|sensor fail|missing sensor|critical sensor", q):
        return {
            "type": "simulation_request",
            **ALLOWED_SIMULATION_ACTIONS["run_critical_stale"],
            "parameters": {},
            "explanation": "Run the critical stale WL-J3 abstention fixture.",
        }
    if re.search(r"heavy|extreme|flood|overflow|stress|900", q) and re.search(
        r"rain|storm|simulat|what if|scenario", q
    ):
        return {
            "type": "simulation_request",
            **ALLOWED_SIMULATION_ACTIONS["run_stress"],
            "parameters": {},
            "explanation": "Run the stress / heavy-rainfall assessment fixture.",
        }
    if re.search(r"normal|standard", q) and re.search(r"rain|simulat|scenario", q):
        return {
            "type": "simulation_request",
            **ALLOWED_SIMULATION_ACTIONS["run_standard"],
            "parameters": {},
            "explanation": "Run the standard assessment fixture.",
        }
    if re.search(r"simulat|what[- ]?if|reroute|route more|increase capacity|conveyance", q):
        # Generic what-if → stress unless clearly standard.
        return {
            "type": "simulation_request",
            **ALLOWED_SIMULATION_ACTIONS["run_stress"],
            "parameters": {},
            "explanation": "Run an allowlisted AEGIS what-if simulation via the stress fixture.",
        }
    return None


def _validate_simulation_request(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    if raw.get("type") != "simulation_request":
        return None
    action = raw.get("action")
    if action not in ALLOWED_SIMULATION_ACTIONS:
        # Reject arbitrary / shell-like actions.
        return None
    if any(
        key in raw
        for key in ("shell", "command", "exec", "subprocess", "script", "bash")
    ):
        return None
    allowed = ALLOWED_SIMULATION_ACTIONS[action]
    params = raw.get("parameters") if isinstance(raw.get("parameters"), dict) else {}
    return {
        "type": "simulation_request",
        "action": allowed["action"],
        "fixture": allowed["fixture"],
        "scenario_option_id": allowed["scenario_option_id"],
        "visual": allowed.get("visual"),
        "parameters": params,
        "explanation": str(
            raw.get("explanation")
            or f"Allowlisted AEGIS simulation action: {allowed['action']}"
        ),
    }


def _context_summary(context: dict[str, Any] | None) -> str:
    if not context:
        return "No additional AEGIS context was supplied."
    # Keep prompt bounded; never invent fields.
    compact = {
        "network": context.get("network"),
        "fixture_id": context.get("fixture_id"),
        "sensors": context.get("sensors"),
        "risks": context.get("risks"),
        "candidates": context.get("candidates"),
        "recommendation": context.get("recommendation"),
        "simulation": context.get("simulation"),
        "assessed_state": context.get("assessed_state"),
    }
    try:
        return json.dumps(compact, default=str)[:12000]
    except TypeError:
        return str(compact)[:12000]


def build_monitor_prompt(message: str, context: dict[str, Any] | None) -> str:
    return (
        "You are Bob, the AEGIS Engineering Intelligence layer.\n"
        "You explain AEGIS P1/P2/P3 findings. You do NOT invent physics, capacities, "
        "or safety qualifications. Use ONLY the supplied context.\n"
        "If the engineer asks for a what-if simulation, respond with ONLY JSON:\n"
        '{"type":"simulation_request","action":"<allowlisted>","parameters":{},'
        '"explanation":"..."}\n'
        "Allowlisted actions: "
        + ", ".join(sorted(ALLOWED_SIMULATION_ACTIONS))
        + ".\n"
        "Never request shell commands or network mutation.\n"
        "For ordinary explanation questions, reply in clear engineering prose.\n\n"
        f"ENGINEER MESSAGE:\n{message}\n\n"
        f"AEGIS CONTEXT JSON:\n{_context_summary(context)}\n"
    )


def handle_monitor_bob(
    message: str,
    context: dict[str, Any] | None = None,
    *,
    runner=None,
) -> dict[str, Any]:
    """Answer a Monitor Bob question; optionally emit an allowlisted simulation request."""
    heuristic = _heuristic_simulation_action(message)
    prompt = build_monitor_prompt(message, context)
    bob = run_bob(prompt, runner=runner)

    simulation_request = None
    explanation = None

    if bob.get("ok") and bob.get("last_message"):
        parsed = try_parse_json_message(bob["last_message"])
        simulation_request = _validate_simulation_request(parsed)
        if simulation_request is None:
            explanation = bob["last_message"]
    elif heuristic is not None:
        # Bob unavailable — still allow deterministic intent routing into AEGIS sims.
        simulation_request = heuristic
        explanation = heuristic.get("explanation")
    else:
        explanation = (
            "Bob is temporarily unavailable. Existing AEGIS assessment outputs remain authoritative."
        )

    if simulation_request is None and heuristic is not None and bob.get("ok"):
        # Prefer Bob prose, but if the user clearly asked for a sim, attach heuristic action.
        if re.search(r"simulat|what[- ]?if|reroute|unavailable", message.lower()):
            simulation_request = heuristic

    return {
        "ok": bool(bob.get("ok")) or simulation_request is not None,
        "source": "bob" if bob.get("ok") else "fallback",
        "error": bob.get("error"),
        "explanation": explanation,
        "simulation_request": simulation_request,
    }
