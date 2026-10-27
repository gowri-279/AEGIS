"""Monitor Bob: explanation + allowlisted what-if simulation intents."""

from __future__ import annotations

import json
import re
from typing import Any

from backend.intelligence.bob_service import run_bob, try_parse_json_message
from backend.simulation.hydraulic_whatif import (
    ALLOWED_ACTIONS,
    CONDITIONS,
    explain_from_result,
    parse_bob_action,
    run_hydraulic_simulation,
)


# Allowlisted actions — executed by the hydraulic engine (not Bob).
ALLOWED_SIMULATION_ACTIONS = {
    action: {"action": action} for action in sorted(ALLOWED_ACTIONS)
}


def _heuristic_simulation_action(message: str) -> dict[str, Any] | None:
    return parse_bob_action(message)


def _validate_simulation_request(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    if raw.get("type") != "simulation_request":
        return None
    action = str(raw.get("action") or "").lower()
    if action not in ALLOWED_ACTIONS:
        return None
    if any(
        key in raw
        for key in ("shell", "command", "exec", "subprocess", "script", "bash")
    ):
        return None
    params = raw.get("parameters") if isinstance(raw.get("parameters"), dict) else {}
    condition = params.get("condition")
    fixture = None
    if condition:
        cid = str(condition)
        if cid in CONDITIONS:
            fixture = CONDITIONS[cid]["fixture"]
    return {
        "type": "simulation_request",
        "action": action,
        "fixture": fixture,
        "scenario_option_id": condition,
        "parameters": params,
        "explanation": str(
            raw.get("explanation") or f"Allowlisted AEGIS simulation action: {action}"
        ),
    }


def _context_summary(context: dict[str, Any] | None) -> str:
    if not context:
        return "No additional AEGIS context was supplied."
    compact = {
        "network": context.get("network"),
        "fixture_id": context.get("fixture_id"),
        "sensors": context.get("sensors"),
        "risks": context.get("risks"),
        "candidates": context.get("candidates"),
        "recommendation": context.get("recommendation"),
        "simulation": context.get("simulation"),
        "assessed_state": context.get("assessed_state"),
        "selected_component": context.get("selected_component"),
        "hydraulic": context.get("hydraulic"),
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
        + ", ".join(sorted(ALLOWED_ACTIONS))
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
    execute_simulation: bool = True,
) -> dict[str, Any]:
    """Answer a Monitor Bob question; optionally emit + run an allowlisted simulation."""
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
        simulation_request = heuristic
        explanation = heuristic.get("explanation")
    else:
        explanation = (
            "Bob is temporarily unavailable. Existing AEGIS assessment outputs remain authoritative."
        )

    if simulation_request is None and heuristic is not None and bob.get("ok"):
        if re.search(r"simulat|what[- ]?if|reroute|unavailable|divert|cloudburst", message.lower()):
            simulation_request = heuristic

    hydraulic_result = None
    if execute_simulation and simulation_request is not None:
        try:
            hydraulic_result = run_hydraulic_simulation(
                condition=(simulation_request.get("parameters") or {}).get("condition")
                or simulation_request.get("scenario_option_id"),
                action=simulation_request["action"],
                parameters=simulation_request.get("parameters") or {},
            )
            explanation = explain_from_result(
                hydraulic_result,
                bob_intent=simulation_request.get("explanation"),
            )
            simulation_request = {
                **simulation_request,
                "fixture": hydraulic_result.get("fixture"),
                "scenario_option_id": hydraulic_result.get("condition_id"),
            }
        except Exception as exc:  # pragma: no cover - defensive
            hydraulic_result = {"ok": False, "error": str(exc), "baseline_mutated": False}

    return {
        "ok": bool(bob.get("ok")) or simulation_request is not None,
        "source": "bob" if bob.get("ok") else "fallback",
        "error": bob.get("error"),
        "explanation": explanation,
        "simulation_request": simulation_request,
        "hydraulic_result": hydraulic_result,
    }
