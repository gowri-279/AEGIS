import type { CanonicalResponse } from "./types";
import { mockBudgetLabel, type BobDecision } from "./bobInterventions";
import { display, recommendationLabel, resolveTarget } from "@/lib/aegis";

/** Presentation-only action record: preserves the supplied evaluation, including
 * abstention and infeasibility. Never selects a new candidate or asserts safety. */
export function simulationPlan(data: CanonicalResponse, scenarioOptionId: string, createdAt: string): BobDecision | null {
  const recommendation = data.recommendation;
  const candidate = data.candidates.find((item) => item.id === recommendation.selected_candidate_id);
  const target = candidate?.node_id ?? (data.risks[0] ? resolveTarget(data, data.risks[0].target_id) : data.candidates.find((item) => item.constraints.some((rule) => rule.status === "fail"))?.node_id);
  if (!target) return null;
  const status = recommendationLabel[recommendation.recommendation_status];
  const sim = data.simulation;
  return {
    id: `sim:${scenarioOptionId}:${data.fixture_id}:${candidate?.id ?? recommendation.recommendation_status}`,
    componentId: target,
    problem: `${data.fixture_label} · ${candidate?.id ?? status}`,
    intervention: candidate
      ? `Implement recommended ${candidate.kind} candidate ${candidate.id} at ${candidate.node_id}`
      : `${status}: ${recommendation.rationale.join(" ")}`,
    outcome: `Supplied simulation ${sim.scenario_id}: diverted volume ${display(sim.diverted_volume_m3)} m³ over ${display(sim.duration_s)} s at ${display(sim.proposed_flow_m3s)} m³/s. ${status}. ${recommendation.rationale.join(" ")}`,
    steps: [
      ...(candidate ? [`Assess the recommended option: ${candidate.kind} candidate ${candidate.id} at ${candidate.node_id}.`] : recommendation.rationale.map((reason) => `Review supplied decision basis: ${reason}`)),
      "Obtain source observations and an engineering design assessment.",
      "Re-run the scenario with validated intervention parameters.",
      ...recommendation.uncertainty.map((item) => `Verify uncertainty: ${item}`),
      "Verify storage constraints and downstream capacity at J4 and O1.",
      "Submit for implementation review; no physical work is authorized by this demo.",
    ],
    status: "Approved · pending", createdAt, doneSteps: [], source: "mock", priority: false,
    budget: mockBudgetLabel(candidate ? candidate.kind === "storage" ? "INCREASE_STORAGE" : "INCREASE_CONVEYANCE" : "NO_ACTION"),
    simulationEvidence: { scenarioOptionId, response: structuredClone(data) },
  };
}