"""Repeatable synthetic sensor readings for the AEGIS illustrative MVP."""

from datetime import datetime, timezone, timedelta

from p2.sensor_reliability import assess_reading


DEFAULT_SENSORS = [
    {"sensor_id": "WL-J3", "sensor_type": "water_level", "value": 0.60},
    {"sensor_id": "RF-J3", "sensor_type": "rainfall", "value": 12.0},
    {"sensor_id": "FL-L1", "sensor_type": "flow", "value": 0.333333},
    {"sensor_id": "PR-L1", "sensor_type": "pressure", "value": 1.2},
    {"sensor_id": "WQ-J3", "sensor_type": "water_quality", "value": 20.0},
]


def simulate_readings(sensors=None, failure_modes=None, now=None):
    """Return assessed synthetic readings.

    failure_modes maps sensor IDs to one of:
    stale, missing, invalid, conflicting, degraded, degraded_unusable.
    """
    current = now or datetime.now(timezone.utc)
    if isinstance(current, str):
        current = datetime.fromisoformat(current.replace("Z", "+00:00"))
    if current.tzinfo is None:
        raise ValueError("now must include a timezone")

    failure_modes = failure_modes or {}
    results = []

    for sensor in sensors or DEFAULT_SENSORS:
        sensor_id = sensor["sensor_id"]
        mode = failure_modes.get(sensor_id)
        timestamp = current.isoformat().replace("+00:00", "Z")
        raw_value = sensor.get("value")
        reported_status = None
        degraded_usable = True

        if mode == "stale":
            timestamp = (current - timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
        elif mode == "missing":
            raw_value = None
            timestamp = None
        elif mode == "invalid":
            raw_value = "invalid-synthetic-value"
        elif mode == "conflicting":
            reported_status = "conflicting"
        elif mode == "degraded":
            reported_status = "degraded"
        elif mode == "degraded_unusable":
            reported_status = "degraded"
            degraded_usable = False
        elif mode is not None:
            raise ValueError(f"Unsupported failure mode {mode!r} for {sensor_id}")

        results.append(assess_reading(
            sensor_id=sensor_id,
            sensor_type=sensor["sensor_type"],
            raw_value=raw_value,
            timestamp=timestamp,
            now=current,
            reported_status=reported_status,
            degraded_usable=degraded_usable,
        ))

    return results
