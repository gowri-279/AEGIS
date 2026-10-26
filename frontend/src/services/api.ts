import type {
  CanonicalResponse,
  Candidate,
  ConstraintEvaluation,
  Network,
  NetworkEdge,
  NetworkNode,
  Recommendation,
  RiskFinding,
  Sensor,
  SensorStatus,
} from "@/data/types";
import type { FixtureId } from "@/data/mockCanonicalResponse";
import {
  mockHealthBobReply,
  type HealthBobRequest,
  type HealthBobResponse,
} from "@/data/healthBob";
import { mockBobScenario, type BobScenarioId } from "@/data/bobInterventions";
import { mockSimBobReply, type SimBobReply } from "@/data/simBob";
import { landingDemoModel } from "@/data/landingDemoNetwork";

type JsonRecord = Record<string, unknown>;

const API_BASE = (import.meta.env.VITE_AEGIS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};

const asArray = (value: unknown): JsonRecord[] => (Array.isArray(value) ? value.map(asRecord) : []);

const nullableNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const statusMap: Record<string, ConstraintEvaluation["status"]> = {
  passed: "pass",
  pass: "pass",
  failed: "fail",
  fail: "fail",
  not_evaluated: "not_evaluated",
};

const sensorStatusMap: Record<string, SensorStatus> = {
  fresh: "fresh",
  degraded: "degraded",
  stale: "stale",
  missing: "missing",
  invalid: "invalid",
  conflicting: "conflicting",
};

const riskCategoryMap: Record<string, RiskFinding["category"]> = {
  hydraulic_overload: "hydraulic_overload",
  overflow: "overflow",
  bottleneck: "bottleneck",
  infrastructure_anomaly: "infrastructure_anomaly",
  water_quality: "water_quality",
  downstream_propagation: "downstream_propagation",
  data_reliability: "data_reliability",
};

function mapNetwork(raw: JsonRecord): Network {
  const rawNodes = asArray(raw.nodes);
  const rawEdges = asArray(raw.edges);

  const nodes: NetworkNode[] = rawNodes.map((node) => {
    const id = String(node.id ?? node.node_id ?? "unknown");
    const type = String(node.type ?? "junction");
    const attributes: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(node)) {
      if (
        [
          "id",
          "node_id",
          "type",
          "label",
          "sensor_ids",
          "candidate_id",
          "recharge_eligibility",
        ].includes(key)
      )
        continue;
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      )
        attributes[key] = value;
    }

    if (node.recharge_eligibility !== undefined) {
      attributes.recharge_eligibility = node.recharge_eligibility;
    }

    return {
      id,
      type: (type === "collection_inlet" ||
      type === "junction" ||
      type === "storage" ||
      type === "recharge" ||
      type === "downstream_junction" ||
      type === "outlet"
        ? type
        : "junction") as NetworkNode["type"],
      label: String(node.label ?? `${type.replaceAll("_", " ")} ${id}`),
      sensor_ids: Array.isArray(node.sensor_ids) ? node.sensor_ids.map(String) : [],
      ...(node.candidate_id ? { candidate_id: String(node.candidate_id) } : {}),
      attributes,
    };
  });

  const edges: NetworkEdge[] = rawEdges.map((edge) => ({
    id: String(edge.id ?? edge.edge_id ?? "unknown-edge"),
    from: String(edge.from ?? edge.from_node ?? ""),
    to: String(edge.to ?? edge.to_node ?? ""),
  }));

  // Link sensors to their network nodes by the backend's canonical sensor ID.
  for (const node of nodes) {
    node.sensor_ids = [
      ...new Set([
        ...node.sensor_ids,
        ...asArray(raw.network_sensors)
          .filter((sensor) => String(sensor.sensor_id ?? "").endsWith(`-${node.id}`))
          .map((sensor) => String(sensor.sensor_id)),
      ]),
    ];
  }

  return { network_id: String(raw.network_id ?? "aegis_demo_catchment"), nodes, edges };
}

