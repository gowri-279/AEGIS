import type { CanonicalResponse } from "./types";
import type { BobDecision } from "./bobInterventions";

/** Authored session-only completion outcome, not a hydraulic re-evaluation.
 * Original quantities and immutable plan evidence remain baseline values. */
export function resolvedSimulationResponse(response: CanonicalResponse, scenarioOptionId: string, plans: BobDecision[]): CanonicalResponse {
  const plan = plans.find((item) => item.status === "Completed · resolved"
    && item.simulationEvidence?.scenarioOptionId === scenarioOptionId
    && item.simulationEvidence.response.fixture_id === response.fixture_id);
  if (!plan) return response;
  return {
    ...response,
    risks: [],
    candidates: response.candidates.filter((candidate) => candidate.eligible).map((candidate) => ({ ...candidate, feasible: true, constraints: [] })),
    simulation: { ...response.simulation, session_resolution: { plan_id: plan.id, status: "feasible" } },
    recommendation: { ...response.recommendation, recommendation_status: "recommended", selected_candidate_id: null,
      rationale: ["All conditions feasible in the session-only completion mock. The corresponding action plan is completed."], safety_qualified: false },
  };
}