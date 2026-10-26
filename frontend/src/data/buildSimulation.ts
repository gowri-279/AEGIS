/** Build Step 6 — synthetic, illustrative simulation results. No hydrology is computed here; every value is fixed demo data. */
export type SimView = "baseline" | "proposed";
export type Tone = "ok" | "warn" | "risk" | "info";

export const SIM_META = { id: "SIM-DEMO-001", runTime: "00:08.4", data: "Synthetic Illustrative", design: "Design A — Balanced", scenario: "Extreme Rainfall", network: "J3 → L2 → O1", confidence: 82 };

export const SIM_INPUTS = ["Terrain Context", "Existing Network", "Proposed Network", "Design Requirements", "Downstream Constraints", "Environmental Constraints", "Sensor Reliability Context"];

export const SIM_STAGES = ["Loading Network Context", "Initializing Rainfall Scenario", "Routing Baseline Flow", "Routing Proposed Flow", "Calculating Flood Risk", "Evaluating Downstream Load", "Assessing Lake Impact", "Calculating Network Resilience", "Finalizing Results"];

export interface PrimaryMetric { id: string; label: string; baseline: string; proposed: string; change?: string; status: "Improved" }
export const PRIMARY_METRICS: PrimaryMetric[] = [
  { id: "flood", label: "Flood Risk", baseline: "100", proposed: "69", change: "−31%", status: "Improved" },
  { id: "j3", label: "J3 Utilization", baseline: "87%", proposed: "61%", change: "−26 pp", status: "Improved" },
  { id: "o1", label: "O1 Utilization", baseline: "78%", proposed: "74%", change: "−4 pp", status: "Improved" },
  { id: "down", label: "Downstream Load", baseline: "100%", proposed: "82%", change: "−18%", status: "Improved" },
  { id: "lake", label: "Lake Impact", baseline: "High", proposed: "Low", status: "Improved" },
  { id: "res", label: "Network Resilience", baseline: "68", proposed: "84", change: "+24%", status: "Improved" },
];

export const CAPACITY = [
  { id: "J3", baseline: 87, proposed: 61 },
  { id: "J4", baseline: 64, proposed: 58 },
  { id: "L2", baseline: 82, proposed: 67 },
  { id: "O1", baseline: 78, proposed: 74 },
];

export const FLOW_ROUTING = [
  { label: "Peak Upstream Flow", baseline: "120", proposed: "94" },
  { label: "Peak Downstream Flow", baseline: "100", proposed: "82" },
];
export const FLOW_NOTES = [
  { label: "Temporary Detention", value: "D01" },
  { label: "Estimated Retained Peak", value: "26 units" },
  { label: "Recharge Contribution", value: "R01" },
  { label: "Estimated Direct Downstream Reduction", value: "8 units" },
];

export const RELIABILITY = [
  { id: "J3", reliability: 94, confidence: 91 },
  { id: "J4", reliability: 88, confidence: 86 },
  { id: "L2", reliability: 61, confidence: 54, stale: true },
];
export const OVERALL_RELIABILITY = 89;

export const REMAINING_RISKS: { level: "Medium" | "Low"; text: string }[] = [
  { level: "Medium", text: "O1 remains at 74% utilization." },
  { level: "Medium", text: "L2 sensor observation remains stale." },
  { level: "Low", text: "Residual flood exposure remains near eastern low-point corridor." },
  { level: "Low", text: "Design requires moderate construction." },
];

export const STRENGTHS = ["Reduces J3 bottleneck pressure", "Reduces flood concentration", "Reduces downstream load", "Protects the lake", "Reuses existing infrastructure", "Improves network resilience"];
export const LIMITATIONS = ["O1 remains a downstream constraint", "L2 sensor confidence is reduced", "Residual flood exposure remains"];
export const TIMELINE = ["Rainfall", "Collection", "J3", "Proposed Diversion", "Detention", "Recharge", "Downstream", "Lake Protection"];

/** Display-only schematic for the before/after visual. Coordinates are unitless. */
export interface SimNode { id: string; x: number; y: number; kind: "existing" | "proposed" | "lake" }
export interface SimLink { from: string; to: string; weight: number }
export const SIM_NODES: SimNode[] = [
  { id: "J3", x: 120, y: 90, kind: "existing" },
  { id: "L2", x: 360, y: 110, kind: "lake" },
  { id: "O1", x: 560, y: 210, kind: "existing" },
  { id: "J5", x: 170, y: 190, kind: "proposed" },
  { id: "D01", x: 280, y: 250, kind: "proposed" },
  { id: "R01", x: 410, y: 280, kind: "proposed" },
];
export function simLinks(view: SimView): SimLink[] {
  if (view === "baseline") return [{ from: "J3", to: "L2", weight: 3 }, { from: "L2", to: "O1", weight: 2.6 }];
  return [
    { from: "J3", to: "L2", weight: 1.4 }, { from: "L2", to: "O1", weight: 1.3 },
    { from: "J3", to: "J5", weight: 1.6 }, { from: "J5", to: "D01", weight: 1.5 }, { from: "D01", to: "R01", weight: 1.3 }, { from: "R01", to: "O1", weight: 1.1 },
  ];
}
export function utilization(id: string, view: SimView): number | undefined {
  const c = CAPACITY.find((r) => r.id === id);
  return c ? c[view] : undefined;
}
export function utilTone(v: number): Tone { return v >= 85 ? "risk" : v >= 72 ? "warn" : "ok"; }

/** Flood-risk zones: shrink and soften in the proposed view (illustrative). */
export function riskZones(view: SimView) {
  return view === "baseline"
    ? [{ x: 470, y: 150, rx: 120, ry: 60, level: "high" }, { x: 470, y: 150, rx: 55, ry: 28, level: "critical" }, { x: 130, y: 100, rx: 60, ry: 36, level: "moderate" }]
    : [{ x: 490, y: 160, rx: 70, ry: 34, level: "moderate" }, { x: 130, y: 100, rx: 34, ry: 20, level: "low" }];
}