function mapSensors(rawSensors: unknown): Sensor[] {
  return asArray(rawSensors).map((sensor) => {
    const id = String(sensor.sensor_id ?? sensor.id ?? "unknown-sensor");
    const variable = String(sensor.sensor_type ?? sensor.variable ?? "unknown");
    const nodeId = id.includes("-") ? id.slice(id.lastIndexOf("-") + 1) : "";
    const status = sensorStatusMap[String(sensor.quality_status ?? sensor.status)] ?? "missing";
    const issueCodes = Array.isArray(sensor.issue_codes) ? sensor.issue_codes.map(String) : [];

    const unitByVariable: Record<string, string> = {
      water_level: "m",
      rainfall: "mm",
      flow: "m³/s",
      pressure: "kPa",
      water_quality: "",
    };

    return {
      id,
      node_id: nodeId,
      variable: variable === "water_level" ? "water_depth" : variable,
      unit: String(sensor.unit ?? unitByVariable[variable] ?? ""),
      critical: id === "WL-J3",
      raw_value: nullableNumber(sensor.raw_value),
      effective_value: nullableNumber(sensor.effective_value),
      status,
      confidence: nullableNumber(sensor.confidence),
      timestamp: typeof sensor.timestamp === "string" ? sensor.timestamp : null,
      ...(issueCodes.length ? { issue: issueCodes.join(", ") } : {}),
    };
  });
}

function mapRisks(rawRisks: unknown): RiskFinding[] {
  return asArray(rawRisks).map((risk, index) => {
    const rawSeverity = String(risk.severity ?? "low");
    const severity = rawSeverity === "medium" ? "moderate" : rawSeverity;
    const category = riskCategoryMap[String(risk.category)] ?? "infrastructure_anomaly";

    return {
      id: String(risk.id ?? risk.risk_id ?? `risk-${index + 1}`),
      category,
      target_id: String(risk.target_id ?? risk.target ?? "unknown"),
      title: String(risk.title ?? risk.description ?? risk.category ?? "Risk finding"),
      observed_value: nullableNumber(risk.observed_value),
      threshold: nullableNumber(risk.threshold),
      ...(typeof risk.unit === "string" ? { unit: risk.unit } : {}),
      severity: (["low", "moderate", "high", "critical"].includes(severity)
        ? severity
        : "low") as RiskFinding["severity"],
      confidence: nullableNumber(risk.confidence),
      evidence: Array.isArray(risk.evidence) ? risk.evidence.map(String) : [],
      potential_impact: String(risk.potential_impact ?? "Impact not specified by backend."),
    };
  });
}

