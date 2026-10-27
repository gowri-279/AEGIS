/** Deterministic hydraulic what-if engine — mirrors backend/simulation/hydraulic_whatif.py.
 *  Uses canonical componentIntelligence capacities/loadings. Never mutates baseline.
 */
import { COMPONENT_INTELLIGENCE, EDGE_INTELLIGENCE } from "./componentIntelligence";
import type { Severity } from "./types";

export type HydraulicState = "green" | "amber" | "red" | "blinking_red" | "grey";

export const HYDRAULIC_CONDITIONS = {
  normal_rainfall: { id: "normal_rainfall", label: "Normal Rainfall", load_multiplier: 1.0, depth_multiplier: 1.0, detail: "Baseline loading from canonical observed flows", fixture: "standard" as const },
  heavy_storm: { id: "heavy_storm", label: "Heavy Storm", load_multiplier: 1.75, depth_multiplier: 1.15, detail: "Elevated rainfall / hydraulic loading", fixture: "stress" as const },
  flooding: { id: "flooding", label: "Flooding", load_multiplier: 2.25, depth_multiplier: 1.25, detail: "High sustained loading / downstream stress", fixture: "stress" as const },
  extreme_rainfall: { id: "extreme_rainfall", label: "Extreme Rainfall", load_multiplier: 2.9, depth_multiplier: 1.35, detail: "Severe hydraulic loading", fixture: "stress" as const },
  cloudburst: { id: "cloudburst", label: "Cloudburst / Peak Event", load_multiplier: 3.6, depth_multiplier: 1.45, detail: "Short-duration peak inflow / maximum stress", fixture: "stress" as const },
} as const;

export type ConditionId = keyof typeof HYDRAULIC_CONDITIONS;

export const CANONICAL_EDGE_IDS = Object.keys(EDGE_INTELLIGENCE);
export const CANONICAL_COMPONENT_IDS = Object.keys(COMPONENT_INTELLIGENCE);

export type HydraulicAction =
  | "inspect_component"
  | "stress_edge"
  | "stress_component"
  | "reroute_flow"
  | "disable_edge"
  | "disable_component"
  | "change_flow_split"
  | "run_condition"
  | "reset";

export const ALLOWED_HYDRAULIC_ACTIONS: HydraulicAction[] = [
  "inspect_component", "stress_edge", "stress_component", "reroute_flow",
  "disable_edge", "disable_component", "change_flow_split", "run_condition", "reset",
];

export function loadingState(ratio: number): HydraulicState {
  if (ratio < 0.7) return "green";
  if (ratio < 0.9) return "amber";
  if (ratio <= 1.0) return "red";
  return "blinking_red";
}

export function severityForState(state: HydraulicState): Severity {
  if (state === "green") return "low";
  if (state === "amber") return "moderate";
  if (state === "red") return "high";
  return "critical";
}

export function resolveConditionId(raw?: string | null): ConditionId {
  if (!raw) return "normal_rainfall";
  const key = raw.trim().toLowerCase().replaceAll(" ", "_").replaceAll("/", "_").replaceAll("-", "_");
  if (key in HYDRAULIC_CONDITIONS) return key as ConditionId;
  if (raw === "standard" || key.includes("normal")) return "normal_rainfall";
  if (key.includes("cloud") || key.includes("peak")) return "cloudburst";
  if (key.includes("extreme")) return "extreme_rainfall";
  if (key.includes("flood")) return "flooding";
  if (key.includes("heavy") || key.includes("storm") || raw === "heavy-rain" || raw === "heavy-storm") return "heavy_storm";
  return "normal_rainfall";
}

function branchEdgeForNode(nodeId: string): string | null {
  const map: Record<string, string> = { L1: "E-J3-L1", L2: "E-J3-L2", R1: "E-J3-R1" };
  return map[nodeId.toUpperCase()] ?? null;
}

export interface HydraulicEdgeResult {
  edge_id: string;
  from: string;
  to: string;
  flow_m3_s: number;
  capacity_m3_s: number;
  loading_ratio: number;
  state: HydraulicState;
  state_sequence: HydraulicState[];
  failed: boolean;
  disabled: boolean;
}

