// Live AEGIS backend boundary. Signatures stay stable for Monitor.
// Bob helpers remain local mocks; assessment/network use HTTP.
import { fixtures, type FixtureId } from "@/data/mockCanonicalResponse";
import type {
  Candidate,
  CanonicalResponse,
  ConstraintEvaluation,
  ConstraintStatus,
  Network,
  NetworkNode,
  NodeType,
  Recommendation,
  RecommendationStatus,
  RiskCategory,
  RiskFinding,
  Sensor,
  SensorStatus,
  Severity,
} from "@/data/types";
import { mockHealthBobReply, type HealthBobRequest, type HealthBobResponse } from "@/data/healthBob";
import { mockBobScenario, type BobScenarioId } from "@/data/bobInterventions";
import { mockSimBobReply, type SimBobReply } from "@/data/simBob";
import { landingDemoModel } from "@/data/landingDemoNetwork";
import type { BuildDraft } from "@/data/networkSession";
import type { Design } from "@/data/buildWorkspace";
import type { BuildPathKind } from "@/data/buildRequirements";
import { WS_CANDIDATES, type CandidateId } from "@/data/buildWorkspace";
import { PRIMARY_METRICS } from "@/data/buildSimulation";
import { CONFIDENCE, RELIABILITY, RISKS, TERRAIN_INTEL } from "@/data/buildAssessment";

/** Separate local landing model; never reads Monitor fixtures or backend state. */
export function getLandingDemoModel() {
  return landingDemoModel;
}

export interface ScenarioRequest {
  fixture: FixtureId;
  scenarioOptionId?: string;
  diverted_volume_m3?: number;
  duration_s?: number;
}

