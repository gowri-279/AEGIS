// Simulate-mode Bob: deterministic mock network/simulation assistant.
// Every reply is a lookup over supplied mock fixtures — no AI, no backend,
// no hydraulic calculation. Replaceable by the future backend via services/api.
import { fixtures, type FixtureId } from "./mockCanonicalResponse";
import type { CanonicalResponse, Severity } from "./types";
import { display, feasibilityLabel, humanize, recommendationLabel } from "@/lib/aegis";
import { SCENARIOS } from "./simulationScenarios";

export interface SimVisual {
  edgeStages: Record<string, number>;
  nodeStates: Record<string, { severity: Severity; storageLevel?: "raised" | "settled" }>;
}
export interface SimBobReply {
  source: "mock";
  text: string;
  /** When set, the app runs this supplied scenario fixture and updates the terrain. */
  fixture?: FixtureId;
  scenarioOptionId?: string;
  /** When set, the app shows this authored illustrative state on the terrain. */
  visual?: SimVisual;
}

export type SimBobIntent = "rain" | "sensor" | "l2-unavailable" | "pressure" | "volume" | "overview";

export function simBobIntent(question: string): SimBobIntent {
  const q = question.trim().toLowerCase();
  if (/\bl2\b|\bj4\b/.test(q) && /unavailable|removed|offline|out of service|without|fail|divert|reroute|route more/.test(q)) return "l2-unavailable";
  if (/rain|storm|inflow|flood|overflow|depth|exceed|threshold|\bj3\b|blocked|blockage/.test(q)) return "rain";
  if (/sensor/.test(q) && /fail|stale|degrad|unreliable|offline/.test(q)) return "sensor";
  if (/most pressure|limiting|under.*pressure|stressed|bottleneck/.test(q)) return "pressure";
  if (/handle|volume|capacity|cope|manage/.test(q)) return "volume";
  return "overview";
}

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

function scenarioSummary(data: CanonicalResponse): string {
  const sim = data.simulation;
  return `Supplied scenario ${sim.scenario_id}: diverted volume ${display(sim.diverted_volume_m3, "m³")}, duration ${display(sim.duration_s, "s")}, proposed flow ${display(sim.proposed_flow_m3s, "m³/s")}. Recommendation: ${recommendationLabel[data.recommendation.recommendation_status]}${data.recommendation.selected_candidate_id ? ` · ${data.recommendation.selected_candidate_id}` : ""}.`;
}

function candidateLines(data: CanonicalResponse): string[] {
  return data.candidates.map((c) => {
    const failed = c.constraints.filter((rule) => rule.status === "fail");
    return `${c.id} at ${c.node_id}: ${display(c.available_storage_m3, "m³")} available storage, ${c.eligible ? "eligible" : "ineligible"}, ${feasibilityLabel(c.feasible).toLowerCase()}${failed.length ? `; failed constraint: ${failed.map((rule) => rule.description).join("; ")}` : ""}.`;
  });
}

/** Fixed illustrative what-if: L2 removed. Edges are a lookup over the existing
 *  directed topology — the L2 branch and recharge termination are excluded. */
function l2UnavailableVisual(data: CanonicalResponse): SimVisual {
  const edgeStages: Record<string, number> = {};
  for (const edge of data.network.edges) {
    if (edge.to === "L2" || edge.from === "L2" || edge.to === "R1" || edge.from === "R1") continue;
    edgeStages[edge.id] = edge.from === "C1" || edge.from === "C2" ? 0 : edge.from === "J3" ? 1 : edge.from === "J4" ? 3 : 2;
  }
  return { edgeStages, nodeStates: { L1: { severity: "critical", storageLevel: "raised" } } };
}