export interface HydraulicComponentResult {
  component_id: string;
  observed: number;
  limit: number | null;
  loading_ratio: number;
  state: HydraulicState;
  state_sequence: HydraulicState[];
  sensor_confidence: number | null;
  sensor_status: string | null;
  sensor_id: string | null;
  disabled: boolean;
}

export interface HydraulicResult {
  ok: boolean;
  condition_id: ConditionId;
  condition_label: string;
  action: HydraulicAction;
  parameters: Record<string, unknown>;
  fixture: "standard" | "stress";
  overall_network_status: HydraulicState;
  max_loading_ratio: number;
  critical_bottleneck: string | null;
  storage_stress: string[];
  affected_edges: string[];
  affected_components: string[];
  failed_edges: string[];
  failed_components: string[];
  downstream_impact: string;
  sensor_considerations: string[];
  edges: HydraulicEdgeResult[];
  components: HydraulicComponentResult[];
  sensors: Array<{
    id: string; node_id: string; variable: string; unit: string | null;
    status: string | null; confidence: number | null; raw_value: number | null; effective_value: number | null; critical: boolean;
  }>;
  visual: {
    scenarioId: string;
    edgeStages: Record<string, number>;
    nodeStates: Record<string, { severity: Severity; hydraulicState: HydraulicState; storageLevel?: "raised" | "settled" }>;
    edgeStates: Record<string, { hydraulicState: HydraulicState; loading_ratio: number; severity: Severity }>;
  };
  baseline_mutated: false;
  what_if: boolean;
  inspect: (typeof COMPONENT_INTELLIGENCE)[string] | null;
  summary: string;
}

function buildFlows(
  conditionId: ConditionId,
  disabledEdges: Set<string>,
  disabledComponents: Set<string>,
  flowSplit: Record<string, number> | null,
  reroute: { from: string; to: string; percentage: number } | null,
  stressEdgeId: string | null,
  stressComponentId: string | null,
): Record<string, number> {
  const mult = HYDRAULIC_CONDITIONS[conditionId].load_multiplier;
  const flows: Record<string, number> = {};
  for (const eid of CANONICAL_EDGE_IDS) {
    flows[eid] = EDGE_INTELLIGENCE[eid]!.observed_loading_m3_s * mult;
  }
  if (stressEdgeId && flows[stressEdgeId] != null) flows[stressEdgeId]! *= 1.15;
  if (stressComponentId) {
    for (const [eid, edge] of Object.entries(EDGE_INTELLIGENCE)) {
      if (edge.from === stressComponentId || edge.to === stressComponentId) flows[eid]! *= 1.12;
    }
  }

  const j3Out = ["E-J3-L1", "E-J3-R1", "E-J3-L2"];
  const activeJ3 = j3Out.filter((e) => !disabledEdges.has(e));
  const totalIn = flows["E-C1-J3"]! + flows["E-C2-J3"]!;

  if (flowSplit) {
    let assigned = 0;
    for (const [eid, pct] of Object.entries(flowSplit)) {
      if (activeJ3.includes(eid)) {
        flows[eid] = totalIn * (pct / 100);
        assigned += pct;
      }
    }
    const remainder = Math.max(0, 100 - assigned);
    const others = activeJ3.filter((e) => !(e in flowSplit));
    if (others.length && remainder > 0) {
      const share = remainder / others.length;
      for (const eid of others) flows[eid] = totalIn * (share / 100);
    } else if (others.length) {
      for (const eid of others) flows[eid] = 0;
    }
  } else {
    const baseSum = activeJ3.reduce((s, e) => s + EDGE_INTELLIGENCE[e]!.observed_loading_m3_s, 0) || 1;
    for (const eid of activeJ3) {
      flows[eid] = totalIn * (EDGE_INTELLIGENCE[eid]!.observed_loading_m3_s / baseSum);
    }
  }

  if (reroute) {
    const src = branchEdgeForNode(reroute.from);
    const dst = branchEdgeForNode(reroute.to);
    if (src && dst && flows[src] != null && flows[dst] != null && !disabledEdges.has(src)) {
      const moved = flows[src]! * (reroute.percentage / 100);
      flows[src]! -= moved;
      if (!disabledEdges.has(dst)) flows[dst]! += moved;
    }
  }

  for (const eid of [...Object.keys(flows)]) {
    const edge = EDGE_INTELLIGENCE[eid]!;
    if (disabledEdges.has(eid) || disabledComponents.has(edge.from) || disabledComponents.has(edge.to)) {
      const spilled = flows[eid]!;
      flows[eid] = 0;
      if (edge.from === "J3") {
        const alts = j3Out.filter((e) => e !== eid && !disabledEdges.has(e) && !disabledComponents.has(EDGE_INTELLIGENCE[e]!.to));
        if (alts.length && spilled > 0) {
          const each = spilled / alts.length;
          for (const alt of alts) flows[alt]! += each;
        }
      }
    }
  }

  flows["E-L1-J4"] = (!disabledEdges.has("E-L1-J4") && !disabledComponents.has("L1")) ? flows["E-J3-L1"]! * 0.85 : 0;
  flows["E-L2-J4"] = (!disabledEdges.has("E-L2-J4") && !disabledComponents.has("L2")) ? flows["E-J3-L2"]! * 0.90 : 0;
  flows["E-J4-O1"] = (disabledEdges.has("E-J4-O1") || disabledComponents.has("J4") || disabledComponents.has("O1"))
    ? 0
    : flows["E-L1-J4"]! + flows["E-L2-J4"]!;

  return flows;
}

