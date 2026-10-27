/** Deterministic synthetic component/edge intelligence — mirrors backend dataset.
 *  Same values every request; reuses canonical demo figures (L1 100/200 m³, J3 0.60/0.80 m).
 */

export interface ComponentIntel {
  component_id: string;
  component_type: string;
  elevation_m: number | null;
  storage_capacity_m3: number | null;
  observed_storage_m3: number | null;
  flow_capacity_m3_s: number | null;
  observed_flow_m3_s: number | null;
  inflow_sources: string[];
  downstream_components: string[];
  health_status: string;
  sensor_status: string | null;
  sensor_confidence: number | null;
  relevant_threshold: { variable: string; observed: number; limit: number } | null;
  identified_constraint: string | null;
  downstream_sensitivity: string;
  engineering_significance: string;
}

export interface EdgeIntel {
  edge_id: string;
  from: string;
  to: string;
  nominal_capacity_m3_s: number;
  observed_loading_m3_s: number;
  status: string;
  downstream_relationship: string;
  candidate_capacity_constraint_m3_s?: number;
}

export const COMPONENT_INTELLIGENCE: Record<string, ComponentIntel> = {
  C1: {
    component_id: "C1", component_type: "collection_inlet", elevation_m: 822.4,
    storage_capacity_m3: null, observed_storage_m3: null, flow_capacity_m3_s: 0.45, observed_flow_m3_s: 0.18,
    inflow_sources: ["catchment_west"], downstream_components: ["J3"], health_status: "nominal",
    sensor_status: null, sensor_confidence: null, relevant_threshold: null, identified_constraint: null,
    downstream_sensitivity: "moderate",
    engineering_significance: "Western catchment inlet feeding J3; primary contributor to junction loading.",
  },
  C2: {
    component_id: "C2", component_type: "collection_inlet", elevation_m: 821.8,
    storage_capacity_m3: null, observed_storage_m3: null, flow_capacity_m3_s: 0.40, observed_flow_m3_s: 0.16,
    inflow_sources: ["catchment_east"], downstream_components: ["J3"], health_status: "nominal",
    sensor_status: null, sensor_confidence: null, relevant_threshold: null, identified_constraint: null,
    downstream_sensitivity: "moderate",
    engineering_significance: "Eastern catchment inlet feeding J3; combines with C1 at the controlling junction.",
  },
  J3: {
    component_id: "J3", component_type: "junction", elevation_m: 820.1,
    storage_capacity_m3: null, observed_storage_m3: null, flow_capacity_m3_s: 0.55, observed_flow_m3_s: 0.34,
    inflow_sources: ["C1", "C2"], downstream_components: ["L1", "R1", "L2"], health_status: "attention",
    sensor_status: "fresh", sensor_confidence: 0.94,
    relevant_threshold: { variable: "water_depth_m", observed: 0.60, limit: 0.80 },
    identified_constraint: "depth < 0.80 m (hard rule at J3)",
    downstream_sensitivity: "high",
    engineering_significance: "Controlling junction. Depth governs diversion eligibility toward L1/R1/L2; elevated depth concentrates surcharge risk toward the upstream catchment.",
  },
  L1: {
    component_id: "L1", component_type: "storage", elevation_m: 818.6,
    storage_capacity_m3: 250, observed_storage_m3: 100, flow_capacity_m3_s: 0.30, observed_flow_m3_s: 0.12,
    inflow_sources: ["J3"], downstream_components: ["J4"], health_status: "constrained",
    sensor_status: null, sensor_confidence: null,
    relevant_threshold: { variable: "available_storage_m3", observed: 100, limit: 200 },
    identified_constraint: "Available storage ≥ diverted volume (100 m³ < 200 m³)",
    downstream_sensitivity: "high",
    engineering_significance: "Limited storage branch. Cannot absorb the standard 200 m³ diversion; routes residual load toward J4 when selected.",
  },
  R1: {
    component_id: "R1", component_type: "recharge", elevation_m: 818.2,
    storage_capacity_m3: null, observed_storage_m3: null, flow_capacity_m3_s: 0.10, observed_flow_m3_s: 0.02,
    inflow_sources: ["J3"], downstream_components: [], health_status: "ineligible",
    sensor_status: null, sensor_confidence: null, relevant_threshold: null,
    identified_constraint: "Recharge eligibility: ineligible (terminating branch)",
    downstream_sensitivity: "low",
    engineering_significance: "Terminating recharge branch. Not a preferred diversion route and has no connection onward to J4.",
  },
  L2: {
    component_id: "L2", component_type: "storage", elevation_m: 817.9,
    storage_capacity_m3: 1200, observed_storage_m3: 800, flow_capacity_m3_s: 0.50, observed_flow_m3_s: 0.22,
    inflow_sources: ["J3"], downstream_components: ["J4"], health_status: "preferred_candidate",
    sensor_status: "stale", sensor_confidence: 0.55,
    relevant_threshold: { variable: "candidate_capacity_constraint_m3_s", observed: 0.333, limit: 0.5 },
    identified_constraint: "MVP candidate flow ≤ 0.5 m³/s; observation freshness reduced",
    downstream_sensitivity: "high",
    engineering_significance: "Primary feasible storage candidate under standard diversion. Larger available storage (800 m³) with a candidate capacity constraint of 0.5 m³/s; stale observation reduces confidence in L2-related recommendations.",
  },
  J4: {
    component_id: "J4", component_type: "downstream_junction", elevation_m: 816.5,
    storage_capacity_m3: null, observed_storage_m3: null, flow_capacity_m3_s: 0.60, observed_flow_m3_s: 0.28,
    inflow_sources: ["L1", "L2"], downstream_components: ["O1"], health_status: "nominal",
    sensor_status: null, sensor_confidence: null, relevant_threshold: null,
    identified_constraint: "Downstream collector before outlet",
    downstream_sensitivity: "critical",
    engineering_significance: "Downstream collector combining L1/L2 discharges before O1. Sensitive to additional hydraulic transfer from storage branches.",
  },
  O1: {
    component_id: "O1", component_type: "outlet", elevation_m: 815.0,
    storage_capacity_m3: null, observed_storage_m3: null, flow_capacity_m3_s: 0.70, observed_flow_m3_s: 0.28,
    inflow_sources: ["J4"], downstream_components: [], health_status: "constraint",
    sensor_status: null, sensor_confidence: null, relevant_threshold: null,
    identified_constraint: "Outlet / receiving water boundary — protect from peak transfer",
    downstream_sensitivity: "critical",
    engineering_significance: "Network outlet to the receiving water body. Interventions should avoid increasing direct peak hydraulic load at O1.",
  },
};

