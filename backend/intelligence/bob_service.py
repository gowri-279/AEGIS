"""Shared IBM Bob Shell adapter.

Invokes `bob run --format json ...` with BOB_API_KEY from the environment.
Never logs or returns the API key. Callers must treat Bob as advisory only.
"""

from __future__ import annotations

import json
import os
import subprocess
from typing import Any, Callable


BobRunner = Callable[[list[str], dict[str, str], float], subprocess.CompletedProcess]


DEFAULT_TIMEOUT_S = 45.0


def _default_runner(
    argv: list[str], env: dict[str, str], timeout: float
) -> subprocess.CompletedProcess:
    return subprocess.run(
        argv,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
        check=False,
    )


def _extract_last_message(payload: Any) -> str | None:
    if payload is None:
        return None
    if isinstance(payload, str):
        text = payload.strip()
        return text or None
    if not isinstance(payload, dict):
        return None
    for key in ("last_message", "message", "response", "output", "text"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            nested = _extract_last_message(value)
            if nested:
                return nested
    # Common nested envelopes
    for key in ("result", "data", "answer"):
        if key in payload:
            nested = _extract_last_message(payload[key])
            if nested:
                return nested
    return None


def _parse_stdout(stdout: str) -> tuple[Any, str | None]:
    text = (stdout or "").strip()
    if not text:
        return None, None
    try:
        payload = json.loads(text)
        return payload, _extract_last_message(payload)
    except json.JSONDecodeError:
        # Some shells emit trailing logs; try the last JSON object line.
        for line in reversed(text.splitlines()):
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                payload = json.loads(line)
                return payload, _extract_last_message(payload)
            except json.JSONDecodeError:
                continue
        return None, text


def run_bob(
    prompt: str,
    *,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    runner: BobRunner | None = None,
) -> dict[str, Any]:
    """Run one Bob ask turn and return a structured success/error payload."""
    if not isinstance(prompt, str) or not prompt.strip():
        return {
            "ok": False,
            "error": "empty_prompt",
            "last_message": None,
            "raw": None,
        }

    api_key = os.environ.get("BOB_API_KEY")
    if not api_key:
        return {
            "ok": False,
            "error": "missing_api_key",
            "last_message": None,
            "raw": None,
        }

    argv = [
        "bob",
        "run",
        "--format",
        "json",
        "--mode",
        "ask",
        "--max-turns",
        "1",
        prompt.strip(),
    ]
    env = {**os.environ, "BOB_API_KEY": api_key}
    execute = runner or _default_runner

    try:
        completed = execute(argv, env, timeout_s)
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "error": "timeout",
            "last_message": None,
            "raw": None,
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "error": "bob_not_installed",
            "last_message": None,
            "raw": None,
        }
    except OSError as exc:
        return {
            "ok": False,
            "error": f"os_error:{exc.__class__.__name__}",
            "last_message": None,
            "raw": None,
        }

    payload, last_message = _parse_stdout(completed.stdout or "")
    if completed.returncode != 0 and not last_message:
        return {
            "ok": False,
            "error": "bob_failed",
            "last_message": None,
            "raw": payload,
            "exit_code": completed.returncode,
        }

    if not last_message:
        return {
            "ok": False,
            "error": "empty_response",
            "last_message": None,
            "raw": payload,
            "exit_code": completed.returncode,
        }

    return {
        "ok": True,
        "error": None,
        "last_message": last_message,
        "raw": payload,
        "exit_code": completed.returncode,
    }


def try_parse_json_message(message: str | None) -> Any | None:
    """Best-effort parse of a JSON object/array embedded in Bob's last_message."""
    if not message:
        return None
    text = message.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
        start = text.find("[")
        end = text.rfind("]")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None
