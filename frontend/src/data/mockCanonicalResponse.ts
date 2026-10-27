// MOCK canonical responses mirroring the AEGIS backend contract.
// All derived values (feasibility, ranking, recommendation, reliability) are
// fixture outputs authored to match the backend — never computed in the UI.
import type { CanonicalResponse, Sensor, Candidate, Network } from "./types";
import { COMPONENT_INTELLIGENCE } from "./componentIntelligence";

const network: Network = {
  network_id: "blr-synthetic-01",
  nodes: [
    { id: "C1", type: "collection_inlet", label: "Collection inlet C1", sensor_ids: ["FL-C1"], attributes: {} },
    { id: "C2", type: "collection_inlet", label: "Collection inlet C2", sensor_ids: ["FL-C2"], attributes: {} },
    { id: "J3", type: "junction", label: "Junction J3", sensor_ids: ["WL-J3"], attributes: { hard_threshold_depth_m: 0.8, threshold_rule: "depth < 0.80 m" } },
    { id: "L1", type: "storage", label: "Storage L1", sensor_ids: ["ST-L1"], candidate_id: "C-L1", attributes: { available_storage_m3: 100 } },
    { id: "R1", type: "recharge", label: "Recharge R1", sensor_ids: ["RC-R1"], candidate_id: "C-R1", attributes: { recharge_eligibility: "ineligible" } },
    { id: "L2", type: "storage", label: "Storage L2", sensor_ids: ["ST-L2"], candidate_id: "C-L2", attributes: { available_storage_m3: 800, candidate_capacity_constraint_m3s: 0.5 } },
    { id: "J4", type: "downstream_junction", label: "Downstream junction J4", sensor_ids: ["FL-J4"], attributes: {} },
    { id: "O1", type: "outlet", label: "Outlet O1", sensor_ids: ["DS-O1"], attributes: {} },
  ],
  edges: [
    { id: "E-C1-J3", from: "C1", to: "J3" },
    { id: "E-C2-J3", from: "C2", to: "J3" },
    { id: "E-J3-L1", from: "J3", to: "L1" },
    { id: "E-J3-R1", from: "J3", to: "R1" },
    { id: "E-J3-L2", from: "J3", to: "L2" },
    { id: "E-L1-J4", from: "L1", to: "J4" },
    { id: "E-L2-J4", from: "L2", to: "J4" },
    { id: "E-J4-O1", from: "J4", to: "O1" },
  ],
};

const TS = "2026-10-23T20:20:00Z";

const sensorFresh: Sensor = {
  id: "WL-J3", node_id: "J3", variable: "water_depth", unit: "m", critical: true,
  raw_value: 0.6, effective_value: 0.6, status: "fresh", confidence: 0.94, timestamp: TS,
};

/** Deterministic IoT board for all 8 canonical components (from component intelligence). */
function canonicalSensors(overrides: Partial<Record<string, Partial<Sensor>>> = {}): Sensor[] {
  return Object.values(COMPONENT_INTELLIGENCE).flatMap((intel) => {
    const s = intel.sensor;
    if (!s) return [];
    const base: Sensor = {
      id: s.sensor_id,
      node_id: intel.component_id,
      variable: s.sensor_type,
      unit: s.unit ?? "",
      critical: intel.component_id === "J3",
      raw_value: s.observed_value,
      effective_value: s.observed_value,
      status: (s.status as Sensor["status"]) || "fresh",
      confidence: s.confidence,
      timestamp: TS,
    };
    return [{ ...base, ...(overrides[s.sensor_id] ?? {}) }];
  });
}

const LIMITS = [
  "Illustrative network data — not surveyed Bengaluru infrastructure.",
  "Downstream capacity beyond candidate nodes is not modeled.",
  "Simulation results are model outputs for MVP evaluation.",
];

