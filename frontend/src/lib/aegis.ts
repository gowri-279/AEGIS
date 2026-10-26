// Presentation helpers: format and look up canonical values. Never derives
// feasibility, ranking, risk scores, reliability or physics.
import type {
  CanonicalResponse,
  Candidate,
  ConstraintStatus,
  NetworkNode,
  RecommendationStatus,
  RiskFinding,
  Sensor,
  SensorStatus,
  Severity,
} from "@/data/types";

export type Tone = "ok" | "warn" | "crit" | "unknown" | "info" | "neutral";

export const EMPTY = "—";

/** Null/undefined stay visibly unknown; never coerced to 0. */
export function display(
  value: string | number | boolean | null | undefined,
  unit?: string,
): string {
  if (value == null || value === "") return EMPTY;
  const text =
    typeof value === "number"
      ? Number.isInteger(value)
        ? String(value)
        : String(Number(value.toFixed(3)))
      : String(value);
  return unit ? `${text} ${unit}` : text;
}

export const humanize = (s: string) => s.replaceAll("_", " ");

export const sensorTone: Record<SensorStatus, Tone> = {
  fresh: "ok",
  degraded: "warn",
  stale: "unknown",
  missing: "unknown",
  invalid: "warn",
  conflicting: "warn",
};

export const severityTone: Record<Severity, Tone> = {
  low: "info",
  moderate: "warn",
  high: "crit",
  critical: "crit",
};

export const constraintTone: Record<ConstraintStatus, Tone> = {
  pass: "ok",
  fail: "crit",
  not_evaluated: "unknown",
};
export const constraintLabel: Record<ConstraintStatus, string> = {
  pass: "Passed",
  fail: "Failed",
  not_evaluated: "Not evaluated",
};

export function feasibilityTone(f: boolean | null): Tone {
  return f === true ? "ok" : f === false ? "crit" : "unknown";
}
export function feasibilityLabel(f: boolean | null): string {
  return f === true ? "Feasible" : f === false ? "Infeasible" : "Not determined";
}

export const recommendationLabel: Record<RecommendationStatus, string> = {
  recommended: "Recommended",
  no_feasible_candidate: "No feasible candidate",
  abstained: "Abstained",
};
export const recommendationTone: Record<RecommendationStatus, Tone> = {
  recommended: "ok",
  no_feasible_candidate: "warn",
  abstained: "unknown",
};

/** Display priority only (which colour wins on a glyph). Not a risk score. */
const TONE_PRIORITY: Tone[] = ["crit", "warn", "unknown", "info", "ok", "neutral"];
export function strongestTone(tones: Tone[]): Tone {
  for (const t of TONE_PRIORITY) if (tones.includes(t)) return t;
  return "neutral";
}

export function nodeSensors(data: CanonicalResponse, node: NetworkNode): Sensor[] {
  return data.sensors.filter((s) => s.node_id === node.id || node.sensor_ids.includes(s.id));
}

export function nodeRisks(data: CanonicalResponse, node: NetworkNode): RiskFinding[] {
  const sensorIds = new Set(nodeSensors(data, node).map((s) => s.id));
  return data.risks.filter((r) => r.target_id === node.id || sensorIds.has(r.target_id));
}

export function nodeCandidate(data: CanonicalResponse, node: NetworkNode): Candidate | undefined {
  return (
    data.candidates.find((c) => c.id === node.candidate_id) ??
    data.candidates.find((c) => c.node_id === node.id)
  );
}

export function edgeCandidates(data: CanonicalResponse, edgeId: string): Candidate[] {
  return data.candidates.filter((c) => c.route_edge_ids.includes(edgeId));
}

/** Health attention tone aggregated from canonical sensor statuses and risk severities. */
export function attentionTone(data: CanonicalResponse, node: NetworkNode): Tone {
  const tones = [
    ...nodeSensors(data, node).map((s) => sensorTone[s.status]),
    ...nodeRisks(data, node).map((r) => severityTone[r.severity]),
  ];
  return tones.length ? strongestTone(tones) : "neutral";
}

/** Map any canonical id (node, edge, sensor, candidate) to the network element to focus. */
export function resolveTarget(data: CanonicalResponse, id: string): string {
  if (data.network.nodes.some((n) => n.id === id) || data.network.edges.some((e) => e.id === id))
    return id;
  const sensor = data.sensors.find((s) => s.id === id);
  if (sensor) return sensor.node_id;
  const candidate = data.candidates.find((c) => c.id === id);
  if (candidate) return candidate.node_id;
  return id;
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "moderate", "low"];
