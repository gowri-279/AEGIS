"""Build Bob: structured candidate design intelligence with V2 fallback."""

from __future__ import annotations

import json
from typing import Any

from backend.intelligence.bob_service import run_bob, try_parse_json_message


# Authored V2 candidate values — preserved as the UI source of truth for metrics.
V2_CANDIDATES = [
    {
        "id": "A",
        "name": "Design A — Balanced",
        "recommended": True,
        "flood_risk_impact": "-31%",
        "downstream_load_impact": "-18%",
        "lake_impact": "Low",
        "resilience_impact": "+24%",
        "construction_impact": "Moderate",
        "confidence": 84,
        "rationale": (
            "Addresses the J3 → L2 primary bottleneck using the eastern low-point corridor, "
            "reduces upstream concentration, limits additional downstream hydraulic transfer, "
            "protects O1 / lake impact, reuses existing infrastructure, and accounts for "
            "terrain/construction constraints. L2 sensor staleness reduces observation confidence."
        ),
        "reliability_considerations": "L2 observation is stale; treat L2-related recommendations with reduced confidence.",
        "tradeoffs": ["Moderate construction", "Residual O1 downstream constraint"],
        "network_changes": ["Add J5", "Add P21", "Add D01", "Add R01", "Retain O1"],
    },
    {
        "id": "B",
        "name": "Design B — Minimum Infrastructure",
        "recommended": False,
        "flood_risk_impact": "-21%",
        "downstream_load_impact": "-10%",
        "lake_impact": "Low",
        "resilience_impact": "+15%",
        "construction_impact": "Low",
        "confidence": 78,
        "rationale": "Minimum intervention focusing on a compact diversion near the eastern corridor.",
        "reliability_considerations": "Lower construction risk; smaller resilience gain.",
        "tradeoffs": ["Lower flood-risk reduction", "Limited detention"],
        "network_changes": ["Add J5", "Add P21", "Connect toward O1"],
    },
    {
        "id": "C",
        "name": "Design C — Maximum Resilience",
        "recommended": False,
        "flood_risk_impact": "-39%",
        "downstream_load_impact": "-24%",
        "lake_impact": "Very Low",
        "resilience_impact": "+34%",
        "construction_impact": "High",
        "confidence": 80,
        "rationale": "Maximum resilience with additional storage and relief channels under high construction cost.",
        "reliability_considerations": "More infrastructure to verify; higher construction footprint.",
        "tradeoffs": ["High construction", "Larger footprint"],
        "network_changes": ["Add J5", "Add D01", "Add R01", "Add D02", "Add relief channel"],
    },
]


def _context_summary(context: dict[str, Any] | None) -> str:
    if not context:
        return "{}"
    try:
        return json.dumps(context, default=str)[:14000]
    except TypeError:
        return str(context)[:14000]


def build_design_prompt(context: dict[str, Any] | None) -> str:
    return (
        "You are Bob, the AEGIS Build Engineering Intelligence layer.\n"
        "Propose THREE stormwater design candidates (A, B, C) for the engineer.\n"
        "Return ONLY JSON of the form:\n"
        '{"candidates":[{"id":"A","name":"...","recommended":true,'
        '"network_changes":[],"rationale":"...","flood_risk_impact":"...",'
        '"downstream_load_impact":"...","lake_impact":"...",'
        '"resilience_impact":"...","construction_impact":"...",'
        '"reliability_considerations":"...","confidence":0,"tradeoffs":[]}]}\n'
        "Do NOT invent surveyed capacities or claim safety qualification.\n"
        "Use ONLY the supplied Build context. Prefer reuse of existing infrastructure.\n\n"
        f"BUILD CONTEXT JSON:\n{_context_summary(context)}\n"
    )


def _merge_with_v2(bob_candidates: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Keep authored V2 metric fields; overlay Bob rationale/design text when valid."""
    by_id = {
        str(item.get("id")): item
        for item in (bob_candidates or [])
        if isinstance(item, dict) and item.get("id") in {"A", "B", "C"}
    }
    merged: list[dict[str, Any]] = []
    for base in V2_CANDIDATES:
        overlay = by_id.get(base["id"], {})
        item = dict(base)
        # Preserve V2 numeric/demo metrics; accept Bob prose/structure fields.
        for key in (
            "name",
            "rationale",
            "reliability_considerations",
            "tradeoffs",
            "network_changes",
        ):
            value = overlay.get(key)
            if value:
                item[key] = value
        if "recommended" in overlay and isinstance(overlay["recommended"], bool):
            item["recommended"] = overlay["recommended"]
        # Keep V2 flood/downstream/lake/resilience/construction/confidence unless Bob omitted them entirely
        # and provided replacements — still prefer V2 for demo consistency.
        item["source"] = "bob+v2" if overlay else "v2"
        merged.append(item)
    # Ensure exactly one recommended.
    if not any(c.get("recommended") for c in merged):
        merged[0]["recommended"] = True
    return merged


def _extract_candidates(parsed: Any) -> list[dict[str, Any]] | None:
    if isinstance(parsed, dict) and isinstance(parsed.get("candidates"), list):
        return [c for c in parsed["candidates"] if isinstance(c, dict)]
    if isinstance(parsed, list) and all(isinstance(c, dict) for c in parsed):
        return parsed
    return None


def handle_build_bob_design(
    context: dict[str, Any] | None = None,
    *,
    runner=None,
) -> dict[str, Any]:
    """Ask Bob for A/B/C candidates; always return V2-safe merged candidates."""
    prompt = build_design_prompt(context)
    bob = run_bob(prompt, runner=runner)

    bob_candidates = None
    if bob.get("ok") and bob.get("last_message"):
        bob_candidates = _extract_candidates(try_parse_json_message(bob["last_message"]))

    if bob_candidates:
        candidates = _merge_with_v2(bob_candidates)
        return {
            "ok": True,
            "source": "bob",
            "error": None,
            "candidates": candidates,
            "explanation": bob.get("last_message"),
        }

    return {
        "ok": False,
        "source": "v2_fallback",
        "error": bob.get("error") or "malformed_or_unavailable",
        "candidates": _merge_with_v2(None),
        "explanation": (
            "Bob design intelligence unavailable or malformed. "
            "Existing V2 candidate designs remain available."
        ),
    }