function componentLoading(
  componentId: string,
  flows: Record<string, number>,
  conditionId: ConditionId,
  disabled: Set<string>,
): { observed: number; limit: number; state: HydraulicState } {
  if (disabled.has(componentId)) return { observed: 0, limit: 0, state: "grey" };
  const c = COMPONENT_INTELLIGENCE[componentId]!;
  const depthMult = HYDRAULIC_CONDITIONS[conditionId].depth_multiplier;

  if (componentId === "J3") {
    const depth = (c.water_depth_m ?? 0) * depthMult;
    const limit = c.water_depth_threshold_m ?? 0.8;
    return { observed: depth, limit, state: loadingState(depth / limit) };
  }
  if (componentId === "L1" || componentId === "L2") {
    const inbound = flows[componentId === "L1" ? "E-J3-L1" : "E-J3-L2"] ?? 0;
    const volume = inbound * 600;
    const limit = c.available_storage_m3 || c.storage_capacity_m3 || 1;
    return { observed: volume, limit, state: loadingState(volume / limit) };
  }
  if (componentId === "O1") {
    const flow = flows["E-J4-O1"] ?? 0;
    const cap = c.discharge_capacity_m3_s ?? c.flow_capacity_m3_s ?? 0.7;
    return { observed: flow, limit: cap, state: loadingState(flow / cap) };
  }
  if (componentId === "R1") {
    const flow = flows["E-J3-R1"] ?? 0;
    const cap = c.flow_capacity_m3_s ?? 0.1;
    return { observed: flow, limit: cap, state: loadingState(flow / cap) };
  }
  if (componentId === "J4") {
    const flow = (flows["E-L1-J4"] ?? 0) + (flows["E-L2-J4"] ?? 0);
    const cap = c.flow_capacity_m3_s ?? 0.6;
    return { observed: flow, limit: cap, state: loadingState(flow / cap) };
  }
  const edgeId = componentId === "C1" ? "E-C1-J3" : "E-C2-J3";
  const flow = flows[edgeId] ?? c.observed_flow_m3_s ?? 0;
  const cap = c.flow_capacity_m3_s ?? 1;
  return { observed: flow, limit: cap, state: loadingState(flow / cap) };
}