const j3Constraint = (s: Sensor) => ({
  constraint_id: "HC-J3-DEPTH",
  description: "J3 water depth strictly below 0.80 m",
  status: s.effective_value == null ? ("not_evaluated" as const) : ("pass" as const),
  observed: s.effective_value, limit: 0.8, unit: "m",
  note: s.effective_value == null ? "Critical sensor WL-J3 unusable" : undefined,
});

function candidatesStandard(s: Sensor): Candidate[] {
  return [
    { id: "C-L1", node_id: "L1", kind: "storage", route_edge_ids: ["E-J3-L1"], available_storage_m3: 100, eligible: true, feasible: false, rank: null,
      constraints: [j3Constraint(s), { constraint_id: "HC-STORAGE", description: "Available storage ≥ diverted volume", status: "fail", observed: 200, limit: 100, unit: "m³" }] },
    { id: "C-R1", node_id: "R1", kind: "recharge", route_edge_ids: ["E-J3-R1"], available_storage_m3: null, eligible: false, feasible: false, rank: null,
      constraints: [{ constraint_id: "HC-ELIGIBILITY", description: "Recharge eligibility", status: "fail", observed: null, limit: null, unit: "", note: "Fixture marks R1 ineligible" }] },
    { id: "C-L2", node_id: "L2", kind: "storage", route_edge_ids: ["E-J3-L2"], available_storage_m3: 800, eligible: true, feasible: true, rank: 1,
      constraints: [j3Constraint(s),
        { constraint_id: "HC-STORAGE", description: "Available storage ≥ diverted volume", status: "pass", observed: 200, limit: 800, unit: "m³" },
        { constraint_id: "HC-CAPACITY", description: "Candidate-level modeled capacity (MVP constraint)", status: "pass", observed: 0.333333, limit: 0.5, unit: "m³/s", note: "Not a surveyed physical pipe capacity" }] },
  ];
}

const standardSim = { scenario_id: "storage_and_recharge_demo", diverted_volume_m3: 200, duration_s: 600, proposed_flow_m3s: 0.333333, model_note: "Model output for MVP evaluation. Not CFD." };

export const fixtureStandard: CanonicalResponse = {
  fixture_id: "standard", fixture_label: "Standard · 200 m³ / 600 s",
  data_provenance: "synthetic_illustrative", generated_at: TS, network,
  sensors: canonicalSensors(),
  risks: [
    { id: "RK-J3-LOAD", category: "hydraulic_overload", target_id: "J3", title: "Elevated depth at J3", observed_value: 0.6, threshold: 0.8, unit: "m", severity: "moderate", confidence: 0.94,
      evidence: ["WL-J3 reads 0.60 m (fresh)", "75% of hard threshold"], potential_impact: "Surcharge risk toward upstream catchment if inflow rises." },
    { id: "RK-L1-CAP", category: "bottleneck", target_id: "L1", title: "Limited storage at L1", observed_value: 100, threshold: 200, unit: "m³", severity: "low", confidence: 0.88,
      evidence: ["Available storage 100 m³ below scenario volume"], potential_impact: "L1 cannot absorb the standard diversion." },
  ],
  simulation: standardSim,
  candidates: candidatesStandard(sensorFresh),
  recommendation: {
    recommendation_status: "recommended", selected_candidate_id: "C-L2", recommendation_scope: "limited_mvp_scope", safety_qualified: false,
    rationale: ["C-L2 passes storage (200 ≤ 800 m³).", "Proposed flow 0.333 m³/s within MVP candidate constraint 0.5 m³/s.", "J3 hard constraint evaluated with a fresh critical sensor."],
    uncertainty: ["Downstream capacity from L2 not fully modeled."],
    data_limitations: LIMITS,
  },
};

