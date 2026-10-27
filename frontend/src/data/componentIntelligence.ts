/** Canonical AEGIS component/edge model — ONE deterministic source of truth.
 *  Prefer live P1/P2/P3 values from CanonicalResponse when present (via resolveComponentProfile).
 */

import type { Candidate, CanonicalResponse, RiskFinding, Sensor } from "./types";

export interface ComponentSensorIntel {
  sensor_id: string;
  sensor_type: string;
  status: string;
  confidence: number | null;
  observed_value: number | null;
  unit: string | null;
}

export interface ComponentIntel {
  component_id: string;
  name: string;
  component_type: string;
  status: string;
  elevation_m: number | null;
  storage_capacity_m3: number | null;
  observed_storage_m3: number | null;
  available_storage_m3: number | null;
  flow_capacity_m3_s: number | null;
  observed_flow_m3_s: number | null;
  water_depth_m: number | null;
  water_depth_threshold_m: number | null;
  recharge_eligibility: string | null;
  discharge_capacity_m3_s: number | null;
  inflow_sources: string[];
  downstream_components: string[];
  health_status: string;
  sensor: ComponentSensorIntel | null;
  sensor_status: string | null;
  sensor_confidence: number | null;
  relevant_threshold: { variable: string; observed: number; limit: number; unit?: string } | null;
  identified_constraint: string | null;
  current_problem: string | null;
  problem_severity: string | null;
  downstream_sensitivity: string;
  engineering_significance: string;
  candidate_id: string | null;
  feasibility: "feasible" | "infeasible" | "not_evaluated" | "ineligible" | null;
  constraint_checks: { description: string; status: string }[];
}

export interface EdgeIntel {
  edge_id: string;
  from: string;
  to: string;
  type: string;
  nominal_capacity_m3_s: number;
  observed_loading_m3_s: number;
  status: string;
  downstream_relationship: string;
  candidate_capacity_constraint_m3_s?: number;
  attention?: string | null;
}

