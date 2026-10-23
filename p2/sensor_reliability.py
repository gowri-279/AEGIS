"""P2 sensor reliability engine for AEGIS.

All readings are synthetic/illustrative MVP data.
This module evaluates data quality; confidence is NOT hazard probability.
"""

from datetime import datetime, timezone
from typing import Any


FRESHNESS_THRESHOLDS_SECONDS = {
    "rainfall": 5 * 60,
    "water_level": 5 * 60,
    "flow": 5 * 60,
    "pressure": 5 * 60,
    "water_quality": 15 * 60,
}

ALLOWED_STATUSES = {
    "fresh",
    "degraded",
    "stale",
    "missing",
    "invalid",
    "conflicting",
}

ISSUE_CODES = {
    "stale": "CRITICAL_SENSOR_STALE",
    "missing": "CRITICAL_SENSOR_MISSING",
    "invalid": "CRITICAL_SENSOR_INVALID",
    "conflicting": "CRITICAL_SENSOR_CONFLICTING",
    "degraded": "DEGRADED_SENSOR",
}


def _parse_timestamp(value: str | datetime | None) -> datetime | None:
    """Parse an ISO-8601 timestamp and normalize it to UTC."""
    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("timestamp must be a valid ISO-8601 timestamp")
    else:
        raise ValueError("timestamp must be a string, datetime, or None")

    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a timezone (UTC recommended)")

    return parsed.astimezone(timezone.utc)


def assess_reading(
    sensor_id: str,
    sensor_type: str,
    raw_value: Any,
    timestamp: str | datetime | None,
    now: str | datetime | None = None,
    reported_status: str | None = None,
    degraded_usable: bool = True,
) -> dict:
    """Validate and assess one sensor reading.

    reported_status is optional and can explicitly indicate degraded,
    invalid, or conflicting input from a simulator or upstream detector.
    Freshness is calculated from the timestamp unless a higher-priority
    data-quality condition applies.

    Returns a JSON-serializable dictionary.
    """
    if not sensor_id or not isinstance(sensor_id, str):
        raise ValueError("sensor_id must be a non-empty string")

    if sensor_type not in FRESHNESS_THRESHOLDS_SECONDS:
        raise ValueError(
            f"Unsupported sensor_type: {sensor_type!r}. "
            f"Expected one of {sorted(FRESHNESS_THRESHOLDS_SECONDS)}"
        )

    if reported_status is not None and reported_status not in ALLOWED_STATUSES:
        raise ValueError(
            f"reported_status must be one of {sorted(ALLOWED_STATUSES)}"
        )

    current_time = _parse_timestamp(now) if now is not None else datetime.now(timezone.utc)

    # A missing reading is represented with null raw/effective values and time.
    if reported_status == "missing" or raw_value is None:
        return {
            "sensor_id": sensor_id,
            "sensor_type": sensor_type,
            "raw_value": None,
            "effective_value": None,
            "timestamp": None,
            "age_seconds": None,
            "quality_status": "missing",
            "confidence": 0.0,
            "issue_codes": ["CRITICAL_SENSOR_MISSING"],
        }

    # Keep a supplied raw value for traceability when the reading is unusable.
    try:
        numeric_value = float(raw_value)
    except (TypeError, ValueError):
        return {
            "sensor_id": sensor_id,
            "sensor_type": sensor_type,
            "raw_value": raw_value,
            "effective_value": None,
            "timestamp": None,
            "age_seconds": None,
            "quality_status": "invalid",
            "confidence": 0.0,
            "issue_codes": ["CRITICAL_SENSOR_INVALID"],
        }

    if not __import__("math").isfinite(numeric_value):
        return {
            "sensor_id": sensor_id,
            "sensor_type": sensor_type,
            "raw_value": raw_value,
            "effective_value": None,
            "timestamp": None,
            "age_seconds": None,
            "quality_status": "invalid",
            "confidence": 0.0,
            "issue_codes": ["CRITICAL_SENSOR_INVALID"],
        }

    try:
        parsed_timestamp = _parse_timestamp(timestamp)
    except ValueError:
        return {
            "sensor_id": sensor_id,
            "sensor_type": sensor_type,
            "raw_value": raw_value,
            "effective_value": None,
            "timestamp": None,
            "age_seconds": None,
            "quality_status": "invalid",
            "confidence": 0.0,
            "issue_codes": ["CRITICAL_SENSOR_INVALID", "MISSING_TIMESTAMP"],
        }

    if parsed_timestamp is None:
        return {
            "sensor_id": sensor_id,
            "sensor_type": sensor_type,
            "raw_value": raw_value,
            "effective_value": None,
            "timestamp": None,
            "age_seconds": None,
            "quality_status": "missing",
            "confidence": 0.0,
            "issue_codes": ["CRITICAL_SENSOR_MISSING", "MISSING_TIMESTAMP"],
        }

    age_seconds = (current_time - parsed_timestamp).total_seconds()

    # Future-dated readings are invalid rather than treated as fresh.
    if age_seconds < 0:
        return {
            "sensor_id": sensor_id,
            "sensor_type": sensor_type,
            "raw_value": raw_value,
            "effective_value": None,
            "timestamp": parsed_timestamp.isoformat().replace("+00:00", "Z"),
            "age_seconds": age_seconds,
            "quality_status": "invalid",
            "confidence": 0.0,
            "issue_codes": ["CRITICAL_SENSOR_INVALID"],
        }

    normalized_timestamp = parsed_timestamp.isoformat().replace("+00:00", "Z")

    if reported_status == "conflicting":
        status = "conflicting"
    elif reported_status == "invalid":
        status = "invalid"
    elif reported_status == "stale":
        status = "stale"
    elif reported_status == "missing":
        status = "missing"
    elif reported_status == "degraded":
        status = "degraded"
    elif age_seconds > FRESHNESS_THRESHOLDS_SECONDS[sensor_type]:
        status = "stale"
    else:
        status = "fresh"

    if status == "missing":
        effective_value = None
        confidence = 0.0
        issue_codes = ["CRITICAL_SENSOR_MISSING"]
    elif status == "invalid":
        effective_value = None
        confidence = 0.0
        issue_codes = ["CRITICAL_SENSOR_INVALID"]
    elif status == "conflicting":
        effective_value = None
        confidence = 0.0
        issue_codes = ["CRITICAL_SENSOR_CONFLICTING"]
    elif status == "stale":
        effective_value = None
        confidence = 0.0
        issue_codes = ["CRITICAL_SENSOR_STALE"]
    elif status == "degraded":
        effective_value = numeric_value if degraded_usable else None
        confidence = 0.5 if degraded_usable else 0.0
        issue_codes = ["DEGRADED_SENSOR"]
    else:
        effective_value = numeric_value
        confidence = 1.0
        issue_codes = []

    return {
        "sensor_id": sensor_id,
        "sensor_type": sensor_type,
        "raw_value": raw_value,
        "effective_value": effective_value,
        "timestamp": normalized_timestamp,
        "age_seconds": round(age_seconds, 3),
        "quality_status": status,
        "confidence": confidence,
        "issue_codes": issue_codes,
    }
