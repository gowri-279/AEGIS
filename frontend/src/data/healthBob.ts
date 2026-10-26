import type { CanonicalResponse, NetworkNode, RiskFinding } from "./types";
import { display, humanize, nodeCandidate, nodeRisks, nodeSensors } from "@/lib/aegis";

export const HEALTH_BOB_UNAVAILABLE = "This is not available in the current model.";

/** Lookup-only context: no new measurements or analytical outcomes. */
export function createHealthBobContext(data: CanonicalResponse, node: NetworkNode, finding: RiskFinding) {
  return {
    node, finding,
    sensors: nodeSensors(data, node),
    risks: nodeRisks(data, node),
    candidate: nodeCandidate(data, node),
    candidates: data.candidates,
    upstream: data.network.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from),
    downstream: data.network.edges.filter((edge) => edge.from === node.id).map((edge) => edge.to),
    network: data.network,
    simulation: data.simulation,
    recommendation: data.recommendation,
    provenance: data.data_provenance,
  };
}

export type HealthBobContext = ReturnType<typeof createHealthBobContext>;
export interface HealthBobRequest { context: HealthBobContext; question?: string }
export interface HealthBobResponse { source: "mock"; text: string }

const value = (v: number | null | undefined, unit?: string) => v == null ? HEALTH_BOB_UNAVAILABLE : display(v, unit);
const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

/** Deterministic demo provider; never calls a model, API, or production backend. */
export function mockHealthBobReply({ context: c, question }: HealthBobRequest): HealthBobResponse {
  const { node, finding: f, candidate } = c;
  const observation = `Observed: ${value(f.observed_value, f.unit)} Threshold: ${value(f.threshold, f.unit)} Finding confidence: ${value(f.confidence)} Confidence describes supplied data usability, not hazard probability.`;
  const evidence = bullets(f.evidence.length ? f.evidence : [HEALTH_BOB_UNAVAILABLE]);
  const sensors = c.sensors.length ? bullets(c.sensors.map((s) => `${s.id}: ${humanize(s.variable)}; raw ${value(s.raw_value, s.unit)}; effective ${value(s.effective_value, s.unit)}; status ${s.status}; confidence ${value(s.confidence)}; timestamp ${s.timestamp ?? HEALTH_BOB_UNAVAILABLE}${s.issue ? `; ${s.issue}` : ""}.`)) : HEALTH_BOB_UNAVAILABLE;
  const connections = `Directed topology: ${c.upstream.join(", ") || "no supplied incoming connection"} → ${node.id} → ${c.downstream.join(", ") || "no supplied outgoing connection"}. These are connections, not measured flow or capacity. Recharge branches terminate; a connection does not establish routing eligibility.`;
  const limitations = bullets([...c.recommendation.uncertainty, ...c.recommendation.data_limitations, `Scope: ${humanize(c.recommendation.recommendation_scope)}; safety qualified: ${c.recommendation.safety_qualified ? "yes" : "no"}.`, "Synthetic template response, not external AI analysis or a validated hydraulic safety assessment."]);
  const storage = candidate ? `Supplied available storage: ${value(candidate.available_storage_m3, "m³")}. Scenario diversion: ${value(c.simulation.diverted_volume_m3, "m³")}. Eligibility: ${candidate.eligible ? "eligible" : "ineligible"}; feasibility: ${candidate.feasible == null ? "not determined" : candidate.feasible ? "feasible" : "infeasible"}.\n${bullets(candidate.constraints.map((rule) => `${rule.description}: ${humanize(rule.status)}; observed ${value(rule.observed, rule.unit)}; limit ${value(rule.limit, rule.unit)}${rule.note ? `; ${rule.note}` : ""}.`))}` : HEALTH_BOB_UNAVAILABLE;
  const interpretation = f.category === "overflow"
    ? "This supplied overflow marker is illustrative. No overflow measurement, trigger or probability is supplied; it is not a confirmed failure and does not override the canonical candidate result."
    : f.category === "bottleneck"
      ? "Limited storage can constrain this branch. The supplied candidate constraints, not Bob, determine whether the scenario can be accommodated. This does not establish physical pipe capacity."
      : f.category === "hydraulic_overload"
        ? "Elevated depth indicates an attention condition in the supplied finding, not necessarily a threshold breach. The supplied observation and threshold must be read together; Bob does not evaluate hydraulics or confirm surcharge."
        : "The supplied finding identifies an attention condition. Sensor freshness and missing values limit interpretation; Bob does not independently diagnose a failure.";
  const checks = [
    "Verify the source, freshness and reliability of the supplied observations.",
    "Review the finding evidence and supplied threshold or candidate constraints.",
    `Investigate the connected ${c.upstream.join(", ") || "upstream"} and ${c.downstream.join(", ") || "downstream"} context; downstream hydraulic capacity is not established here.`,
  ];
  const actions = "Possible review options: obtain missing observations, request an engineering assessment, and compare supplied scenario results. These are investigation options, not operational commands or authorization to divert water.";
  const riskSummary = bullets(c.risks.map((risk) => `${risk.title} — ${risk.severity}: ${risk.potential_impact}`));
  const sections = {
    overview: `### What I see · supplied evidence\n${node.id} — ${humanize(node.type)}. ${f.title}; severity ${f.severity}.\n\n${observation}`,
    meaning: `### Why it matters · interpretation\n${interpretation}`,
    evidence: `### Evidence · supplied\n${evidence}\n\n${sensors}`,
    impact: `### Network impact · supplied / potential\n${f.potential_impact}\n\n${connections}\n\n${riskSummary}`,
    checks: `### What to check next · possible checks\n${bullets(checks)}`,
    actions: `### Possible actions · review options\n${actions}`,
    uncertainty: `### Uncertainty\n${limitations}`,
    storage: `### Component / scenario data · supplied\n${storage}`,
  };
  const q = question?.trim().toLowerCase();
  let parts: string[];
  if (!q) parts = [sections.overview, sections.meaning, sections.evidence, ...(candidate ? [sections.storage] : []), sections.impact, sections.checks, sections.actions, sections.uncertainty];
  else if (/operate|open.*gate|close.*gate|pump|execute|implement|command/.test(q)) parts = [sections.actions, sections.uncertainty];
  else if (/sensor|fresh|reading|confidence|observ|threshold|evidence/.test(q)) parts = [sections.overview, sections.evidence, sections.uncertainty];
  else if (/upstream|downstream|network|connect|direction|flow|impact/.test(q)) parts = [sections.impact, "Measured flow, travel time and downstream capacity: " + HEALTH_BOB_UNAVAILABLE, sections.uncertainty];
  else if (/storage|capacity|volume|scenario|feasib|eligible/.test(q)) parts = [sections.storage, sections.meaning, sections.uncertainty];
  else if (/check|next|action|recommend|should|do/.test(q)) parts = [sections.checks, sections.actions, sections.uncertainty];
  else if (/uncertain|limit|safe|probab|risk/.test(q)) parts = [sections.meaning, sections.impact, sections.uncertainty];
  else if (/why|explain|mean|summary/.test(q)) parts = [sections.overview, sections.meaning, sections.impact];
  else parts = [`${HEALTH_BOB_UNAVAILABLE} Bob's synthetic templates can explain the selected finding, evidence, sensors, connections, supplied scenario data, possible checks and limitations.`, sections.overview];
  return { source: "mock", text: parts.join("\n\n") };
}