export const COMPONENT_INTELLIGENCE: Record<string, ComponentIntel> = {
  C1: {
    component_id: "C1", name: "Collection Inlet C1", component_type: "collection_inlet", status: "Nominal",
    elevation_m: 822.4, storage_capacity_m3: null, observed_storage_m3: null, available_storage_m3: null,
    flow_capacity_m3_s: 0.45, observed_flow_m3_s: 0.18, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: null, discharge_capacity_m3_s: null,
    inflow_sources: ["catchment_west"], downstream_components: ["J3"], health_status: "nominal",
    sensor: { sensor_id: "FL-C1", sensor_type: "inflow_rate", status: "fresh", confidence: 0.91, observed_value: 0.18, unit: "m³/s" },
    sensor_status: "fresh", sensor_confidence: 0.91,
    relevant_threshold: { variable: "inflow_m3_s", observed: 0.18, limit: 0.45, unit: "m³/s" },
    identified_constraint: null, current_problem: null, problem_severity: null,
    downstream_sensitivity: "moderate",
    engineering_significance: "Western catchment inlet feeding J3; primary contributor to junction loading.",
    candidate_id: null, feasibility: null, constraint_checks: [],
  },
  C2: {
    component_id: "C2", name: "Collection Inlet C2", component_type: "collection_inlet", status: "Nominal",
    elevation_m: 821.8, storage_capacity_m3: null, observed_storage_m3: null, available_storage_m3: null,
    flow_capacity_m3_s: 0.40, observed_flow_m3_s: 0.16, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: null, discharge_capacity_m3_s: null,
    inflow_sources: ["catchment_east"], downstream_components: ["J3"], health_status: "nominal",
    sensor: { sensor_id: "FL-C2", sensor_type: "inflow_rate", status: "fresh", confidence: 0.89, observed_value: 0.16, unit: "m³/s" },
    sensor_status: "fresh", sensor_confidence: 0.89,
    relevant_threshold: { variable: "inflow_m3_s", observed: 0.16, limit: 0.40, unit: "m³/s" },
    identified_constraint: null, current_problem: null, problem_severity: null,
    downstream_sensitivity: "moderate",
    engineering_significance: "Eastern catchment inlet feeding J3; combines with C1 at the controlling junction.",
    candidate_id: null, feasibility: null, constraint_checks: [],
  },
  J3: {
    component_id: "J3", name: "Junction J3", component_type: "junction", status: "Attention",
    elevation_m: 820.1, storage_capacity_m3: null, observed_storage_m3: null, available_storage_m3: null,
    flow_capacity_m3_s: 0.55, observed_flow_m3_s: 0.34, water_depth_m: 0.60, water_depth_threshold_m: 0.80,
    recharge_eligibility: null, discharge_capacity_m3_s: null,
    inflow_sources: ["C1", "C2"], downstream_components: ["L1", "R1", "L2"], health_status: "attention",
    sensor: { sensor_id: "WL-J3", sensor_type: "water_depth", status: "fresh", confidence: 0.94, observed_value: 0.60, unit: "m" },
    sensor_status: "fresh", sensor_confidence: 0.94,
    relevant_threshold: { variable: "water_depth_m", observed: 0.60, limit: 0.80, unit: "m" },
    identified_constraint: "J3 water depth strictly below 0.80 m",
    current_problem: "Elevated depth at J3", problem_severity: "moderate",
    downstream_sensitivity: "high",
    engineering_significance: "Controlling junction. Depth governs diversion eligibility toward L1/R1/L2; elevated depth concentrates surcharge risk toward the upstream catchment.",
    candidate_id: null, feasibility: null,
    constraint_checks: [{ description: "J3 water depth strictly below 0.80 m", status: "pass" }],
  },
  L1: {
    component_id: "L1", name: "Storage L1", component_type: "storage", status: "Constrained",
    elevation_m: 818.6, storage_capacity_m3: 250, observed_storage_m3: 100, available_storage_m3: 100,
    flow_capacity_m3_s: 0.30, observed_flow_m3_s: 0.12, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: null, discharge_capacity_m3_s: null,
    inflow_sources: ["J3"], downstream_components: ["J4"], health_status: "constrained",
    sensor: { sensor_id: "ST-L1", sensor_type: "storage_level", status: "fresh", confidence: 0.88, observed_value: 100, unit: "m³" },
    sensor_status: "fresh", sensor_confidence: 0.88,
    relevant_threshold: { variable: "available_storage_m3", observed: 100, limit: 200, unit: "m³" },
    identified_constraint: "Available storage ≥ diverted volume",
    current_problem: "Limited storage at L1", problem_severity: "low",
    downstream_sensitivity: "high",
    engineering_significance: "Limited storage branch. Cannot absorb the standard 200 m³ diversion; routes residual load toward J4 when selected.",
    candidate_id: "C-L1", feasibility: "infeasible",
    constraint_checks: [
      { description: "J3 water depth strictly below 0.80 m", status: "pass" },
      { description: "Available storage ≥ diverted volume", status: "fail" },
    ],
  },
  R1: {
    component_id: "R1", name: "Recharge R1", component_type: "recharge", status: "Ineligible",
    elevation_m: 818.2, storage_capacity_m3: null, observed_storage_m3: null, available_storage_m3: null,
    flow_capacity_m3_s: 0.10, observed_flow_m3_s: 0.02, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: "ineligible", discharge_capacity_m3_s: null,
    inflow_sources: ["J3"], downstream_components: [], health_status: "ineligible",
    sensor: { sensor_id: "RC-R1", sensor_type: "recharge_rate", status: "fresh", confidence: 0.82, observed_value: 0.02, unit: "m³/s" },
    sensor_status: "fresh", sensor_confidence: 0.82,
    relevant_threshold: null,
    identified_constraint: "Recharge eligibility: ineligible (terminating branch)",
    current_problem: null, problem_severity: null,
    downstream_sensitivity: "low",
    engineering_significance: "Terminating recharge branch. Not a preferred diversion route and has no connection onward to J4.",
    candidate_id: "C-R1", feasibility: "ineligible",
    constraint_checks: [
      { description: "J3 water depth strictly below 0.80 m", status: "pass" },
      { description: "Recharge eligibility", status: "fail" },
    ],
  },
  L2: {
    component_id: "L2", name: "Storage L2", component_type: "storage", status: "Preferred candidate · observation stale",
    elevation_m: 817.9, storage_capacity_m3: 1200, observed_storage_m3: 800, available_storage_m3: 800,
    flow_capacity_m3_s: 0.50, observed_flow_m3_s: 0.22, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: null, discharge_capacity_m3_s: null,
    inflow_sources: ["J3"], downstream_components: ["J4"], health_status: "preferred_candidate",
    sensor: { sensor_id: "ST-L2", sensor_type: "storage_level", status: "stale", confidence: 0.55, observed_value: 800, unit: "m³" },
    sensor_status: "stale", sensor_confidence: 0.55,
    relevant_threshold: { variable: "candidate_capacity_constraint_m3_s", observed: 0.333, limit: 0.5, unit: "m³/s" },
    identified_constraint: "MVP candidate flow ≤ 0.5 m³/s; observation freshness reduced",
    current_problem: null, problem_severity: null,
    downstream_sensitivity: "high",
    engineering_significance: "Primary feasible storage candidate under standard diversion. Larger available storage (800 m³) with a candidate capacity constraint of 0.5 m³/s; stale observation reduces confidence in L2-related recommendations.",
    candidate_id: "C-L2", feasibility: "feasible",
    constraint_checks: [
      { description: "J3 water depth strictly below 0.80 m", status: "pass" },
      { description: "Available storage ≥ diverted volume", status: "pass" },
      { description: "Candidate capacity constraint ≤ 0.5 m³/s", status: "pass" },
    ],
  },
  J4: {
    component_id: "J4", name: "Downstream Junction J4", component_type: "downstream_junction", status: "Nominal",
    elevation_m: 816.5, storage_capacity_m3: null, observed_storage_m3: null, available_storage_m3: null,
    flow_capacity_m3_s: 0.60, observed_flow_m3_s: 0.28, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: null, discharge_capacity_m3_s: null,
    inflow_sources: ["L1", "L2"], downstream_components: ["O1"], health_status: "nominal",
    sensor: { sensor_id: "FL-J4", sensor_type: "combined_flow", status: "fresh", confidence: 0.87, observed_value: 0.28, unit: "m³/s" },
    sensor_status: "fresh", sensor_confidence: 0.87,
    relevant_threshold: { variable: "combined_flow_m3_s", observed: 0.28, limit: 0.60, unit: "m³/s" },
    identified_constraint: "Downstream collector before outlet",
    current_problem: null, problem_severity: null,
    downstream_sensitivity: "critical",
    engineering_significance: "Downstream collector combining L1/L2 discharges before O1. Sensitive to additional hydraulic transfer from storage branches.",
    candidate_id: null, feasibility: null, constraint_checks: [],
  },
  O1: {
    component_id: "O1", name: "Outlet O1", component_type: "outlet", status: "Outlet constraint",
    elevation_m: 815.0, storage_capacity_m3: null, observed_storage_m3: null, available_storage_m3: null,
    flow_capacity_m3_s: 0.70, observed_flow_m3_s: 0.28, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: null, discharge_capacity_m3_s: 0.70,
    inflow_sources: ["J4"], downstream_components: [], health_status: "constraint",
    sensor: { sensor_id: "DS-O1", sensor_type: "discharge", status: "fresh", confidence: 0.90, observed_value: 0.28, unit: "m³/s" },
    sensor_status: "fresh", sensor_confidence: 0.90,
    relevant_threshold: { variable: "discharge_m3_s", observed: 0.28, limit: 0.70, unit: "m³/s" },
    identified_constraint: "Outlet / receiving water boundary — protect from peak transfer",
    current_problem: null, problem_severity: null,
    downstream_sensitivity: "critical",
    engineering_significance: "Network outlet to the receiving water body. Interventions should avoid increasing direct peak hydraulic load at O1.",
    candidate_id: null, feasibility: null, constraint_checks: [],
  },
};