function mapCandidates(
  rawCandidates: unknown,
  rawNetwork: JsonRecord,
  ranking: unknown,
): Candidate[] {
  const nodes = asArray(rawNetwork.nodes);
  const edges = asArray(rawNetwork.edges);
  const rankedIds = asArray(ranking).map((entry) =>
    typeof entry === "string" ? entry : String(entry.candidate_id ?? entry.id ?? ""),
  );

  return asArray(rawCandidates).map((candidate) => {
    const id = String(candidate.candidate_id ?? candidate.id ?? "unknown-candidate");
    const nodeId = id.startsWith("C-") ? id.slice(2) : "";
    const node = nodes.find(
      (item) =>
        String(item.id ?? item.node_id) === nodeId || String(item.candidate_id ?? "") === id,
    );
    const kind = String(node?.type ?? (id.startsWith("C-R") ? "recharge" : "storage"));
    const checks = asArray(candidate.checks);

    const constraints: ConstraintEvaluation[] = checks.map((check) => {
      const details = asRecord(check.details);
      let observed: number | null = null;
      let limit: number | null = null;

      if (check.constraint === "storage") {
        observed = nullableNumber(details.proposed_volume_m3);
        limit = nullableNumber(details.available_storage_m3);
      } else if (check.constraint === "j3_water_level") {
        observed = nullableNumber(details.water_depth_m);
        limit = nullableNumber(details.maximum_depth_m);
      } else if (check.constraint === "candidate_flow_limit") {
        observed = nullableNumber(details.flow_m3_s);
        limit = nullableNumber(details.candidate_limit_m3_s);
      } else if (check.constraint === "edge_capacity") {
        observed = nullableNumber(details.flow_m3_s);
        limit = nullableNumber(details.edge_capacity_m3_s);
      }

      return {
        constraint_id: String(check.constraint ?? "unknown_constraint"),
        description: String(check.constraint ?? "Constraint").replaceAll("_", " "),
        status: statusMap[String(check.status)] ?? "not_evaluated",
        observed,
        limit,
        unit:
          check.constraint === "j3_water_level"
            ? "m"
            : check.constraint === "candidate_flow_limit" || check.constraint === "edge_capacity"
              ? "m³/s"
              : check.constraint === "storage"
                ? "m³"
                : "",
        ...(Array.isArray(check.reason_codes) && check.reason_codes.length
          ? { note: check.reason_codes.map(String).join(", ") }
          : {}),
      };
    });

    const eligibilityCheck = checks.find((check) => check.constraint === "recharge_eligibility");
    const routeEdgeIds = edges
      .filter((edge) => String(edge.from) === "J3" && String(edge.to) === nodeId)
      .map((edge) => String(edge.id));

    return {
      id,
      node_id: nodeId || String(node?.id ?? ""),
      kind: kind === "recharge" ? "recharge" : "storage",
      route_edge_ids: routeEdgeIds,
      available_storage_m3: nullableNumber(node?.available_storage_m3),
      eligible: eligibilityCheck ? eligibilityCheck.status === "passed" : true,
      feasible: typeof candidate.feasible === "boolean" ? candidate.feasible : null,
      constraints,
      // A selected sole feasible candidate is not a ranking result.
      rank: rankedIds.indexOf(id) >= 0 ? rankedIds.indexOf(id) + 1 : null,
    };
  });
}

function mapCanonicalResponse(
  rawValue: unknown,
  fixture: FixtureId,
  scenarioOptionId?: string,
): CanonicalResponse {
  const raw = asRecord(rawValue);
  const networkRaw = asRecord(raw.network);
  const network = mapNetwork(networkRaw);
  const networkState = asRecord(raw.network_state);
  const assessedState = asRecord(raw.assessed_state);
  const scenario = asRecord(raw.scenario);
  const simulation = asRecord(raw.simulation_result);
  const baseline = asRecord(raw.baseline_comparison);
  const recommendationRaw = asRecord(raw.recommendation);
  const risks = mapRisks(raw.risks ?? assessedState.risk_findings);
  const ranking = raw.ranking;

  const candidates = mapCandidates(raw.candidate_evaluations, networkRaw, ranking);
  const selectedId =
    typeof recommendationRaw.selected_candidate_id === "string"
      ? recommendationRaw.selected_candidate_id
      : null;

  const recommendation: Recommendation = {
    recommendation_status: (["recommended", "no_feasible_candidate", "abstained"].includes(
      String(recommendationRaw.recommendation_status),
    )
      ? recommendationRaw.recommendation_status
      : "abstained") as Recommendation["recommendation_status"],
    selected_candidate_id: selectedId,
    recommendation_scope: String(recommendationRaw.recommendation_scope ?? "limited_mvp_scope"),
    safety_qualified: recommendationRaw.safety_qualified === true,
    rationale: Array.isArray(recommendationRaw.rationale)
      ? recommendationRaw.rationale.map(String)
      : [],
    uncertainty: Array.isArray(recommendationRaw.uncertainty)
      ? recommendationRaw.uncertainty.map(String)
      : [],
    data_limitations: Array.isArray(recommendationRaw.data_limitations)
      ? recommendationRaw.data_limitations.map(String)
      : [],
    selection_basis: recommendationRaw.selection_basis ?? null,
    reason_codes: Array.isArray(recommendationRaw.reason_codes)
      ? recommendationRaw.reason_codes.map(String)
      : [],
  };

  const divertedVolume =
    nullableNumber(simulation.proposed_volume_m3) ??
    nullableNumber(scenario.proposed_volume_m3) ??
    0;
  const duration =
    nullableNumber(simulation.duration_seconds) ?? nullableNumber(scenario.duration_seconds) ?? 0;
  const proposedFlow =
    nullableNumber(simulation.proposed_flow_m3_s) ??
    (duration > 0 ? divertedVolume / duration : null);

  return {
    fixture_id: fixture,
    fixture_label: scenarioOptionId ?? `${fixture} · ${divertedVolume} m³ / ${duration} s`,
    data_provenance: "synthetic_illustrative",
    generated_at: new Date().toISOString(),
    network,
    sensors: mapSensors(networkState.sensors),
    risks,
    simulation: {
      ...(scenarioOptionId ? { scenario_option_id: scenarioOptionId } : {}),
      scenario_id: String(simulation.scenario_id ?? scenario.scenario_id ?? fixture),
      diverted_volume_m3: divertedVolume,
      duration_s: duration,
      proposed_flow_m3s: proposedFlow ?? 0,
      model_note: "Illustrative MVP model output; not a validated hydraulic simulation.",
    },
    candidates,
    recommendation,
  };
}

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