export const EDGE_INTELLIGENCE: Record<string, EdgeIntel> = {
  "E-C1-J3": { edge_id: "E-C1-J3", from: "C1", to: "J3", nominal_capacity_m3_s: 0.45, observed_loading_m3_s: 0.18, status: "nominal", downstream_relationship: "inlet_to_control_junction" },
  "E-C2-J3": { edge_id: "E-C2-J3", from: "C2", to: "J3", nominal_capacity_m3_s: 0.40, observed_loading_m3_s: 0.16, status: "nominal", downstream_relationship: "inlet_to_control_junction" },
  "E-J3-L1": { edge_id: "E-J3-L1", from: "J3", to: "L1", nominal_capacity_m3_s: 0.30, observed_loading_m3_s: 0.12, status: "capacity_limited_branch", downstream_relationship: "control_junction_to_limited_storage" },
  "E-J3-R1": { edge_id: "E-J3-R1", from: "J3", to: "R1", nominal_capacity_m3_s: 0.10, observed_loading_m3_s: 0.02, status: "terminating_recharge", downstream_relationship: "control_junction_to_ineligible_recharge" },
  "E-J3-L2": { edge_id: "E-J3-L2", from: "J3", to: "L2", nominal_capacity_m3_s: 0.50, observed_loading_m3_s: 0.22, status: "preferred_candidate_route", downstream_relationship: "control_junction_to_primary_storage", candidate_capacity_constraint_m3_s: 0.5 },
  "E-L1-J4": { edge_id: "E-L1-J4", from: "L1", to: "J4", nominal_capacity_m3_s: 0.30, observed_loading_m3_s: 0.10, status: "nominal", downstream_relationship: "limited_storage_to_downstream_junction" },
  "E-L2-J4": { edge_id: "E-L2-J4", from: "L2", to: "J4", nominal_capacity_m3_s: 0.50, observed_loading_m3_s: 0.20, status: "nominal", downstream_relationship: "primary_storage_to_downstream_junction" },
  "E-J4-O1": { edge_id: "E-J4-O1", from: "J4", to: "O1", nominal_capacity_m3_s: 0.70, observed_loading_m3_s: 0.28, status: "outlet_approach", downstream_relationship: "downstream_junction_to_outlet" },
};

export const CANONICAL_COMPONENT_IDS = ["C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"] as const;

export function getComponentIntel(id: string): ComponentIntel | undefined {
  return COMPONENT_INTELLIGENCE[id];
}

export function relatedEdges(id: string): EdgeIntel[] {
  return Object.values(EDGE_INTELLIGENCE).filter((e) => e.from === id || e.to === id);
}
