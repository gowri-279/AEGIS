import type { HealthBobContext } from "./healthBob";
import type { CanonicalResponse, Severity } from "./types";

export type BobScenarioId = "BASELINE" | "NO_ACTION" | "REROUTE_L1" | "REROUTE_L2" | "INCREASE_CONVEYANCE" | "ADD_PIPE" | "REPLACE_PIPE" | "INCREASE_STORAGE" | "DOWNSTREAM_REDESIGN";
export interface BobVisualScenario {
  scenarioId: string;
  edgeStages: Record<string, number>;
  nodeStates: Record<string, { severity: Severity; storageLevel?: "raised" | "settled" }>;
  running: boolean;
  revision: number;
}
export interface BobScenarioResult {
  source: "mock";
  scenarioId: BobScenarioId;
  title: string;
  explanation: string;
  consequences: string[];
  intervention: string;
  steps: string[];
  supported: boolean;
  visual: Omit<BobVisualScenario, "running" | "revision">;
}
export interface BobDecision {
  id: string;
  componentId: string;
  problem: string;
  intervention: string;
  outcome: string;
  steps: string[];
  /** Session-only action plan: pending until the authority completes every action in Review. */
  status: "Approved · pending" | "Completed · resolved";
  createdAt: string;
  doneSteps: number[];
  source: "mock";
  /** Health-generated plans are priority; simulation-generated plans are normal. */
  priority: boolean;
  /** Immutable supplied evaluation captured when a simulation plan is accepted. */
  simulationEvidence?: { scenarioOptionId: string; response: CanonicalResponse };
  /** Mock illustrative budget label for the proposed intervention — synthetic
   *  presentation data only, never a quotation or validated engineering cost. */
  budget?: string;
}

/** Mock illustrative budget ranges (₹ lakh) per intervention family. Purely
 *  synthetic demo data tied to the intervention type, not an engineering estimate. */
const MOCK_BUDGET_LAKH: Partial<Record<BobScenarioId, [number, number]>> = {
  REROUTE_L1: [12, 18],
  REROUTE_L2: [14, 22],
  INCREASE_CONVEYANCE: [18, 30],
  ADD_PIPE: [25, 40],
  REPLACE_PIPE: [20, 35],
  INCREASE_STORAGE: [30, 55],
  DOWNSTREAM_REDESIGN: [35, 60],
};
export function mockBudgetLabel(scenarioId: BobScenarioId): string {
  const range = MOCK_BUDGET_LAKH[scenarioId];
  return range ? `₹${range[0]}–${range[1]} lakh · illustrative estimate` : "Not estimable from the supplied response · illustrative";
}

export function bobProblemTitle(context: HealthBobContext) {
  if (context.finding.category === "hydraulic_overload") return "Hydraulic Pressure Overload";
  if (context.finding.category === "overflow") return "Overflow Risk";
  if (context.finding.category === "bottleneck") return "Limited Storage";
  return context.finding.title;
}

export function proposedBobScenario(context: HealthBobContext): BobScenarioId {
  return context.finding.category === "bottleneck" ? "INCREASE_STORAGE" : context.finding.category === "overflow" ? "DOWNSTREAM_REDESIGN" : "INCREASE_CONVEYANCE";
}