const API_BASE = (
  (import.meta.env["VITE_AEGIS_API_URL"] as string | undefined) ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const FIXTURE_LABELS: Record<FixtureId, string> = {
  standard: "Standard · 200 m³ / 600 s",
  degraded: "WL-J3 degraded (usable)",
  critical_stale: "WL-J3 stale (critical failure)",
  stress: "Stress · 900 m³ / 600 s",
};

const CANDIDATE_NODE: Record<string, string> = {
  "C-L1": "L1",
  "C-R1": "R1",
  "C-L2": "L2",
};

const CANDIDATE_EDGE: Record<string, string> = {
  "C-L1": "E-J3-L1",
  "C-R1": "E-J3-R1",
  "C-L2": "E-J3-L2",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nodeType(id: string, raw: string): NodeType {
  if (id === "J4") return "downstream_junction";
  const allowed: NodeType[] = [
    "collection_inlet",
    "junction",
    "storage",
    "recharge",
    "downstream_junction",
    "outlet",
  ];
  return (allowed.includes(raw as NodeType) ? raw : "junction") as NodeType;
}

function nodeLabel(id: string, type: NodeType): string {
  const titles: Record<NodeType, string> = {
    collection_inlet: "Collection inlet",
    junction: "Junction",
    storage: "Storage",
    recharge: "Recharge",
    downstream_junction: "Downstream junction",
    outlet: "Outlet",
  };
  return `${titles[type]} ${id}`;
}

function mapNetwork(raw: Record<string, unknown>): Network {
  const nodesIn = (raw["nodes"] as Record<string, unknown>[]) || [];
  const edgesIn = (raw["edges"] as Record<string, unknown>[]) || [];
  const nodes: NetworkNode[] = nodesIn.map((n) => {
    const id = String(n["id"]);
    const type = nodeType(id, String(n["type"] ?? "junction"));
    const attributes: NetworkNode["attributes"] = {};
    if (n["available_storage_m3"] != null) attributes["available_storage_m3"] = n["available_storage_m3"] as number;
    if (n["recharge_eligibility"] != null) attributes["recharge_eligibility"] = n["recharge_eligibility"] as string;
    if (n["elevation_m"] != null) attributes["elevation_m"] = n["elevation_m"] as number;
    if (id === "J3") {
      attributes["hard_threshold_depth_m"] = 0.8;
      attributes["threshold_rule"] = "depth < 0.80 m";
    }
    if (id === "L2") attributes["candidate_capacity_constraint_m3s"] = 0.5;
    const candidate_id = Object.entries(CANDIDATE_NODE).find(([, nodeId]) => nodeId === id)?.[0];
    return {
      id,
      type,
      label: nodeLabel(id, type),
      sensor_ids: id === "J3" ? ["WL-J3"] : [],
      ...(candidate_id ? { candidate_id } : {}),
      attributes,
    };
  });
  return {
    network_id: String(raw["network_id"] ?? "aegis_demo_catchment"),
    nodes,
    edges: edgesIn.map((e) => ({
      id: String(e["id"]),
      from: String(e["from"]),
      to: String(e["to"]),
    })),
  };
}

function mapSensor(raw: Record<string, unknown>): Sensor {
  const id = String(raw["sensor_id"] ?? raw["id"] ?? "unknown");
  const status = String(raw["quality_status"] ?? raw["status"] ?? "missing") as SensorStatus;
  const codes = (raw["issue_codes"] as string[] | undefined) ?? [];
  const sensorType = String(raw["sensor_type"] ?? "water_level");
  const variable =
    sensorType === "water_level" ? "water_depth" : sensorType === "rainfall" ? "rainfall" : sensorType;
  const unit = variable === "water_depth" ? "m" : variable === "flow" ? "m³/s" : "";
  const node_id = id.includes("-") ? id.split("-").slice(1).join("-") : "J3";
  // WL-J3 → J3, RF-J3 → J3, FL-L1 → L1
  const inferredNode = id.startsWith("WL-") || id.startsWith("RF-") || id.startsWith("WQ-")
    ? id.replace(/^(WL|RF|WQ)-/, "")
    : id.startsWith("FL-") || id.startsWith("PR-")
      ? id.replace(/^(FL|PR)-/, "")
      : node_id;
  return {
    id,
    node_id: inferredNode,
    variable,
    unit,
    critical: id === "WL-J3",
    raw_value: (raw["raw_value"] as number | null) ?? null,
    effective_value: (raw["effective_value"] as number | null) ?? null,
    status,
    confidence: (raw["confidence"] as number | null) ?? null,
    timestamp: (raw["timestamp"] as string | null) ?? null,
    ...(codes.length ? { issue: codes.join(", ") } : {}),
  };
}

function mapSeverity(raw: unknown): Severity {
  const s = String(raw ?? "moderate");
  if (s === "medium") return "moderate";
  if (s === "low" || s === "moderate" || s === "high" || s === "critical") return s;
  return "moderate";
}

function mapRiskCategory(raw: unknown): RiskCategory {
  const s = String(raw ?? "infrastructure_anomaly");
  if (s === "hydraulic_overload") return "hydraulic_overload";
  if (s === "water_level_threshold_exceeded") return "hydraulic_overload";
  if (s === "sensor_reliability_warning" || s === "data_reliability") return "data_reliability";
  if (s === "water_quality_threshold_exceeded" || s === "water_quality") return "water_quality";
  if (s === "overflow" || s === "bottleneck" || s === "downstream_propagation" || s === "infrastructure_anomaly") {
    return s;
  }
  return "infrastructure_anomaly";
}

function mapRiskFinding(raw: Record<string, unknown>): RiskFinding {
  const sensorId = raw["sensor_id"] != null ? String(raw["sensor_id"]) : undefined;
  const nodeId = raw["node_id"] != null ? String(raw["node_id"]) : undefined;
  const edgeId = raw["edge_id"] != null ? String(raw["edge_id"]) : undefined;
  const target = nodeId ?? edgeId ?? sensorId ?? "J3";
  return {
    id: String(raw["finding_id"] ?? raw["id"] ?? `RK-${target}`),
    category: mapRiskCategory(raw["risk_type"] ?? raw["category"]),
    target_id: target,
    title: String(raw["title"] ?? humanizeRisk(raw["risk_type"] ?? "Finding")),
    observed_value: (raw["observed_value"] as number | null) ?? null,
    threshold: (raw["threshold"] as number | null) ?? null,
    ...(raw["unit"] != null ? { unit: String(raw["unit"]) } : {}),
    severity: mapSeverity(raw["severity"]),
    confidence: (raw["confidence"] as number | null) ?? null,
    evidence: (raw["evidence"] as string[]) ?? [],
    potential_impact: String(raw["impact"] ?? raw["potential_impact"] ?? ""),
  };
}

function humanizeRisk(value: unknown): string {
  return String(value ?? "Finding").replaceAll("_", " ");
}

/** Prefer live P2 risk_findings; if empty, surface sensor_issues so Health still has live evidence. */
function mapRisks(payload: Record<string, unknown>): RiskFinding[] {
  const assessed = (payload["assessed_state"] as Record<string, unknown> | undefined) ?? {};
  const rawRisks = (payload["risks"] as Record<string, unknown>[] | undefined)
    ?? (assessed["risk_findings"] as Record<string, unknown>[] | undefined)
    ?? [];
  if (rawRisks.length) return rawRisks.map(mapRiskFinding);

  const issues = (assessed["sensor_issues"] as Record<string, unknown>[] | undefined) ?? [];
  return issues.map((issue) => {
    const sensorId = String(issue["sensor_id"] ?? "WL-J3");
    const code = String(issue["issue_code"] ?? "SENSOR_ISSUE");
    const status = String(issue["quality_status"] ?? "stale");
    return {
      id: `RK-${sensorId}-${code}`,
      category: "data_reliability" as const,
      target_id: sensorId,
      title: `Critical sensor ${status}`,
      observed_value: null,
      threshold: 0.8,
      unit: "m",
      severity: (status === "stale" || status === "missing" ? "critical" : "high") as Severity,
      confidence: null,
      evidence: [`${sensorId}: ${code}`, `quality_status=${status}`],
      potential_impact: "Required J3 check cannot be defensibly evaluated.",
    };
  });
}

function mapConstraintStatus(raw: string): ConstraintStatus {
  if (raw === "passed" || raw === "pass") return "pass";
  if (raw === "failed" || raw === "fail") return "fail";
  return "not_evaluated";
}

function mapConstraint(raw: Record<string, unknown>): ConstraintEvaluation {
  const details = (raw["details"] as Record<string, unknown> | undefined) ?? {};
  const observed =
    (details["water_depth_m"] as number | undefined)
    ?? (details["proposed_volume_m3"] as number | undefined)
    ?? (details["flow_m3_s"] as number | undefined)
    ?? null;
  const limit =
    (details["maximum_depth_m"] as number | undefined)
    ?? (details["available_storage_m3"] as number | undefined)
    ?? (details["candidate_limit_m3_s"] as number | undefined)
    ?? (details["capacity_m3_s"] as number | undefined)
    ?? null;
  const name = String(raw["constraint"] ?? "constraint");
  return {
    constraint_id: name.toUpperCase(),
    description: name.replaceAll("_", " "),
    status: mapConstraintStatus(String(raw["status"] ?? "not_evaluated")),
    observed,
    limit,
    unit: "",
    ...((raw["reason_codes"] as string[] | undefined)?.length
      ? { note: ((raw["reason_codes"] as string[]) ?? []).join(", ") }
      : {}),
  };
}

function mapCandidates(
  evaluations: Record<string, unknown>[],
  ranking: string[],
  network: Network,
): Candidate[] {
  const rankIndex = new Map(ranking.map((id, i) => [id, i + 1]));
  return evaluations.map((item) => {
    const id = String(item["candidate_id"]);
    const node_id = CANDIDATE_NODE[id] ?? id;
    const node = network.nodes.find((n) => n.id === node_id);
    const kind = id === "C-R1" ? "recharge" as const : "storage" as const;
    const feasible = item["feasible"] == null ? null : Boolean(item["feasible"]);
    const checks = ((item["checks"] as Record<string, unknown>[]) ?? []).map(mapConstraint);
    return {
      id,
      node_id,
      kind,
      route_edge_ids: CANDIDATE_EDGE[id] ? [CANDIDATE_EDGE[id]] : [],
      available_storage_m3: (node?.attributes["available_storage_m3"] as number | undefined) ?? null,
      eligible: kind === "recharge"
        ? String(node?.attributes["recharge_eligibility"] ?? "ineligible") === "eligible"
        : true,
      feasible,
      constraints: checks,
      rank: rankIndex.get(id) ?? (feasible ? null : null),
    };
  });
}

function mapRecommendation(raw: Record<string, unknown>): Recommendation {
  const status = String(raw["recommendation_status"] ?? "abstained") as RecommendationStatus;
  return {
    recommendation_status: status,
    selected_candidate_id: (raw["selected_candidate_id"] as string | null) ?? null,
    recommendation_scope: String(raw["recommendation_scope"] ?? "limited_mvp_scope"),
    safety_qualified: Boolean(raw["safety_qualified"]),
    rationale: (raw["rationale"] as string[]) ?? [],
    uncertainty: (raw["uncertainty"] as string[]) ?? [],
    data_limitations: (raw["data_limitations"] as string[]) ?? [],
  };
}

function mapCanonical(
  payload: Record<string, unknown>,
  networkRaw: Record<string, unknown> | null,
  scenarioOptionId?: string,
): CanonicalResponse {
  const network = mapNetwork(networkRaw ?? (payload["network"] as Record<string, unknown>));
  const networkState = (payload["network_state"] as Record<string, unknown> | undefined) ?? {};
  const sensorsRaw = (networkState["sensors"] as Record<string, unknown>[] | undefined) ?? [];
  const scenario = (payload["scenario"] as Record<string, unknown> | undefined) ?? {};
  const simulation = (payload["simulation_result"] as Record<string, unknown> | undefined) ?? {};
  const evaluations = (payload["candidate_evaluations"] as Record<string, unknown>[] | undefined) ?? [];
  const ranking = (payload["ranking"] as string[] | undefined) ?? [];
  const fixtureId = String(payload["fixture_id"] ?? "standard") as FixtureId;
  const selected = (payload["recommendation"] as Record<string, unknown> | undefined)?.["selected_candidate_id"] as string | null;
  const candidates = mapCandidates(evaluations, ranking, network);
  if (selected && ranking.length === 0) {
    const hit = candidates.find((c) => c.id === selected);
    if (hit) hit.rank = 1;
  }

  return {
    fixture_id: fixtureId in FIXTURE_LABELS ? fixtureId : "standard",
    fixture_label: FIXTURE_LABELS[fixtureId] ?? FIXTURE_LABELS.standard,
    data_provenance: "synthetic_illustrative",
    generated_at: new Date().toISOString(),
    network,
    sensors: sensorsRaw.map(mapSensor),
    risks: mapRisks(payload),
    simulation: {
      ...(scenarioOptionId ? { scenario_option_id: scenarioOptionId } : {}),
      scenario_id: String(simulation["scenario_id"] ?? scenario["scenario_id"] ?? "storage_and_recharge_demo"),
      diverted_volume_m3: Number(simulation["proposed_volume_m3"] ?? scenario["diverted_volume"] ?? 200),
      duration_s: Number(simulation["duration_seconds"] ?? scenario["duration"] ?? 600),
      proposed_flow_m3s: Number(simulation["proposed_flow_m3_s"] ?? 0),
      model_note: "Model output for MVP evaluation. Not CFD.",
    },
    candidates,
    recommendation: mapRecommendation((payload["recommendation"] as Record<string, unknown>) ?? {}),
  };
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`AEGIS API ${path} failed (${response.status})`);
  }
  return response.json();
}

