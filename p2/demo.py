"""Runnable P2 demonstration using synthetic AEGIS sensor/network data."""
import json

from p2.risk_assessment import assess_network
from p2.sensor_simulator import simulate_readings


def show_scenario(name, failure_modes=None, flow=0.333333, capacity=0.5):
    readings = simulate_readings(failure_modes=failure_modes)
    result = assess_network(
        readings,
        modeled_edges=[{
            "edge_id": "E-J3-L2",
            "flow_m3_s": flow,
            "capacity_m3_s": capacity,
        }],
    )

    print(f"\n{'=' * 60}\n{name}\n{'=' * 60}")
    print("Decision gate:", result["decision_gate"])
    print("Critical WL-J3 constraint:",
          result["critical_constraints"]["WL-J3-depth"]["status"])
    print("Network health:", result["network_health"])
    print("Sensor issues:", json.dumps(result["sensor_issues"]))
    print("Risk findings:",
          json.dumps(result["risk_findings"], indent=2))
    print("Downstream capacity:", result["downstream_capacity"]["status"])
    print("Safety qualified:", result["safety_qualified"])


if __name__ == "__main__":
    show_scenario(
        "SCENARIO 1 ? Normal synthetic readings",
        flow=0.333333,
        capacity=0.5,
    )
    show_scenario(
        "SCENARIO 2 ? Critical WL-J3 sensor is stale",
        failure_modes={"WL-J3": "stale"},
        flow=0.333333,
        capacity=0.5,
    )
    show_scenario(
        "SCENARIO 3 ? Modeled edge overload",
        flow=1.5,
        capacity=0.5,
    )