const sensorDegraded: Sensor = { ...sensorFresh, status: "degraded", confidence: 0.61, issue: "Intermittent signal; reading usable with reduced confidence." };
export const fixtureDegraded: CanonicalResponse = {
  ...fixtureStandard, fixture_id: "degraded", fixture_label: "WL-J3 degraded (usable)",
  sensors: canonicalSensors({ "WL-J3": sensorDegraded }),
  risks: [...fixtureStandard.risks, { id: "RK-WL-J3-DQ", category: "data_reliability", target_id: "WL-J3", title: "Critical sensor degraded", observed_value: null, threshold: null, severity: "moderate", confidence: 0.61, evidence: ["Packet loss on WL-J3"], potential_impact: "Recommendation confidence reduced." }],
  candidates: candidatesStandard(sensorDegraded),
  recommendation: { ...fixtureStandard.recommendation, uncertainty: [...fixtureStandard.recommendation.uncertainty, "WL-J3 degraded — evaluation continues with reduced confidence."] },
};

const sensorStale: Sensor = { ...sensorFresh, status: "stale", effective_value: null, confidence: null, timestamp: "2026-10-23T18:02:00Z", issue: "No update for 138 minutes. Effective value unavailable." };
export const fixtureCriticalStale: CanonicalResponse = {
  ...fixtureStandard, fixture_id: "critical_stale", fixture_label: "WL-J3 stale (critical failure)",
  sensors: canonicalSensors({ "WL-J3": sensorStale }),
  risks: [{ id: "RK-WL-J3-STALE", category: "data_reliability", target_id: "WL-J3", title: "Critical sensor unavailable", observed_value: null, threshold: 0.8, unit: "m", severity: "critical", confidence: null, evidence: ["Last reading 138 min old", "J3 hard constraint not evaluated"], potential_impact: "No defensible recommendation possible." }],
  candidates: candidatesStandard(sensorStale).map((c) => ({ ...c, feasible: null, rank: null })),
  recommendation: {
    recommendation_status: "abstained", selected_candidate_id: null, recommendation_scope: "limited_mvp_scope", safety_qualified: false,
    rationale: ["Critical sensor WL-J3 is stale; J3 hard constraint could not be evaluated."],
    uncertainty: ["Current J3 depth unknown."], data_limitations: LIMITS,
  },
};

const [cL1, cR1, cL2] = candidatesStandard(sensorFresh) as [Candidate, Candidate, Candidate];
export const fixtureStress: CanonicalResponse = {
  ...fixtureStandard, fixture_id: "stress", fixture_label: "Stress · 900 m³ / 600 s",
  simulation: { ...standardSim, scenario_id: "stress_demo", diverted_volume_m3: 900, proposed_flow_m3s: 1.5 },
  candidates: [
    { ...cL1, constraints: [j3Constraint(sensorFresh), { constraint_id: "HC-STORAGE", description: "Available storage ≥ diverted volume", status: "fail", observed: 900, limit: 100, unit: "m³" }] },
    cR1,
    { ...cL2, feasible: false, rank: null, constraints: [j3Constraint(sensorFresh),
      { constraint_id: "HC-STORAGE", description: "Available storage ≥ diverted volume", status: "fail", observed: 900, limit: 800, unit: "m³" },
      { constraint_id: "HC-CAPACITY", description: "Candidate-level modeled capacity (MVP constraint)", status: "fail", observed: 1.5, limit: 0.5, unit: "m³/s", note: "Not a surveyed physical pipe capacity" }] },
  ],
  recommendation: {
    recommendation_status: "no_feasible_candidate", selected_candidate_id: null, recommendation_scope: "limited_mvp_scope", safety_qualified: false,
    rationale: ["No candidate satisfies all hard constraints for 900 m³ over 600 s."],
    uncertainty: ["Alternative interventions outside the modeled set not considered."], data_limitations: LIMITS,
  },
};

export const fixtures = {
  standard: fixtureStandard,
  degraded: fixtureDegraded,
  critical_stale: fixtureCriticalStale,
  stress: fixtureStress,
} as const;
export type FixtureId = keyof typeof fixtures;