async function fetchNetwork(): Promise<Record<string, unknown>> {
  return (await fetchJson("/api/v1/network")) as Record<string, unknown>;
}

async function postAssessment(fixture: FixtureId, req?: ScenarioRequest): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { fixture };
  if (req?.diverted_volume_m3 != null) body["diverted_volume"] = req.diverted_volume_m3;
  if (req?.duration_s != null) body["duration"] = req.duration_s;
  return (await fetchJson("/api/v1/assessment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })) as Record<string, unknown>;
}

/** Secondary offline fallback only when the backend is unreachable. */
function fallbackCanonical(fixture: FixtureId, scenarioOptionId?: string): CanonicalResponse {
  console.warn(`[aegis] backend unreachable at ${API_BASE}; using secondary fixture fallback for ${fixture}`);
  const response = fixtures[fixture];
  return scenarioOptionId
    ? { ...response, simulation: { ...response.simulation, scenario_option_id: scenarioOptionId } }
    : response;
}

async function loadCanonical(fixture: FixtureId, req?: ScenarioRequest): Promise<CanonicalResponse> {
  try {
    const [assessment, network] = await Promise.all([
      postAssessment(fixture, req),
      fetchNetwork().catch(() => null),
    ]);
    return mapCanonical(assessment, network, req?.scenarioOptionId);
  } catch (error) {
    console.warn("[aegis] live assessment failed; secondary fixture fallback", error);
    return fallbackCanonical(fixture, req?.scenarioOptionId);
  }
}

export async function getCanonicalResponse(fixture: FixtureId = "standard"): Promise<CanonicalResponse> {
  return loadCanonical(fixture);
}

export async function runScenario(req: ScenarioRequest): Promise<CanonicalResponse> {
  return loadCanonical(req.fixture, req);
}

/** Health scan uses live assessment risks (P2), not mockHealthFindings. */
export async function getHealthFindings(fixtureId: string): Promise<RiskFinding[]> {
  const fixture = (fixtureId in FIXTURE_LABELS ? fixtureId : "standard") as FixtureId;
  try {
    const assessment = await postAssessment(fixture);
    return mapRisks(assessment);
  } catch (error) {
    console.warn("[aegis] live health findings failed; secondary fixture risks", error);
    await delay(150);
    return fixtures[fixture]?.risks ?? [];
  }
}

/** Replaceable local provider seam. No network calls or keys in the demo. */
export async function getHealthBobReply(request: HealthBobRequest): Promise<HealthBobResponse> {
  return mockHealthBobReply(request);
}

/** Authored demonstration outcomes behind the same replaceable service boundary. */
export async function runBobScenario(context: HealthBobRequest["context"], scenarioId: BobScenarioId) {
  return mockBobScenario(context, scenarioId);
}

export interface MonitorBobSimulationRequest {
  type: "simulation_request";
  action: string;
  fixture?: FixtureId;
  scenario_option_id?: string;
  visual?: string;
  parameters?: Record<string, unknown>;
  explanation?: string;
}

export interface MonitorBobResponse {
  ok: boolean;
  source: string;
  error?: string | null;
  explanation?: string | null;
  simulation_request?: MonitorBobSimulationRequest | null;
}

/** Monitor Bob via shared backend intelligence (falls back to local mock). */
export async function askMonitorBob(message: string, context: CanonicalResponse | Record<string, unknown>): Promise<MonitorBobResponse> {
  try {
    const raw = await fetchJson("/api/v1/monitor/bob", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context }),
    }) as MonitorBobResponse;
    return raw;
  } catch (error) {
    console.warn("[aegis] monitor bob unavailable; using local mock", error);
    const mock = mockSimBobReply(message, context as CanonicalResponse);
    return {
      ok: true,
      source: "mock_fallback",
      explanation: mock.text,
      simulation_request: mock.fixture
        ? {
            type: "simulation_request",
            action: `run_${mock.fixture}`,
            fixture: mock.fixture,
            scenario_option_id: mock.scenarioOptionId,
            explanation: mock.text,
          }
        : null,
    };
  }
}