export function mockSimBobReply(question: string, data: CanonicalResponse): SimBobReply {
  const intent = simBobIntent(question);
  if (intent === "rain" || intent === "sensor") {
    const q = question.toLowerCase();
    const optionId = /cloud|peak/.test(q) ? "cloudburst"
      : /extreme/.test(q) ? "extreme_rainfall"
      : /flood|overflow/.test(q) ? "flooding"
      : /heavy|storm/.test(q) ? "heavy_storm"
      : /normal|standard/.test(q) ? "normal_rainfall"
      : "heavy_storm";
    const option = SCENARIOS.find((item) => item.id === optionId);
    if (!option) return { source: "mock", text: scenarioSummary(data) };
    const response = fixtures[option.fixture];
    return {
      source: "mock", fixture: option.fixture, scenarioOptionId: option.id,
      text: `### ${option.label === "Heavy Rain" ? "Heavy-Rain" : option.label} Scenario · Synthetic\n${option.detail}. The supplied evaluation is now shown on the terrain.\n\n${scenarioSummary(response)}\n\n${bullets(candidateLines(response))}\n\n${bullets(response.sensors.filter((s) => s.status !== "fresh").map((s) => `${s.id} at ${s.node_id}: ${s.status}${s.issue ? ` — ${s.issue}` : ""}`))}\n\nAll values are supplied mock data, not a new hydraulic calculation. Confidence describes data usability, not hazard probability.`,
    };
  }
  if (intent === "l2-unavailable") {
    const l2 = data.candidates.find((c) => c.node_id === "L2");
    return {
      source: "mock", fixture: currentFixture(data), scenarioOptionId: data.simulation.scenario_option_id ?? data.fixture_id, visual: l2UnavailableVisual(data),
      text: `### L2 unavailable · illustrative what-if\nL2 currently provides ${display(l2?.available_storage_m3, "m³")} of available storage. Removing it forces the diverted flow toward the remaining downstream paths. In this illustrative scenario, L1 becomes the limiting storage component and the L1 → J4 route becomes infeasible.\n\nThis is an authored demonstration on the existing topology — no capacities were recalculated and canonical data is unchanged. Evaluation, Result and any Action Plan retain the supplied current scenario; no evaluated L2-removal recommendation is available.`,
    };
  }
  if (intent === "pressure") {
    const limiting = data.candidates.find((c) => c.constraints.some((rule) => rule.status === "fail"));
    const failed = limiting?.constraints.filter((rule) => rule.status === "fail") ?? [];
    return {
      source: "mock", fixture: currentFixture(data), scenarioOptionId: data.simulation.scenario_option_id ?? data.fixture_id,
      text: limiting
        ? `### Storage pressure · supplied constraints\n${limiting.node_id} is the limiting storage component in the supplied evaluation: ${bullets(failed.map((rule) => `${rule.description} — observed ${display(rule.observed, rule.unit)}, limit ${display(rule.limit, rule.unit)}`))}\n\n${bullets(candidateLines(data))}\n\nSupplied constraint results only; Bob does not compute utilization.`
        : `### Storage pressure · supplied constraints\nNo supplied constraint failed in this scenario.\n\n${bullets(candidateLines(data))}`,
    };
  }
  if (intent === "volume") {
    return {
      source: "mock", fixture: currentFixture(data), scenarioOptionId: data.simulation.scenario_option_id ?? data.fixture_id,
      text: `### Can the network handle this volume? · supplied evaluation\n${scenarioSummary(data)}\n\n${bullets(candidateLines(data))}\n\nThis is the supplied mock evaluation of the current scenario, not a new calculation. ${data.simulation.model_note}`,
    };
  }
  return {
    source: "mock", fixture: currentFixture(data), scenarioOptionId: data.simulation.scenario_option_id ?? data.fixture_id,
    text: `### Network situation · supplied data\n${scenarioSummary(data)}\n\n${bullets(candidateLines(data))}\n\nI can run illustrative what-ifs: heavier rainfall, a sensor failure, or L2 unavailable. Everything is synthetic mock data — ${humanize(data.data_provenance)}.`,
  };
}

function currentFixture(data: CanonicalResponse): FixtureId {
  const match = Object.entries(fixtures).find(([, fixture]) => fixture.fixture_id === data.fixture_id);
  return match ? match[0] as FixtureId : "standard";
}