export const EDGE_INTELLIGENCE: Record<string, EdgeIntel> = {
  "E-C1-J3": { edge_id: "E-C1-J3", from: "C1", to: "J3", type: "collector", nominal_capacity_m3_s: 0.45, observed_loading_m3_s: 0.18, status: "nominal", downstream_relationship: "inlet_to_control_junction" },
  "E-C2-J3": { edge_id: "E-C2-J3", from: "C2", to: "J3", type: "collector", nominal_capacity_m3_s: 0.40, observed_loading_m3_s: 0.16, status: "nominal", downstream_relationship: "inlet_to_control_junction" },
  "E-J3-L1": { edge_id: "E-J3-L1", from: "J3", to: "L1", type: "diversion", nominal_capacity_m3_s: 0.30, observed_loading_m3_s: 0.12, status: "capacity_limited_branch", downstream_relationship: "control_junction_to_limited_storage", attention: "Feeds constrained L1 storage" },
  "E-J3-R1": { edge_id: "E-J3-R1", from: "J3", to: "R1", type: "recharge_branch", nominal_capacity_m3_s: 0.10, observed_loading_m3_s: 0.02, status: "terminating_recharge", downstream_relationship: "control_junction_to_ineligible_recharge", attention: "Terminates at ineligible recharge" },
  "E-J3-L2": { edge_id: "E-J3-L2", from: "J3", to: "L2", type: "diversion", nominal_capacity_m3_s: 0.50, observed_loading_m3_s: 0.22, status: "preferred_candidate_route", downstream_relationship: "control_junction_to_primary_storage", candidate_capacity_constraint_m3_s: 0.5 },
  "E-L1-J4": { edge_id: "E-L1-J4", from: "L1", to: "J4", type: "conveyance", nominal_capacity_m3_s: 0.30, observed_loading_m3_s: 0.10, status: "nominal", downstream_relationship: "limited_storage_to_downstream_junction" },
  "E-L2-J4": { edge_id: "E-L2-J4", from: "L2", to: "J4", type: "conveyance", nominal_capacity_m3_s: 0.50, observed_loading_m3_s: 0.20, status: "nominal", downstream_relationship: "primary_storage_to_downstream_junction" },
  "E-J4-O1": { edge_id: "E-J4-O1", from: "J4", to: "O1", type: "outlet_approach", nominal_capacity_m3_s: 0.70, observed_loading_m3_s: 0.28, status: "outlet_approach", downstream_relationship: "downstream_junction_to_outlet", attention: "Protect O1 / receiving water from peak transfer" },
};