/** Simulate-mode Bob: prefer live Monitor Bob, keep mock mapping for fixtures/visuals. */
export async function getSimBobReply(question: string, data: CanonicalResponse): Promise<SimBobReply> {
  const live = await askMonitorBob(question, data);
  const mock = mockSimBobReply(question, data);
  const sim = live.simulation_request;
  if (sim?.fixture && (sim.fixture === "standard" || sim.fixture === "degraded" || sim.fixture === "critical_stale" || sim.fixture === "stress")) {
    return {
      source: live.source === "bob" ? "mock" : "mock",
      text: live.explanation || sim.explanation || mock.text,
      fixture: sim.fixture,
      scenarioOptionId: sim.scenario_option_id,
      ...(sim.visual === "l2-unavailable" && mock.visual ? { visual: mock.visual } : {}),
    };
  }
  if (live.explanation) {
    return { source: "mock", text: live.explanation, fixture: mock.fixture, scenarioOptionId: mock.scenarioOptionId, visual: mock.visual };
  }
  await delay(200);
  return mock;
}

export interface BuildBobCandidate {
  id: "A" | "B" | "C";
  name?: string;
  recommended?: boolean;
  rationale?: string;
  reliability_considerations?: string;
  tradeoffs?: string[];
  network_changes?: string[];
  confidence?: number;
  flood_risk_impact?: string;
  downstream_load_impact?: string;
  lake_impact?: string;
  resilience_impact?: string;
  construction_impact?: string;
  source?: string;
}

