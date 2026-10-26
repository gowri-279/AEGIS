/** Build Step 4/5 assessment + candidate demo data. Illustrative only — replace with AEGIS service responses. */
export type Tone = "high" | "medium" | "info" | "good";

export const ASSESSMENT_STAGES = ["Terrain Analysis", "Network Analysis", "Reliability Analysis", "Downstream Analysis", "Constraint Analysis"];

export const TERRAIN_INTEL = {
  rows: [
    ["Elevation", "812.4 – 846.7 m"], ["Average Slope", "3.8%"], ["Natural Drainage Paths", "6"],
    ["Identified Low Points", "4"], ["Catchment Area", "2.8 km²"], ["Drainage Tendency", "North-East → South-East"],
  ] as [string, string][],
  observation: "Terrain naturally concentrates runoff toward the lower eastern corridor, creating a potential high-flow collection zone.",
};

export const NETWORK_INTEL = {
  connected: [["Network Status", "Connected"], ["Relevant Nodes", "J3, J4, L2, O1"], ["Downstream Path", "J3 → L2 → O1"], ["Current Capacity Utilization", "87%"], ["Known Bottleneck", "J3 → L2"]] as [string, string][],
  independent: [["Network Status", "Independent"], ["Existing Network Interaction", "None"], ["Potential Outfall", "O1"]] as [string, string][],
  redesign: [["Selected Region", "J3 → L2 → O1"], ["Current Condition", "High downstream utilization"], ["Bottleneck", "J3 → L2"], ["Downstream Constraint", "O1 approaching capacity"]] as [string, string][],
};

export interface Observation { id: string; label: string; status: "Fresh" | "Stale"; reliability: number; confidence: number }
export const RELIABILITY = {
  observationConfidence: 89,
  observations: [
    { id: "J3", label: "J3 Water Level", status: "Fresh", reliability: 94, confidence: 91 },
    { id: "J4", label: "J4 Flow", status: "Fresh", reliability: 88, confidence: 86 },
    { id: "L2", label: "L2 Level", status: "Stale", reliability: 61, confidence: 54 },
  ] as Observation[],
  warning: "L2 observations are stale. Design recommendations involving L2 should account for reduced observation confidence.",
};

export const DOWNSTREAM = {
  rows: [["Primary Downstream Node", "O1"], ["Current Utilization", "78%"], ["Remaining Capacity", "22%"], ["Protected Water Body", "Lake L2"], ["Environmental Sensitivity", "High"]] as [string, string][],
  observation: "Increasing upstream conveyance without considering O1 may transfer additional hydraulic load downstream.",
};

export const RISKS: { tone: Tone; level: string; title: string; detail: string }[] = [
  { tone: "high", level: "High", title: "Downstream Bottleneck", detail: "J3 → L2 is operating near capacity." },
  { tone: "medium", level: "Medium", title: "Stale Observation", detail: "L2 sensor data has reduced confidence." },
  { tone: "medium", level: "Medium", title: "Flood Concentration", detail: "Terrain directs runoff toward the eastern low-point corridor." },
  { tone: "high", level: "High", title: "Environmental Sensitivity", detail: "Downstream lake protection is a critical constraint." },
];

export const CONSIDERATIONS = [
  "Increase conveyance near the identified upstream bottleneck.",
  "Avoid transferring excessive load to O1.",
  "Protect the downstream lake.",
  "Prefer reuse of functioning infrastructure where possible.",
  "Account for reduced confidence in L2 observations.",
  "Consider the eastern low-point corridor as a primary runoff collection zone.",
];

export const HEALTH = {
  overall: 72,
  rows: [["Terrain", "Good", "good"], ["Network Capacity", "Attention", "medium"], ["Sensor Reliability", "Good", "good"], ["Downstream Resilience", "Attention", "medium"], ["Environmental Risk", "High Priority", "high"]] as [string, string, Tone][],
};

export const CONFIDENCE = {
  overall: 84,
  rows: [["Terrain Model", "High"], ["Network Topology", "High"], ["Sensor Observations", "Moderate"], ["Downstream Conditions", "Moderate"]] as [string, string][],
  note: "Confidence is reduced by stale observations near L2.",
};

export const BOB_SEQUENCE = ["Reading Terrain", "Mapping Drainage", "Inspecting Network", "Checking Downstream Capacity", "Evaluating Reliability", "Generating Candidates"];

export const DESIGN_TOOLS = ["Junction", "Pipe / Drain", "Channel", "Detention", "Recharge", "Outfall"];

export const CANDIDATES = [
  { id: "A", name: "Design A — Balanced", status: "Recommended", description: "Candidate generated from terrain, network and downstream constraints." },
];

/** Display-only proposed route for the workspace placeholder (viewBox units, not engineering geometry). */
export const PROPOSED_PATH = "M330 210 C 380 300, 440 330, 520 340 S 650 350, 700 320";