export function bobQuestionIntent(question: string): BobScenarioId | "approve" | "evidence" {
  const q = question.trim().toLowerCase();
  if (/\b(implement this|approve this|let'?s implement|use this solution|go with this|approve)\b/.test(q)) return "approve";
  if (/increase.*(storage|capacity.*l1|capacity.*l2|l1.*capacity|l2.*capacity)|expand.*(storage|l1|l2)|storage expansion/.test(q)) return "INCREASE_STORAGE";
  if (/parallel|additional pipe|add.*(pipe|conduit)/.test(q)) return "ADD_PIPE";
  if (/replace.*(pipe|conduit)|pipe replacement/.test(q)) return "REPLACE_PIPE";
  if (/redesign|downstream.*upgrade/.test(q)) return "DOWNSTREAM_REDESIGN";
  if (/conveyance/.test(q)) return "INCREASE_CONVEYANCE";
  if (/\b(divert|rerout|route|branch)/.test(q) && /\bl1\b/.test(q)) return "REROUTE_L1";
  if (/\b(divert|rerout|route|branch)/.test(q) && /\bl2\b/.test(q)) return "REROUTE_L2";
  if (/nothing|no action|inflow|rain|flow condition/.test(q)) return "NO_ACTION";
  return "evidence";
}

/** Fixed demonstration fixtures, NOT a hydraulic engine. All outcomes are authored,
 * unitless visual states, kept separate from canonical measurements and feasibility. */
export function mockBobScenario(context: HealthBobContext, scenarioId: BobScenarioId): BobScenarioResult {
  const nodeId = context.node.id;
  const branch = scenarioId === "REROUTE_L1" ? "L1" : scenarioId === "REROUTE_L2" ? "L2" : null;
  const candidate = context.candidates.find((item) => item.node_id === branch);
  const unknown = context.recommendation.recommendation_status === "abstained" || context.candidates.some((item) => item.feasible === null);
  const intervention = {
    BASELINE: "Baseline network demonstration",
    NO_ACTION: "Retain the existing configuration",
    REROUTE_L1: "Explore diversion toward L1",
    REROUTE_L2: "Explore diversion toward L2",
    INCREASE_CONVEYANCE: `Review downstream conveyance at ${nodeId}`,
    ADD_PIPE: `Assess parallel conveyance downstream of ${nodeId}`,
    REPLACE_PIPE: `Assess conduit replacement near ${nodeId}`,
    INCREASE_STORAGE: `Assess storage expansion at ${context.node.type === "storage" ? nodeId : "L1"}`,
    DOWNSTREAM_REDESIGN: `Review the ${nodeId} → J4 → O1 downstream connection`,
  }[scenarioId];
  const blocked = !!branch && (!candidate || !candidate.eligible || candidate.feasible !== true);
  const supported = !unknown && !blocked;
  const noAction = scenarioId === "NO_ACTION";
  const baseline = scenarioId === "BASELINE";
  const improved = supported && !noAction && !baseline;
  const storageTarget = scenarioId === "INCREASE_STORAGE" ? context.node.type === "storage" ? nodeId : "L1" : null;
  const affectedId = branch ?? storageTarget ?? nodeId;
  const nodeStates: BobVisualScenario["nodeStates"] = {};
  if (!unknown && !baseline) {
    nodeStates[affectedId] = {
      severity: improved ? "moderate" : "critical",
      ...(context.network.nodes.find((n) => n.id === affectedId)?.type === "storage" ? { storageLevel: improved ? "settled" as const : "raised" as const } : {}),
    };
  }
  // Lookup-only stages on current directed edges; no new/parallel geometry is added.
  const excluded = new Set(context.candidates.filter((c) => !c.eligible || c.feasible === null).map((c) => c.node_id));
  const edgeStages: Record<string, number> = {};
  if (!unknown) for (const edge of context.network.edges) {
    if (excluded.has(edge.to) || excluded.has(edge.from)) continue;
    if (context.network.nodes.find((n) => n.id === edge.from)?.type === "recharge") continue;
    if (branch && ((edge.from === "J3" && edge.to !== branch) || (["L1", "L2"].includes(edge.from) && edge.from !== branch))) continue;
    edgeStages[edge.id] = edge.from === "C1" || edge.from === "C2" ? 0 : edge.from === "J3" ? 1 : edge.from === "J4" ? 3 : 2;
  }
  const title = unknown ? "Outcome unavailable — observations require review" : blocked ? `${branch} remains constrained — not a preferred route` : baseline ? "Baseline demonstration" : noAction ? `${nodeId}: unresolved loading demonstration` : `${affectedId}: illustrative risk reduced to Moderate`;
  const explanation = unknown
    ? "The supplied response abstains or leaves feasibility undetermined. Bob cannot assert an intervention outcome. Obtain reliable observations first."
    : blocked ? `The supplied ${branch} candidate is ineligible, infeasible or undetermined. Additional diversion does not resolve that constraint; this alternative cannot be approved.`
    : noAction ? "This fixed no-action demonstration escalates the selected problem ring. It illustrates a possible consequence, not a measured breach or predicted hydraulic failure."
    : baseline ? "Existing topology and supplied constraints are unchanged."
    : "This authored intervention demonstration reduces the visual loading state. No new capacity, discharge, improvement percentage or engineering safety result is calculated. Physical additions are conceptual only; the approved topology is unchanged.";
  const consequences = unknown ? ["Engineering outcome is not available in the current model."] : blocked ? [`${branch} becomes the limiting branch in this mock alternative.`, "Canonical constraints remain unchanged."] : noAction ? ["The selected problem remains unresolved.", `${nodeId} shows critical loading in this demonstration only.`, "Downstream capacity and real surcharge are not established."] : [title, "Canonical observations, findings and candidate feasibility remain unchanged."];
  return { source: "mock", scenarioId, title, explanation, consequences, intervention, supported,
    steps: [`Assess the proposed option: ${intervention}.`, "Obtain source observations and an engineering design assessment.", "Re-run the scenario with validated intervention parameters.", "Verify storage constraints and downstream capacity at J4 and O1.", "Submit for implementation review; no physical work is authorized by this demo."],
    visual: { scenarioId, edgeStages, nodeStates },
  };
}

export type BobPhase = "no-action" | "proposed" | "solution" | "result" | "conversation" | "plan" | "confirmed";
export type BobEvent = "NO_ACTION_DONE" | "RUN_SOLUTION" | "SOLUTION_DONE" | "MORE" | "APPROVE" | "CONFIRM" | "RETURN";
export function bobTransition(phase: BobPhase, event: BobEvent): BobPhase {
  if (phase === "no-action" && event === "NO_ACTION_DONE") return "proposed";
  if ((phase === "proposed" || phase === "result" || phase === "conversation") && event === "RUN_SOLUTION") return "solution";
  if (phase === "solution" && event === "SOLUTION_DONE") return "result";
  if (phase === "result" && event === "MORE") return "conversation";
  if (phase === "conversation" && event === "RETURN") return "result";
  if (phase === "result" && event === "APPROVE") return "plan";
  if (phase === "plan" && event === "CONFIRM") return "confirmed";
  return phase;
}