export interface BuildBobDesignResponse {
  ok: boolean;
  source: string;
  error?: string | null;
  explanation?: string | null;
  candidates: BuildBobCandidate[];
}

/** Build Ask-Bob-to-Design via shared backend; always returns V2-safe candidates. */
export async function askBuildBobDesign(context: Record<string, unknown>): Promise<BuildBobDesignResponse> {
  try {
    return await fetchJson("/api/v1/build/bob/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    }) as BuildBobDesignResponse;
  } catch (error) {
    console.warn("[aegis] build bob design unavailable; using V2 candidates", error);
    return {
      ok: false,
      source: "v2_fallback",
      error: "backend_unreachable",
      explanation: "Bob design intelligence unavailable. Existing V2 candidates remain available.",
      candidates: [
        { id: "A", recommended: true, source: "v2" },
        { id: "B", recommended: false, source: "v2" },
        { id: "C", recommended: false, source: "v2" },
      ],
    };
  }
}

/* ---------- Build session re-exports (preserve V2 draft/finalize architecture) ---------- */
export {
  getNetworkSession,
  subscribeNetworkSession,
  selectSessionNetwork,
  getSessionDraft as getBuildDraft,
  saveSessionDraft as saveBuildDraft,
  finalizeSessionNetwork as addFinalizedBuildNetwork,
} from "@/data/networkSession";
export type { BuildDraft, SessionNetwork } from "@/data/networkSession";
export { resolvedSimulationResponse } from "@/data/simulationResolution";

export interface BuildSimulateRequest {
  mode: BuildPathKind;
  rainfall_scenario?: string;
  fixture?: FixtureId;
  selected_candidate: CandidateId;
  revision: number;
  terrain_id?: string | null;
  objectives?: unknown;
  constraints?: unknown;
  active_design: Design;
}

export interface BuildSimulateResult {
  status: string;
  fixture_id?: string;
  active_design: Design;
  design_fingerprint: {
    node_ids: Array<string | undefined>;
    link_ids: Array<string | undefined>;
    revision?: number;
    selected_candidate?: string;
    mode?: string;
  };
  recommendation_status?: string;
  selected_candidate_id?: string | null;
  reason_codes?: string[];
  engineering_warnings?: string[];
  display_metrics_source: "frontend_v2";
  /** Authored V2 metrics retained for UI — never replaced by invented backend numbers. */
  v2_metrics: [string, string][];
  v2_primary: typeof PRIMARY_METRICS;
  assessment?: Record<string, unknown>;
  live: boolean;
}

let lastBuildSimulation: BuildSimulateResult | null = null;
export const getLastBuildSimulation = () => lastBuildSimulation;

/** Enrich assessment with live P2/P3 where available; keep all authored V2 fields. */
export async function enrichBuildAssessment(fixture: FixtureId = "standard") {
  const v2 = {
    terrain: TERRAIN_INTEL,
    reliability: RELIABILITY,
    risks: RISKS,
    confidence: CONFIDENCE,
  };
  try {
    const assessment = await postAssessment(fixture);
    return {
      ...v2,
      live: true as const,
      recommendation_status: (assessment["recommendation"] as { recommendation_status?: string } | undefined)?.recommendation_status,
      reason_codes: (assessment["recommendation"] as { reason_codes?: string[] } | undefined)?.reason_codes ?? [],
      live_risks: mapRisks(assessment),
      decision_gate: (assessment["assessed_state"] as { decision_gate?: string } | undefined)?.decision_gate,
    };
  } catch (error) {
    console.warn("[aegis] build assessment enrichment failed; retaining V2 values", error);
    return { ...v2, live: false as const, live_risks: [] as RiskFinding[], recommendation_status: undefined, reason_codes: [] as string[], decision_gate: undefined };
  }
}

/**
 * Simulate the CURRENT applied active design.
 * Backend validates/binds the design fingerprint via P1/P2/P3; V2 display metrics stay authored.
 */
export async function runBuildSimulation(req: BuildSimulateRequest): Promise<BuildSimulateResult> {
  const candidate = WS_CANDIDATES.find((c) => c.id === req.selected_candidate);
  const v2_metrics = candidate?.metrics ?? [];
  try {
    const raw = await fetchJson("/api/v1/build/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }) as Record<string, unknown>;
    const result: BuildSimulateResult = {
      status: String(raw["status"] ?? "ok"),
      fixture_id: raw["fixture_id"] as string | undefined,
      active_design: (raw["active_design"] as Design) ?? req.active_design,
      design_fingerprint: (raw["design_fingerprint"] as BuildSimulateResult["design_fingerprint"]) ?? {
        node_ids: req.active_design.nodes.map((n) => n.id),
        link_ids: req.active_design.links.map((l) => l.id),
        revision: req.revision,
        selected_candidate: req.selected_candidate,
        mode: req.mode,
      },
      recommendation_status: raw["recommendation_status"] as string | undefined,
      selected_candidate_id: (raw["selected_candidate_id"] as string | null | undefined) ?? null,
      reason_codes: (raw["reason_codes"] as string[]) ?? [],
      engineering_warnings: (raw["engineering_warnings"] as string[]) ?? [],
      display_metrics_source: "frontend_v2",
      v2_metrics,
      v2_primary: PRIMARY_METRICS,
      assessment: raw["assessment"] as Record<string, unknown> | undefined,
      live: true,
    };
    // Guard: never accept a response that drops the applied design topology.
    const returnedIds = new Set(result.active_design.nodes.map((n) => n.id));
    if (!req.active_design.nodes.every((n) => returnedIds.has(n.id))) {
      console.warn("[aegis] build simulate returned mismatched design; keeping applied active design");
      result.active_design = req.active_design;
    }
    lastBuildSimulation = result;
    return result;
  } catch (error) {
    console.warn("[aegis] build simulate unavailable; retaining V2 metrics for applied design", error);
    const fallback: BuildSimulateResult = {
      status: "fallback",
      active_design: req.active_design,
      design_fingerprint: {
        node_ids: req.active_design.nodes.map((n) => n.id),
        link_ids: req.active_design.links.map((l) => l.id),
        revision: req.revision,
        selected_candidate: req.selected_candidate,
        mode: req.mode,
      },
      display_metrics_source: "frontend_v2",
      v2_metrics,
      v2_primary: PRIMARY_METRICS,
      engineering_warnings: ["Live build simulation unavailable — showing authored V2 metrics for the applied design."],
      live: false,
    };
    lastBuildSimulation = fallback;
    return fallback;
  }
}

/** Optional in-memory backend finalize mirror (Monitor still uses networkSession). */
export async function finalizeBuildOnBackend(draft: BuildDraft, networkId: string): Promise<void> {
  try {
    await fetchJson("/api/v1/build/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: draft.path,
        network_id: networkId,
        selected_candidate: draft.candidate,
        revision: draft.revision,
        active_design: draft.design,
      }),
    });
  } catch (error) {
    console.warn("[aegis] backend finalize mirror skipped", error);
  }
}
