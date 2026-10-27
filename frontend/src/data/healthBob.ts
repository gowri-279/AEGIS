import type { CanonicalResponse, NetworkNode, RiskFinding } from "./types";
import { display, humanize, nodeCandidate, nodeRisks, nodeSensors } from "@/lib/aegis";
import { getComponentIntel, resolveComponentProfile } from "./componentIntelligence";

export const HEALTH_BOB_UNAVAILABLE = "This is not available in the current model.";

/** Lookup-only context: full canonical component profile + neighbors for Monitor Bob. */
export function createHealthBobContext(data: CanonicalResponse, node: NetworkNode, finding: RiskFinding) {
  const profile = resolveComponentProfile(data, node.id);
  return {
    node, finding,
    sensors: nodeSensors(data, node),
    risks: nodeRisks(data, node),
    candidate: nodeCandidate(data, node),
    candidates: data.candidates,
    upstream: profile?.upstream ?? data.network.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from),
    downstream: profile?.downstream ?? data.network.edges.filter((edge) => edge.from === node.id).map((edge) => edge.to),
    network: data.network,
    simulation: data.simulation,
    recommendation: data.recommendation,
    provenance: data.data_provenance,
    component_intelligence: profile?.intel ?? null,
    component_profile: profile,
    related_edges: profile?.related_edges ?? [],
    neighbor_components: profile?.neighbor_intel ?? { upstream: [], downstream: [] },
    topology_path: profile
      ? `${profile.upstream.join(" → ") || "—"} → ${profile.component_id} → ${profile.downstream.join(" → ") || "—"}`
      : node.id,
  };
}

export type HealthBobContext = ReturnType<typeof createHealthBobContext>;
export interface HealthBobRequest { context: HealthBobContext; question?: string }
export interface HealthBobResponse {
  source: "mock" | "deterministic" | "bob" | "aegis";
  text: string;
  existing_problem?: string;
  why_it_matters?: string;
  if_no_action?: string;
  proposed_solution?: string;
  why_solution?: string;
  result?: string;
}

const value = (v: number | null | undefined, unit?: string) => v == null ? HEALTH_BOB_UNAVAILABLE : display(v, unit);
const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

/** Deterministic structured Health Bob reply from component intelligence (no authored disclaimer script). */
export function mockHealthBobReply({ context: c, question }: HealthBobRequest): HealthBobResponse {
  const { node, finding: f, candidate } = c;
  const intel = c.component_intelligence ?? getComponentIntel(node.id);
  const observation = `Observed: ${value(f.observed_value, f.unit)} Threshold: ${value(f.threshold, f.unit)} Finding confidence: ${value(f.confidence)}.`;
  const evidence = bullets(f.evidence.length ? f.evidence : [HEALTH_BOB_UNAVAILABLE]);
  const sensors = c.sensors.length ? bullets(c.sensors.map((s) => `${s.id}: ${humanize(s.variable)}; raw ${value(s.raw_value, s.unit)}; effective ${value(s.effective_value, s.unit)}; status ${s.status}; confidence ${value(s.confidence)}.`)) : HEALTH_BOB_UNAVAILABLE;
  const connections = `Topology: ${c.upstream.join(", ") || "none"} → ${node.id} → ${c.downstream.join(", ") || "none"}.`;
  const storage = candidate ? `Available storage: ${value(candidate.available_storage_m3, "m³")}. Scenario diversion: ${value(c.simulation.diverted_volume_m3, "m³")}. Eligibility: ${candidate.eligible ? "eligible" : "ineligible"}; feasibility: ${candidate.feasible == null ? "not determined" : candidate.feasible ? "feasible" : "infeasible"}.` : HEALTH_BOB_UNAVAILABLE;

  const existing_problem = `${node.id}: ${f.title} (${f.severity}). ${observation}`
    + (intel?.identified_constraint ? ` Constraint: ${intel.identified_constraint}.` : "");
  const why_it_matters = `${intel?.engineering_significance ?? f.potential_impact} ${connections}`
    + (intel ? ` Downstream sensitivity: ${intel.downstream_sensitivity}.` : "");
  const if_no_action = f.category === "bottleneck"
    ? `Leaving ${node.id} unchanged keeps storage below the diversion requirement; excess volume propagates toward ${c.downstream.join(", ") || "J4/O1"}.`
    : f.category === "overflow"
      ? `Without intervention at ${node.id}, peak loading continues toward ${c.downstream.join(", ") || "downstream"} and O1 remains exposed.`
      : `If depth/loading at ${node.id} persists, upstream (${c.upstream.join(", ") || "inlets"}) face rising surcharge pressure.`;
  const proposed_solution = f.category === "bottleneck"
    ? `Expand storage capacity at ${node.type === "storage" ? node.id : "L1"}`
    : f.category === "overflow"
      ? `Redesign the ${node.id} → J4 → O1 downstream connection`
      : `Increase downstream conveyance capacity at ${node.id}`;
  const why_solution = `Selected because it addresses the ${f.category.replaceAll("_", " ")} finding using known topology and component constraints at ${node.id}.`;
  const result = `Engineering expectation: ${proposed_solution} should relieve concentration at ${node.id}. Deterministic AEGIS metrics appear after simulation is run.`;

  const sections = {
    overview: `### Existing problem\n${existing_problem}`,
    meaning: `### Why it matters\n${why_it_matters}`,
    evidence: `### Evidence\n${evidence}\n\n${sensors}`,
    impact: `### Network impact\n${f.potential_impact}\n\n${connections}`,
    noAction: `### If no action is taken\n${if_no_action}`,
    proposed: `### Proposed solution\n${proposed_solution}\n\n### Why this solution\n${why_solution}`,
    result: `### Result\n${result}`,
    storage: `### Component / scenario data\n${storage}`,
  };
  const q = question?.trim().toLowerCase();
  let parts: string[];
  if (!q) parts = [sections.overview, sections.meaning, sections.noAction, sections.proposed, sections.result, sections.evidence, ...(candidate ? [sections.storage] : []), sections.impact];
  else if (/sensor|fresh|reading|confidence|observ|threshold|evidence/.test(q)) parts = [sections.overview, sections.evidence];
  else if (/upstream|downstream|network|connect|direction|flow|impact/.test(q)) parts = [sections.impact, sections.meaning];
  else if (/storage|capacity|volume|scenario|feasib|eligible/.test(q)) parts = [sections.storage, sections.meaning];
  else if (/check|next|action|recommend|should|do|solution/.test(q)) parts = [sections.proposed, sections.result];
  else if (/no action|nothing|if we (do )?nothing/.test(q)) parts = [sections.noAction, sections.meaning];
  else if (/why|explain|mean|summary/.test(q)) parts = [sections.overview, sections.meaning, sections.impact];
  else parts = [sections.overview, sections.meaning, sections.proposed];
  return {
    source: "deterministic",
    text: parts.join("\n\n"),
    existing_problem, why_it_matters, if_no_action, proposed_solution, why_solution, result,
  };
}