export const CANONICAL_COMPONENT_IDS = ["C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"] as const;
export const CANONICAL_EDGE_IDS = ["E-C1-J3", "E-C2-J3", "E-J3-L1", "E-J3-R1", "E-J3-L2", "E-L1-J4", "E-L2-J4", "E-J4-O1"] as const;

export function getComponentIntel(id: string): ComponentIntel | undefined {
  return COMPONENT_INTELLIGENCE[id];
}

export function relatedEdges(id: string): EdgeIntel[] {
  return Object.values(EDGE_INTELLIGENCE).filter((e) => e.from === id || e.to === id);
}

export interface ResolvedComponentProfile {
  component_id: string;
  name: string;
  component_type: string;
  status: string;
  operational: { label: string; value: string; unit?: string }[];
  sensors: { id: string; summary: string; detail: string }[];
  risks: { title: string; severity: string; detail: string }[];
  connections: { id: string; from: string; to: string; summary?: string }[];
  upstream: string[];
  downstream: string[];
  intervention: {
    candidate_id: string;
    feasibility: string;
    available_storage_m3: number | null;
    constraints: { description: string; status: string }[];
  } | null;
  engineering_significance: string;
  intel: ComponentIntel;
  related_edges: EdgeIntel[];
  neighbor_intel: { upstream: ComponentIntel[]; downstream: ComponentIntel[] };
}

function preferNumber(live: number | null | undefined, fallback: number | null): number | null {
  return live == null ? fallback : live;
}

function feasibilityLabel(candidate: Candidate | undefined, intel: ComponentIntel): string {
  if (candidate) {
    if (candidate.feasible === true) return "Feasible";
    if (candidate.feasible === false) return candidate.eligible === false ? "Ineligible" : "Infeasible";
    return "Not Evaluated";
  }
  if (intel.feasibility === "feasible") return "Feasible";
  if (intel.feasibility === "infeasible") return "Infeasible";
  if (intel.feasibility === "ineligible") return "Ineligible";
  if (intel.feasibility === "not_evaluated") return "Not Evaluated";
  return "—";
}

