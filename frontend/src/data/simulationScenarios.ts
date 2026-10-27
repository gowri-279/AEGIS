import type { FixtureId } from "./mockCanonicalResponse";
import type { ConditionId } from "./hydraulicSimulation";

export interface ScenarioOption {
  id: string;
  label: string;
  detail: string;
  fixture: FixtureId;
  conditionId: ConditionId;
}

/** Exactly five rainfall / loading conditions for Monitor → Simulate. */
export const SCENARIOS: ScenarioOption[] = [
  { id: "normal_rainfall", label: "Normal Rainfall", detail: "Baseline loading from canonical observed flows", fixture: "standard", conditionId: "normal_rainfall" },
  { id: "heavy_storm", label: "Heavy Storm", detail: "Elevated rainfall / hydraulic loading", fixture: "stress", conditionId: "heavy_storm" },
  { id: "flooding", label: "Flooding", detail: "High sustained loading / downstream stress", fixture: "stress", conditionId: "flooding" },
  { id: "extreme_rainfall", label: "Extreme Rainfall", detail: "Severe hydraulic loading", fixture: "stress", conditionId: "extreme_rainfall" },
  { id: "cloudburst", label: "Cloudburst / Peak Event", detail: "Short-duration peak inflow / maximum stress", fixture: "stress", conditionId: "cloudburst" },
];