function emptyHydraulicResult(conditionId: ConditionId = "normal_rainfall", action: HydraulicAction = "run_condition"): HydraulicResult {
  const cond = HYDRAULIC_CONDITIONS[conditionId];
  return {
    ok: true,
    condition_id: conditionId,
    condition_label: cond.label,
    action,
    parameters: {},
    fixture: cond.fixture,
    overall_network_status: "green",
    max_loading_ratio: 0,
    critical_bottleneck: null,
    storage_stress: [],
    affected_edges: [],
    affected_components: [],
    failed_edges: [],
    failed_components: [],
    downstream_impact: "Simulation unavailable; canonical baseline preserved.",
    sensor_considerations: [],
    edges: [],
    components: [],
    sensors: [],
    visual: { scenarioId: `HYDRAULIC_${conditionId.toUpperCase()}`, edgeStages: {}, nodeStates: {}, edgeStates: {} },
    baseline_mutated: false,
    what_if: false,
    inspect: null,
    summary: "Deterministic simulation could not complete; canonical network unchanged.",
  };
}

export function runHydraulicSimulation(opts: {
  condition?: string | null;
  action?: HydraulicAction | string;
  parameters?: Record<string, unknown>;
  applyFailureTransition?: boolean;
}): HydraulicResult {
  try {
  const params = { ...(opts.parameters ?? {}) };
  let conditionId = resolveConditionId(opts.condition ?? (params['condition'] as string | undefined));
  const rawAction = String(opts.action ?? "run_condition").toLowerCase() as HydraulicAction;
  const action = ALLOWED_HYDRAULIC_ACTIONS.includes(rawAction) ? rawAction : "run_condition";
  const applyFailure = opts.applyFailureTransition !== false;

  const disabledEdges = new Set<string>();
  const disabledComponents = new Set<string>();
  let flowSplit: Record<string, number> | null = null;
  let reroute: { from: string; to: string; percentage: number } | null = null;
  let stressEdgeId: string | null = null;
  let stressComponentId: string | null = null;
  let inspectId: string | null = null;

  if (action === "inspect_component") {
    inspectId = String(params['component_id'] ?? params['target'] ?? "").toUpperCase();
  } else if (action === "stress_edge") {
    stressEdgeId = String(params['edge_id'] ?? params['target'] ?? "").toUpperCase();
    if (params['condition']) conditionId = resolveConditionId(String(params['condition']));
  } else if (action === "stress_component") {
    stressComponentId = String(params['component_id'] ?? params['target'] ?? "").toUpperCase();
    if (params['condition']) conditionId = resolveConditionId(String(params['condition']));
  } else if (action === "reroute_flow") {
    reroute = { from: String(params['from'] ?? "").toUpperCase(), to: String(params['to'] ?? "").toUpperCase(), percentage: Number(params['percentage'] ?? 100) };
  } else if (action === "disable_edge") {
    const eid = String(params['edge_id'] ?? params['target'] ?? "").toUpperCase();
    if (eid) disabledEdges.add(eid);
  } else if (action === "disable_component") {
    const cid = String(params['component_id'] ?? params['target'] ?? "").toUpperCase();
    if (cid) {
      disabledComponents.add(cid);
      for (const [eid, edge] of Object.entries(EDGE_INTELLIGENCE)) {
        if (edge.from === cid || edge.to === cid) disabledEdges.add(eid);
      }
    }
  } else if (action === "change_flow_split") {
    if (params['percentage'] != null && (params['to'] || params['edge_id'])) {
      const target = String(params['edge_id'] ?? branchEdgeForNode(String(params['to'] ?? "")) ?? "").toUpperCase();
      if (target) flowSplit = { [target]: Number(params['percentage']) };
    } else {
      const split: Record<string, number> = {};
      for (const [k, v] of Object.entries(params)) {
        if (k.toUpperCase().startsWith("E-")) split[k.toUpperCase()] = Number(v);
      }
      flowSplit = Object.keys(split).length ? split : null;
    }
  } else if (action === "reset") {
    conditionId = "normal_rainfall";
  }

  const flows = buildFlows(conditionId, disabledEdges, disabledComponents, flowSplit, reroute, stressEdgeId, stressComponentId);

  const edges: HydraulicEdgeResult[] = [];
  let maxLoading = 0;
  let bottleneck: string | null = null;
  const failedEdges: string[] = [];

  for (const eid of CANONICAL_EDGE_IDS) {
    const edge = EDGE_INTELLIGENCE[eid]!;
    const capacity = edge.candidate_capacity_constraint_m3_s ?? edge.nominal_capacity_m3_s;
    const flow = flows[eid] ?? 0;
    let state: HydraulicState;
    let ratio = 0;
    const sequence: HydraulicState[] = ["green"];
    let failed = false;
    if (disabledEdges.has(eid) || disabledComponents.has(edge.from) || disabledComponents.has(edge.to)) {
      state = "grey";
      sequence.length = 0;
      sequence.push("grey");
    } else {
      ratio = capacity ? flow / capacity : 0;
      state = loadingState(ratio);
      if (ratio >= 0.7) sequence.push("amber");
      if (ratio >= 0.9) sequence.push("red");
      if (ratio > 1) {
        sequence.push("blinking_red");
        if (applyFailure) {
          state = "grey";
          sequence.push("grey");
          failedEdges.push(eid);
          failed = true;
        }
      }
      if (ratio > maxLoading) {
        maxLoading = ratio;
        bottleneck = eid;
      }
    }
    edges.push({
      edge_id: eid, from: edge.from, to: edge.to,
      flow_m3_s: Number(flow.toFixed(6)), capacity_m3_s: capacity,
      loading_ratio: Number(ratio.toFixed(6)), state, state_sequence: sequence,
      failed, disabled: disabledEdges.has(eid),
    });
  }

  const byId = Object.fromEntries(edges.map((e) => [e.edge_id, e]));
  const failedSet = new Set([...failedEdges, ...disabledEdges]);
  for (const eid of failedSet) {
    const edge = EDGE_INTELLIGENCE[eid];
    if (!edge) continue;
    for (const [downId, down] of Object.entries(EDGE_INTELLIGENCE)) {
      if (down.from === edge.to && byId[downId]!.flow_m3_s === 0 && !failedSet.has(downId)) {
        const inbound = Object.entries(EDGE_INTELLIGENCE).filter(([, ed]) => ed.to === edge.to).map(([i]) => i);
        if (inbound.length && inbound.every((i) => failedSet.has(i) || byId[i]!.state === "grey")) {
          byId[downId]!.state = "grey";
          byId[downId]!.state_sequence = [...byId[downId]!.state_sequence, "grey"];
        }
      }
    }
  }

  const components: HydraulicComponentResult[] = [];
  const storageStress: string[] = [];
  const failedComponents: string[] = [];
  for (const cid of CANONICAL_COMPONENT_IDS) {
    const { observed, limit, state: rawState } = componentLoading(cid, flows, conditionId, disabledComponents);
    let state = rawState;
    const ratio = limit ? observed / limit : 0;
    const sequence: HydraulicState[] = state === "grey" ? ["grey"] : ["green"];
    if (state !== "grey") {
      if (ratio >= 0.7) sequence.push("amber");
      if (ratio >= 0.9) sequence.push("red");
      if (ratio > 1) {
        sequence.push("blinking_red");
        if (applyFailure) {
          state = "grey";
          sequence.push("grey");
          failedComponents.push(cid);
        }
      }
    } else {
      failedComponents.push(cid);
    }
    if ((cid === "L1" || cid === "L2") && ratio >= 0.7) storageStress.push(cid);
    const intel = COMPONENT_INTELLIGENCE[cid]!;
    components.push({
      component_id: cid,
      observed: Number(observed.toFixed(6)),
      limit: limit != null ? Number(limit.toFixed(6)) : null,
      loading_ratio: Number(ratio.toFixed(6)),
      state,
      state_sequence: sequence,
      sensor_confidence: intel.sensor_confidence,
      sensor_status: intel.sensor_status,
      sensor_id: intel.sensor?.sensor_id ?? null,
      disabled: disabledComponents.has(cid),
    });
  }

  const sensors = CANONICAL_COMPONENT_IDS.map((cid) => {
    const s = COMPONENT_INTELLIGENCE[cid]?.sensor;
    if (!s) return null;
    return {
      id: s.sensor_id, node_id: cid, variable: s.sensor_type, unit: s.unit,
      status: s.status, confidence: s.confidence, raw_value: s.observed_value,
      effective_value: s.observed_value, critical: cid === "J3",
    };
  }).filter(Boolean) as HydraulicResult["sensors"];

  const unsafeEdges = edges.filter((e) => e.state === "red" || e.state === "blinking_red" || e.state === "grey").map((e) => e.edge_id);
  const unsafeComponents = components.filter((c) => c.state === "red" || c.state === "blinking_red" || c.state === "grey").map((c) => c.component_id);

  let overall: HydraulicState = "green";
  for (const s of ["amber", "red", "blinking_red", "grey"] as HydraulicState[]) {
    if (edges.some((e) => e.state === s) || components.some((c) => c.state === s)) overall = s;
  }

  const edgeStages: Record<string, number> = {};
  for (const e of edges) {
    if (e.state === "grey" && e.flow_m3_s === 0 && e.disabled) continue;
    const edge = EDGE_INTELLIGENCE[e.edge_id]!;
    edgeStages[e.edge_id] = edge.from === "C1" || edge.from === "C2" ? 0 : edge.from === "J3" ? 1 : edge.from === "L1" || edge.from === "L2" ? 2 : 3;
  }

  const nodeStates: HydraulicResult["visual"]["nodeStates"] = {};
  for (const c of components) {
    if (c.state === "green") continue;
    nodeStates[c.component_id] = {
      severity: severityForState(c.state),
      hydraulicState: c.state,
      ...((c.component_id === "L1" || c.component_id === "L2") ? { storageLevel: "raised" as const } : {}),
    };
  }

  const edgeStates: HydraulicResult["visual"]["edgeStates"] = {};
  for (const e of edges) {
    edgeStates[e.edge_id] = {
      hydraulicState: e.state,
      loading_ratio: e.loading_ratio,
      severity: severityForState(e.state),
    };
  }

  const cond = HYDRAULIC_CONDITIONS[conditionId];
  const summaryParts = [
    `Condition ${cond.label}: overall ${overall}.`,
    `Peak edge loading ratio ${maxLoading.toFixed(2)}${bottleneck ? ` at ${bottleneck}.` : "."}`,
  ];
  if (storageStress.length) summaryParts.push(`Storage stress at ${storageStress.join(", ")}.`);
  if (failedEdges.length) summaryParts.push(`Simulated edge failure: ${failedEdges.join(", ")}.`);
  if (failedComponents.length) summaryParts.push(`Simulated component failure: ${failedComponents.join(", ")}.`);

  return {
    ok: true,
    condition_id: conditionId,
    condition_label: cond.label,
    action,
    parameters: params,
    fixture: cond.fixture,
    overall_network_status: overall,
    max_loading_ratio: Number(maxLoading.toFixed(6)),
    critical_bottleneck: bottleneck,
    storage_stress: storageStress,
    affected_edges: unsafeEdges,
    affected_components: unsafeComponents,
    failed_edges: failedEdges,
    failed_components: failedComponents,
    downstream_impact: failedEdges.length || disabledEdges.size
      ? `Simulated unavailable path(s). Grey edges: ${edges.filter((e) => e.state === "grey").map((e) => e.edge_id).join(", ") || "none"}.`
      : "No simulated edge failure; downstream loading follows the selected condition.",
    sensor_considerations: sensors
      .filter((s) => s.confidence != null && (s.confidence < 0.7 || s.status !== "fresh"))
      .map((s) => `${s.id} at ${s.node_id}: confidence ${s.confidence} (${s.status})`),
    edges,
    components,
    sensors,
    visual: {
      scenarioId: `HYDRAULIC_${conditionId.toUpperCase()}`,
      edgeStages,
      nodeStates,
      edgeStates,
    },
    baseline_mutated: false,
    what_if: !(
      (action === "reset" || action === "run_condition" || action === "inspect_component")
      && disabledEdges.size === 0
      && disabledComponents.size === 0
      && !flowSplit
      && !reroute
      && !stressEdgeId
      && !stressComponentId
    ),
    inspect: inspectId && COMPONENT_INTELLIGENCE[inspectId] ? COMPONENT_INTELLIGENCE[inspectId]! : null,
    summary: summaryParts.join(" "),
  };
  } catch (error) {
    console.warn("[aegis] runHydraulicSimulation failed; returning safe baseline", error);
    return emptyHydraulicResult(resolveConditionId(opts.condition), "run_condition");
  }
}

