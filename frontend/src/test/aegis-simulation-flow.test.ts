import { describe, expect, it } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { flowPulseProgress, simulationFlowPlan } from "@/components/aegis/workspace/simulationFlowPresentation";

describe("illustrative directed simulation flow", () => {
  it("starts at C1/C2, branches at J3 and reaches J4/O1 on the eight existing edges", () => {
    expect([...simulationFlowPlan(fixtures.standard, "running")]).toEqual([
      ["E-C1-J3", 0], ["E-C2-J3", 0], ["E-J3-L1", 1], ["E-J3-R1", 1],
      ["E-J3-L2", 1], ["E-L1-J4", 2], ["E-L2-J4", 2], ["E-J4-O1", 3],
    ]);
  });
  it("uses the supplied L2 route after completion with connected inlet/outlet context", () => {
    expect([...simulationFlowPlan(fixtures.standard, "done").keys()]).toEqual([
      "E-C1-J3", "E-C2-J3", "E-J3-L2", "E-L2-J4", "E-J4-O1",
    ]);
  });
  it("terminates at recharge even if a future graph contains an outgoing recharge edge", () => {
    const data = { ...fixtures.standard, network: { ...fixtures.standard.network, edges: [
      ...fixtures.standard.network.edges, { id: "RECHARGE-OUT", from: "R1", to: "J4" },
    ] } };
    const plan = simulationFlowPlan(data, "running");
    expect(plan.has("E-J3-R1")).toBe(true);
    expect(plan.has("RECHARGE-OUT")).toBe(false);
  });
  it("does not animate idle, abstained or no-feasible completed results", () => {
    expect(simulationFlowPlan(fixtures.standard, "idle").size).toBe(0);
    expect(simulationFlowPlan(fixtures.critical_stale, "done").size).toBe(0);
    expect(simulationFlowPlan(fixtures.stress, "done").size).toBe(0);
  });
  it("does not substitute another feasible branch for a missing or ineligible selected route", () => {
    expect(simulationFlowPlan({ ...fixtures.standard, recommendation: {
      ...fixtures.standard.recommendation, selected_candidate_id: "MISSING",
    } }, "done").size).toBe(0);
    expect(simulationFlowPlan({ ...fixtures.standard, recommendation: {
      ...fixtures.standard.recommendation, selected_candidate_id: "C-R1",
    } }, "done").size).toBe(0);
  });
  it("travels before appearing on the next hop rather than animating every pipe together", () => {
    expect(flowPulseProgress(0.275, 0, 3)).toBeCloseTo(0.5);
    expect(flowPulseProgress(0.275, 1, 3)).toBeNull();
    expect(flowPulseProgress(0.825, 1, 3)).toBeCloseTo(0.5);
    expect(flowPulseProgress(0.825, 3, 3)).toBeNull();
  });
});