"""P2 network risk assessment for the AEGIS illustrative MVP."""

UNUSABLE_STATUSES = {"stale", "missing", "invalid", "conflicting"}

# Illustrative risk-confidence values; these are NOT sensor data confidence.
# They are provisional MVP values, not statistically calibrated probabilities.
RISK_CONFIDENCE_WATER_LEVEL = 0.8
RISK_CONFIDENCE_DEGRADED_WARNING = 0.6
RISK_CONFIDENCE_EDGE_OVERLOAD = 0.8
RISK_CONFIDENCE_WATER_QUALITY = 0.7


def assess_network(readings, modeled_edges=None, water_quality_threshold=None):
    """Assess sensor evidence and modeled risks without choosing a route.

    readings: list of records returned by assess_reading().
    modeled_edges: optional list of dictionaries with edge_id, flow_m3_s,
                   and capacity_m3_s.
    water_quality_threshold: optional, explicitly supplied scenario threshold.

    This function does not calculate candidate rankings or claim real-world
    hydraulic safety. P3 owns candidate evaluation and recommendations.
    """
    readings_by_id = {item["sensor_id"]: item for item in readings}
    findings = []
    issues = []

    for reading in readings:
        for code in reading.get("issue_codes", []):
            issues.append({
                "sensor_id": reading["sensor_id"],
                "issue_code": code,
                "quality_status": reading["quality_status"],
            })

    # Critical decision gate: WL-J3 measures synthetic water depth at J3.
    wl_j3 = readings_by_id.get("WL-J3")
    if (
        wl_j3 is None
        or wl_j3.get("effective_value") is None
        or wl_j3.get("quality_status") in UNUSABLE_STATUSES
    ):
        wl_gate = {
            "status": "not_evaluated",
            "reason_code": "CRITICAL_WL_J3_UNUSABLE",
            "sensor_id": "WL-J3",
        }
        decision_gate = "abstained"
    else:
        value = wl_j3["effective_value"]
        passed = value < 0.80
        wl_gate = {
            "status": "passed" if passed else "failed",
            "sensor_id": "WL-J3",
            "observed_value": value,
            "threshold_m": 0.80,
            "comparison": "less_than",
            "reason_code": None if passed else "WL_J3_DEPTH_LIMIT_REACHED",
        }
        decision_gate = "evaluate_candidates"

        if value >= 0.80:
            findings.append({
                "finding_id": "RISK-WL-J3-001",
                "risk_type": "water_level_threshold_exceeded",
                "node_id": "J3",
                "sensor_id": "WL-J3",
                "observed_value": value,
                "threshold": 0.80,
                "unit": "m",
                "severity": "high",
                "confidence": RISK_CONFIDENCE_WATER_LEVEL,
                "evidence": ["WL-J3 effective reading is at or above 0.80 m"],
                "impact": "The modeled J3 water-depth constraint is not satisfied.",
            })

        if wl_j3.get("quality_status") == "degraded":
            findings.append({
                "finding_id": "RISK-WL-J3-DEGRADED",
                "risk_type": "sensor_reliability_warning",
                "node_id": "J3",
                "sensor_id": "WL-J3",
                "observed_value": value,
                "threshold": None,
                "severity": "medium",
                "confidence": RISK_CONFIDENCE_DEGRADED_WARNING,
                "evidence": ["WL-J3 reading is marked degraded but usable"],
                "impact": "Interpret the water-depth assessment with caution.",
            })

    # Edge overloads are only assessed when an edge and positive capacity
    # are explicitly supplied as part of the modeled network.
    for edge in modeled_edges or []:
        flow = edge.get("flow_m3_s")
        capacity = edge.get("capacity_m3_s")
        if (
            not isinstance(flow, (int, float))
            or not isinstance(capacity, (int, float))
            or capacity <= 0
        ):
            continue

        utilization = flow / capacity
        if utilization > 1.0:
            findings.append({
                "finding_id": f"RISK-EDGE-{edge.get('edge_id', 'UNKNOWN')}-OVERLOAD",
                "risk_type": "hydraulic_overload",
                "edge_id": edge.get("edge_id"),
                "observed_value": flow,
                "threshold": capacity,
                "unit": "m3/s",
                "utilization": round(utilization, 6),
                "severity": "high",
                "confidence": RISK_CONFIDENCE_EDGE_OVERLOAD,
                "evidence": ["Supplied flow exceeds the modeled edge capacity"],
                "impact": "The supplied edge exceeds its modeled capacity.",
            })

    # No universal water-quality threshold is assumed by this module.
    if water_quality_threshold is not None:
        for reading in readings:
            if (
                reading.get("sensor_type") == "water_quality"
                and reading.get("effective_value") is not None
                and reading["effective_value"] > water_quality_threshold
            ):
                findings.append({
                    "finding_id": f"RISK-{reading['sensor_id']}-QUALITY",
                    "risk_type": "water_quality_threshold_exceeded",
                    "sensor_id": reading["sensor_id"],
                    "observed_value": reading["effective_value"],
                    "threshold": water_quality_threshold,
                    "severity": "medium",
                    "confidence": RISK_CONFIDENCE_WATER_QUALITY,
                    "evidence": ["Reading exceeds the caller-supplied scenario threshold"],
                    "impact": "The configured illustrative water-quality threshold is exceeded.",
                })

    if decision_gate == "abstained":
        health = "insufficient_critical_sensor_data"
    elif any(item.get("severity") == "high" for item in findings):
        health = "risk_detected"
    elif issues or findings:
        health = "degraded"
    else:
        health = "normal"

    return {
        "decision_gate": decision_gate,
        "critical_constraints": {"WL-J3-depth": wl_gate},
        "network_health": health,
        "sensor_issues": issues,
        "risk_findings": findings,
        "downstream_capacity": {
            "status": "not_evaluated",
            "reason_code": "DOWNSTREAM_EDGE_NOT_MODELED",
        },
        "scope": "limited_mvp_scope",
        "safety_qualified": False,
    }
