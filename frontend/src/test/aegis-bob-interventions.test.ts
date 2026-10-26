import { describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { mockHealthFindings } from "@/data/mockHealthFindings";
import { createHealthBobContext } from "@/data/healthBob";
import { bobQuestionIntent, bobTransition, mockBobScenario } from "@/data/bobInterventions";
import { runBobScenario } from "@/services/api";
function context(id: string) {
  const data = { ...fixtures.standard, risks: mockHealthFindings("standard") };
  const node = data.network.nodes.find((n) => n.id === id);
  const finding = data.risks.find((r) => r.target_id === id);
  if (!node || !finding) throw new Error("Missing context");
  return createHealthBobContext(data, node, finding);
}
describe("Bob deterministic demonstration rules", () => {
  it("uses only existing directed edges and never routes the ineligible R1 to J4", () => {
    const c = context("J3");
    for (const scenario of ["NO_ACTION", "REROUTE_L1", "REROUTE_L2", "ADD_PIPE"] as const) {
      const result = mockBobScenario(c, scenario);
      expect(
        Object.keys(result.visual.edgeStages).every((id) =>
          c.network.edges.some((edge) => edge.id === id),
        ),
      ).toBe(true);
      expect(result.visual.edgeStages).not.toHaveProperty("E-J3-R1");
      expect(result.visual.edgeStages).not.toHaveProperty("E-R1-J4");
    }
  });
  it("routing more to L1 preserves its 100 m³ and infeasibility rather than reducing loading", () => {
    const c = context("L1");
    const before = JSON.stringify(c);
    const result = mockBobScenario(c, "REROUTE_L1");
    expect(result.supported).toBe(false);
    expect(result.visual.nodeStates["L1"]?.severity).toBe("critical");
    expect(c.candidate?.available_storage_m3).toBe(100);
    expect(c.candidate?.feasible).toBe(false);
    expect(JSON.stringify(c)).toBe(before);
  });
  it("authored storage expansion improves only demonstration state, not canonical feasibility", () => {
    const c = context("L1");
    const result = mockBobScenario(c, "INCREASE_STORAGE");
    expect(result.visual.nodeStates["L1"]).toEqual({
      severity: "moderate",
      storageLevel: "settled",
    });
    expect(c.candidate?.feasible).toBe(false);
    expect(c.candidate?.available_storage_m3).toBe(100);
  });
  it("keeps L2 overflow measurements unknown and canonical 800 m³ unchanged", () => {
    const c = context("L2");
    mockBobScenario(c, "NO_ACTION");
    mockBobScenario(c, "DOWNSTREAM_REDESIGN");
    expect(c.finding.observed_value).toBeNull();
    expect(c.finding.threshold).toBeNull();
    expect(c.candidate?.available_storage_m3).toBe(800);
  });
  it("never asserts an improved outcome when feasibility is undetermined", () => {
    const c = context("J3");
    const unknown = {
      ...c,
      candidates: c.candidates.map((candidate) => ({ ...candidate, feasible: null })),
    };
    const result = mockBobScenario(unknown, "INCREASE_CONVEYANCE");
    expect(result.supported).toBe(false);
    expect(result.visual.nodeStates).toEqual({});
    expect(result.visual.edgeStages).toEqual({});
  });
  it("returns the same outcome without external requests", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const c = context("J3");
    expect(await runBobScenario(c, "NO_ACTION")).toEqual(await runBobScenario(c, "NO_ACTION"));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("requires simulation then approval then confirmation; More does not approve", () => {
    expect(bobTransition("proposed", "APPROVE")).toBe("proposed");
    expect(bobTransition("result", "MORE")).toBe("conversation");
    expect(bobTransition("conversation", "RETURN")).toBe("result");
    expect(bobTransition("result", "CONFIRM")).toBe("result");
    expect(bobTransition("result", "APPROVE")).toBe("plan");
    expect(bobTransition("plan", "CONFIRM")).toBe("confirmed");
  });
  it("matches situation and approval intents deterministically", () => {
    expect(bobQuestionIntent("What if we divert the flow toward L1 instead?")).toBe("REROUTE_L1");
    expect(bobQuestionIntent("What if we increase L1 capacity?")).toBe("INCREASE_STORAGE");
    expect(bobQuestionIntent("let's implement this")).toBe("approve");
    expect(bobQuestionIntent("go with this")).toBe("approve");
  });
});