/** Merge canonical component model with authoritative assessment fields for one node. */
export function resolveComponentProfile(data: CanonicalResponse, componentId: string): ResolvedComponentProfile | null {
  const intel = getComponentIntel(componentId);
  const node = data.network.nodes.find((n) => n.id === componentId);
  if (!intel && !node) return null;
  const base = intel ?? {
    component_id: componentId,
    name: node?.label ?? componentId,
    component_type: node?.type ?? "unknown",
    status: "Unknown",
    elevation_m: null, storage_capacity_m3: null, observed_storage_m3: null, available_storage_m3: null,
    flow_capacity_m3_s: null, observed_flow_m3_s: null, water_depth_m: null, water_depth_threshold_m: null,
    recharge_eligibility: null, discharge_capacity_m3_s: null,
    inflow_sources: [], downstream_components: [], health_status: "unknown",
    sensor: null, sensor_status: null, sensor_confidence: null, relevant_threshold: null,
    identified_constraint: null, current_problem: null, problem_severity: null,
    downstream_sensitivity: "unknown", engineering_significance: "",
    candidate_id: node?.candidate_id ?? null, feasibility: null, constraint_checks: [],
  };

  const liveSensors: Sensor[] = data.sensors.filter((s) => s.node_id === componentId || (node?.sensor_ids ?? []).includes(s.id));
  const liveRisks: RiskFinding[] = data.risks.filter((r) => r.target_id === componentId);
  const candidate = data.candidates.find((c) => c.node_id === componentId || c.id === (node?.candidate_id ?? base.candidate_id ?? ""));
  const edges = data.network.edges.filter((e) => e.from === componentId || e.to === componentId);
  const upstream = edges.filter((e) => e.to === componentId).map((e) => e.from);
  const downstream = edges.filter((e) => e.from === componentId).map((e) => e.to);
  const related = relatedEdges(componentId);

  const wl = liveSensors.find((s) => s.variable === "water_depth");
  const waterDepth = preferNumber(wl?.effective_value ?? null, base.water_depth_m);
  const availableStorage = preferNumber(
    (node?.attributes["available_storage_m3"] as number | undefined) ?? candidate?.available_storage_m3 ?? null,
    base.available_storage_m3 ?? base.observed_storage_m3,
  );

  const operational: ResolvedComponentProfile["operational"] = [];
  if (base.component_type === "collection_inlet") {
    operational.push({ label: "Flow Capacity", value: String(base.flow_capacity_m3_s ?? "—"), unit: base.flow_capacity_m3_s != null ? "m³/s" : undefined });
    operational.push({ label: "Observed Flow", value: String(base.observed_flow_m3_s ?? "—"), unit: base.observed_flow_m3_s != null ? "m³/s" : undefined });
  } else if (base.component_type === "junction") {
    operational.push({ label: "Water Depth", value: waterDepth == null ? "—" : String(waterDepth), unit: waterDepth != null ? "m" : undefined });
    operational.push({ label: "Depth Threshold", value: String(base.water_depth_threshold_m ?? 0.8), unit: "m" });
    operational.push({ label: "Observed Flow", value: String(base.observed_flow_m3_s ?? "—"), unit: base.observed_flow_m3_s != null ? "m³/s" : undefined });
  } else if (base.component_type === "storage") {
    operational.push({ label: "Storage Capacity", value: String(base.storage_capacity_m3 ?? "—"), unit: base.storage_capacity_m3 != null ? "m³" : undefined });
    operational.push({ label: "Available Storage", value: availableStorage == null ? "—" : String(availableStorage), unit: availableStorage != null ? "m³" : undefined });
    if (base.relevant_threshold?.variable === "available_storage_m3") {
      operational.push({ label: "Diversion Threshold", value: String(base.relevant_threshold.limit), unit: "m³" });
    }
    if (base.relevant_threshold?.variable === "candidate_capacity_constraint_m3_s") {
      operational.push({ label: "Candidate Flow Constraint", value: String(base.relevant_threshold.limit), unit: "m³/s" });
    }
    operational.push({ label: "Observed Flow", value: String(base.observed_flow_m3_s ?? "—"), unit: base.observed_flow_m3_s != null ? "m³/s" : undefined });
  } else if (base.component_type === "recharge") {
    operational.push({ label: "Recharge Eligibility", value: String((node?.attributes["recharge_eligibility"] as string | undefined) ?? base.recharge_eligibility ?? "—") });
    operational.push({ label: "Observed Recharge Flow", value: String(base.observed_flow_m3_s ?? "—"), unit: base.observed_flow_m3_s != null ? "m³/s" : undefined });
    operational.push({ label: "Branch Capacity", value: String(base.flow_capacity_m3_s ?? "—"), unit: base.flow_capacity_m3_s != null ? "m³/s" : undefined });
  } else if (base.component_type === "downstream_junction") {
    operational.push({ label: "Combined Flow Capacity", value: String(base.flow_capacity_m3_s ?? "—"), unit: base.flow_capacity_m3_s != null ? "m³/s" : undefined });
    operational.push({ label: "Observed Combined Flow", value: String(base.observed_flow_m3_s ?? "—"), unit: base.observed_flow_m3_s != null ? "m³/s" : undefined });
  } else if (base.component_type === "outlet") {
    operational.push({ label: "Discharge Capacity", value: String(base.discharge_capacity_m3_s ?? base.flow_capacity_m3_s ?? "—"), unit: "m³/s" });
    operational.push({ label: "Observed Discharge", value: String(base.observed_flow_m3_s ?? "—"), unit: base.observed_flow_m3_s != null ? "m³/s" : undefined });
  }
  if (base.elevation_m != null) operational.push({ label: "Elevation", value: String(base.elevation_m), unit: "m" });

  const sensors: ResolvedComponentProfile["sensors"] = [];
  if (liveSensors.length) {
    for (const s of liveSensors) {
      sensors.push({
        id: s.id,
        summary: `${s.variable}: ${s.effective_value == null ? "—" : `${s.effective_value}${s.unit ? ` ${s.unit}` : ""}`}`,
        detail: `Status: ${s.status} · Confidence: ${s.confidence ?? "—"}`,
      });
    }
  } else if (base.sensor) {
    sensors.push({
      id: base.sensor.sensor_id,
      summary: `${base.sensor.sensor_type}: ${base.sensor.observed_value == null ? "—" : `${base.sensor.observed_value}${base.sensor.unit ? ` ${base.sensor.unit}` : ""}`}`,
      detail: `Status: ${base.sensor.status} · Confidence: ${base.sensor.confidence ?? "—"}`,
    });
  }

  const risks: ResolvedComponentProfile["risks"] = liveRisks.length
    ? liveRisks.map((r) => ({ title: r.title, severity: r.severity, detail: r.potential_impact }))
    : base.current_problem
      ? [{ title: base.current_problem, severity: base.problem_severity ?? "low", detail: base.engineering_significance }]
      : [];

  const connections = (edges.length ? edges : related.map((e) => ({ id: e.edge_id, from: e.from, to: e.to }))).map((e) => {
    const edgeIntel = EDGE_INTELLIGENCE[e.id];
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      summary: edgeIntel ? `${edgeIntel.type} · ${edgeIntel.observed_loading_m3_s} / ${edgeIntel.nominal_capacity_m3_s} m³/s` : undefined,
    };
  });

  let intervention: ResolvedComponentProfile["intervention"] = null;
  if (candidate || base.candidate_id) {
    intervention = {
      candidate_id: candidate?.id ?? base.candidate_id!,
      feasibility: feasibilityLabel(candidate, base),
      available_storage_m3: candidate?.available_storage_m3 ?? availableStorage,
      constraints: candidate
        ? candidate.constraints.map((c) => ({ description: c.description, status: c.status }))
        : base.constraint_checks,
    };
  }

  const status = liveSensors[0]?.status
    ?? (candidate ? feasibilityLabel(candidate, base) : base.status);

  return {
    component_id: componentId,
    name: base.name,
    component_type: base.component_type,
    status,
    operational,
    sensors,
    risks,
    connections,
    upstream: upstream.length ? upstream : base.inflow_sources.filter((id) => CANONICAL_COMPONENT_IDS.includes(id as typeof CANONICAL_COMPONENT_IDS[number])),
    downstream: downstream.length ? downstream : [...base.downstream_components],
    intervention,
    engineering_significance: base.engineering_significance,
    intel: base,
    related_edges: related,
    neighbor_intel: {
      upstream: (upstream.length ? upstream : base.inflow_sources).map((id) => COMPONENT_INTELLIGENCE[id]).filter(Boolean) as ComponentIntel[],
      downstream: (downstream.length ? downstream : base.downstream_components).map((id) => COMPONENT_INTELLIGENCE[id]).filter(Boolean) as ComponentIntel[],
    },
  };
}

export function resolveEdgeProfile(edgeId: string): EdgeIntel | undefined {
  return EDGE_INTELLIGENCE[edgeId];
}
