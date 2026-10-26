import type { FixtureId } from "./mockCanonicalResponse";

export interface ScenarioOption {
  id: string;
  label: string;
  detail: string;
  fixture: FixtureId;
}

// Scenario classes select supplied evaluations; shared fixtures remain explicit.
export const SCENARIOS: ScenarioOption[] = [
  {
    id: "standard",
    label: "Normal Rainfall",
    detail: "Standard storage & recharge scenario",
    fixture: "standard",
  },
  {
    id: "heavy-rain",
    label: "Heavy Rain",
    detail: "High-inflow stress scenario",
    fixture: "stress",
  },
  {
    id: "flooding",
    label: "Flooding",
    detail: "Local accumulation (stress fixture)",
    fixture: "stress",
  },
  {
    id: "degraded",
    label: "Degraded Sensor",
    detail: "Critical sensor usable, reduced confidence",
    fixture: "degraded",
  },
  {
    id: "sensor-failure",
    label: "Sensor Failure",
    detail: "Critical sensor stale",
    fixture: "critical_stale",
  },
];