export function explainHydraulicResult(sim: HydraulicResult, intent?: string): string {
  if (!sim) return "Simulation result unavailable.";
  const lines = [
    "### WHAT I UNDERSTAND",
    intent || sim.summary || "",
    "",
    "### SIMULATION",
    `Running \`${sim.action}\` under **${sim.condition_label}** via the deterministic AEGIS hydraulic engine.`,
    "",
    "### RESULT",
    sim.summary,
    `Overall network status: **${sim.overall_network_status}**.`,
    `Maximum loading ratio: **${sim.max_loading_ratio}**${sim.critical_bottleneck ? ` at \`${sim.critical_bottleneck}\`.` : "."}`,
  ];
  if (sim.failed_edges.length) lines.push(`Simulated edge failure (grey): ${sim.failed_edges.join(", ")}.`);
  if (sim.failed_components.length) lines.push(`Simulated component failure (grey): ${sim.failed_components.join(", ")}.`);
  if (sim.storage_stress.length) lines.push(`Storage stress: ${sim.storage_stress.join(", ")}.`);
  if (sim.sensor_considerations.length) lines.push(`Sensor confidence notes: ${sim.sensor_considerations.join("; ")}.`);
  lines.push(
    "",
    "### VISUAL STATE",
    "The network visualization reflects simulation states (green / amber / red / blinking red → grey for simulated failure).",
    "",
    "### ENGINEERING INTERPRETATION",
    sim.downstream_impact,
    "",
    "Baseline canonical network was **not** mutated (`baseline_mutated: false`).",
  );
  return lines.join("\n");
}

/** Deterministic NL → allowlisted action (frontend fallback; backend is authoritative). */
export function parseBobHydraulicAction(message: string): { type: "simulation_request"; action: HydraulicAction; parameters: Record<string, unknown>; explanation: string } | null {
  const q = message.toLowerCase().trim();
  if (!q) return null;
  if (/\b(reset|clear what-?if|restore baseline|undo what-?if)\b/.test(q)) {
    return { type: "simulation_request", action: "reset", parameters: {}, explanation: "Clear what-if modifications and restore the baseline hydraulic state." };
  }
  const inspect = q.match(/\b(what(?:'s| is) happening at|inspect|status of|tell me about)\s+([a-z0-9-]+)/);
  if (inspect) {
    const cid = inspect[2]!.toUpperCase();
    if (COMPONENT_INTELLIGENCE[cid]) return { type: "simulation_request", action: "inspect_component", parameters: { component_id: cid }, explanation: `Inspect component ${cid} using canonical AEGIS intelligence.` };
  }
  const edgeMatch = q.match(/\b(e-[a-z0-9-]+)\b/);
  const edgeToken = edgeMatch ? edgeMatch[1]!.toUpperCase() : null;
  if (edgeToken && EDGE_INTELLIGENCE[edgeToken] && /remove|disable|unavailable|without|block|closed|out of service/.test(q)) {
    return { type: "simulation_request", action: "disable_edge", parameters: { edge_id: edgeToken }, explanation: `What-if: disable edge ${edgeToken} without mutating the canonical network.` };
  }
  for (const cid of CANONICAL_COMPONENT_IDS) {
    if (new RegExp(`\\b${cid.toLowerCase()}\\b`).test(q) && /unavailable|removed|offline|disable|without|stop using|out of service|cannot be used/.test(q)) {
      return { type: "simulation_request", action: "disable_component", parameters: { component_id: cid }, explanation: `What-if: treat ${cid} as unavailable under the current condition.` };
    }
  }
  if (/divert|reroute/.test(q) && /\bl1\b/.test(q) && /\bl2\b/.test(q)) {
    const pm = q.match(/(\d{1,3})\s*%/);
    const pct = pm ? Number(pm[1]) : 100;
    return { type: "simulation_request", action: "reroute_flow", parameters: { from: "L1", to: "L2", percentage: pct }, explanation: `What-if: divert ${pct}% of flow from L1 to L2.` };
  }
  const split = q.match(/(\d{1,3})\s*%\s*(?:of\s+)?(?:j3\s+)?flow\s+(?:goes\s+)?(?:through|via|to)\s+([a-z0-9-]+)/);
  if (split) {
    const pct = Number(split[1]);
    const target = split[2]!.toUpperCase();
    const edgeId = EDGE_INTELLIGENCE[target] ? target : branchEdgeForNode(target);
    if (edgeId) return { type: "simulation_request", action: "change_flow_split", parameters: { edge_id: edgeId, to: EDGE_INTELLIGENCE[edgeId]!.to, percentage: pct }, explanation: `What-if: route ${pct}% of J3 outflow through ${edgeId}.` };
  }
  if (edgeToken && EDGE_INTELLIGENCE[edgeToken] && /handle|stress|can\b|capacity|cope|withstand/.test(q)) {
    const cond = /cloud|peak/.test(q) ? "cloudburst" : /extreme/.test(q) ? "extreme_rainfall" : /heavy|storm/.test(q) ? "heavy_storm" : /flood/.test(q) ? "flooding" : "normal_rainfall";
    return { type: "simulation_request", action: "stress_edge", parameters: { edge_id: edgeToken, condition: cond }, explanation: `Stress edge ${edgeToken} under ${HYDRAULIC_CONDITIONS[cond].label}.` };
  }
  if (/\b(this pipe|the pipe|pipe)\b/.test(q) && /handle|cloudburst|stress|capacity/.test(q)) {
    const cond = /cloud|peak/.test(q) ? "cloudburst" : "extreme_rainfall";
    return { type: "simulation_request", action: "stress_edge", parameters: { edge_id: "E-J3-L2", condition: cond }, explanation: `Stress preferred diversion edge E-J3-L2 under ${HYDRAULIC_CONDITIONS[cond].label}.` };
  }
  for (const cid of CANONICAL_COMPONENT_IDS) {
    if (new RegExp(`\\b${cid.toLowerCase()}\\b`).test(q) && /handle|stress|can\b|capacity|cope|withstand|rainfall/.test(q)) {
      const cond = /cloud|peak/.test(q) ? "cloudburst" : /extreme/.test(q) ? "extreme_rainfall" : /heavy|storm/.test(q) ? "heavy_storm" : /flood/.test(q) ? "flooding" : "normal_rainfall";
      return { type: "simulation_request", action: "stress_component", parameters: { component_id: cid, condition: cond }, explanation: `Stress component ${cid} under ${HYDRAULIC_CONDITIONS[cond].label}.` };
    }
  }
  if (/cloud|peak event/.test(q)) return { type: "simulation_request", action: "run_condition", parameters: { condition: "cloudburst" }, explanation: "Run Cloudburst / Peak Event hydraulic condition." };
  if (/extreme/.test(q) && /rain|storm|simulat|what|happen|condition/.test(q)) return { type: "simulation_request", action: "run_condition", parameters: { condition: "extreme_rainfall" }, explanation: "Run Extreme Rainfall hydraulic condition." };
  if (/flood/.test(q)) return { type: "simulation_request", action: "run_condition", parameters: { condition: "flooding" }, explanation: "Run Flooding hydraulic condition." };
  if (/heavy/.test(q) && /rain|storm/.test(q)) return { type: "simulation_request", action: "run_condition", parameters: { condition: "heavy_storm" }, explanation: "Run Heavy Storm hydraulic condition." };
  if (/normal|standard/.test(q) && /rain|simulat|scenario|condition/.test(q)) return { type: "simulation_request", action: "run_condition", parameters: { condition: "normal_rainfall" }, explanation: "Run Normal Rainfall hydraulic condition." };
  if (/simulat|what[- ]?if|run condition|rainfall condition/.test(q)) return { type: "simulation_request", action: "run_condition", parameters: { condition: "heavy_storm" }, explanation: "Run Heavy Storm as a default allowlisted what-if condition." };
  return null;
}