function payloadForScenario(req: ScenarioRequest) {
  const defaults: Record<FixtureId, { volume: number; duration: number; failure?: string }> = {
    standard: { volume: 200, duration: 600 },
    degraded: { volume: 200, duration: 600, failure: "degraded" },
    critical_stale: { volume: 200, duration: 600, failure: "stale" },
    stress: { volume: 900, duration: 600 },
  };
  const selected = defaults[req.fixture];

  return {
    proposed_volume_m3: req.diverted_volume_m3 ?? selected.volume,
    duration_seconds: req.duration_s ?? selected.duration,
    recharge_eligibility: "ineligible",
    baseline_excess_volume_m3: 300,
    scenario_id: req.scenarioOptionId ?? req.fixture,
    ...(selected.failure ? { wl_j3_failure_mode: selected.failure } : {}),
  };
}

async function fetchAssessment(req: ScenarioRequest): Promise<CanonicalResponse> {
  const response = await fetch(`${API_BASE}/api/v1/assessment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadForScenario(req)),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Assessment API failed (${response.status}): ${detail || response.statusText}`);
  }
  return mapCanonicalResponse(await response.json(), req.fixture, req.scenarioOptionId);
}

export async function getCanonicalResponse(
  fixture: FixtureId = "standard",
): Promise<CanonicalResponse> {
  return fetchAssessment({ fixture });
}

export async function runScenario(req: ScenarioRequest): Promise<CanonicalResponse> {
  return fetchAssessment(req);
}

/** Health scan remains on its existing provider until its backend endpoint is integrated. */
export async function getHealthFindings(fixtureId: string) {
  const fixtures: FixtureId[] = ["standard", "degraded", "critical_stale", "stress"];
  const fixture = fixtures.includes(fixtureId as FixtureId) ? (fixtureId as FixtureId) : "standard";
  const assessment = await fetchAssessment({ fixture });
  return assessment.risks;
}

export async function getHealthBobReply(request: HealthBobRequest): Promise<HealthBobResponse> {
  return mockHealthBobReply(request);
}

export async function runBobScenario(
  context: HealthBobRequest["context"],
  scenarioId: BobScenarioId,
) {
  return mockBobScenario(context, scenarioId);
}

export async function getSimBobReply(
  question: string,
  data: CanonicalResponse,
): Promise<SimBobReply> {
  return mockSimBobReply(question, data);
}
