import { describe, expect, it } from "vitest";
import { fixtures } from "./mockCanonicalResponse";
import { simulationPlan } from "./simulationPlans";
import { resolvedSimulationResponse } from "./simulationResolution";

describe("Session simulation resolution", () => {
  const pending = simulationPlan(fixtures.stress, "heavy-rain", "2026-10-26T16:40:00Z");
  if (!pending) throw new Error("Expected supplied stress plan");
  const completed = { ...pending, status: "Completed · resolved" as const, doneSteps: pending.steps.map((_, i) => i) };
  it("preserves the prior issue until its plan is fully completed", () => {
    expect(resolvedSimulationResponse(fixtures.stress, "heavy-rain", [pending])).toBe(fixtures.stress);
  });
  it("returns positive mock feasibility on a rerun of the completed scenario", () => {
    const result = resolvedSimulationResponse(fixtures.stress, "heavy-rain", [completed]);
    expect(result.simulation.session_resolution).toEqual({ plan_id: completed.id, status: "feasible" });
    expect(result.candidates.every((candidate) => candidate.feasible === true)).toBe(true);
    expect(result.risks).toEqual([]);
    expect(result.candidates.flatMap((candidate) => candidate.constraints)).toEqual([]);
    expect(result.simulation.diverted_volume_m3).toBe(900);
    expect(fixtures.stress.candidates.find((candidate) => candidate.id === "C-L2")?.feasible).toBe(false);
    expect(completed.simulationEvidence?.response.simulation.session_resolution).toBeUndefined();
  });
  it("does not resolve a different scenario sharing the same fixture", () => {
    expect(resolvedSimulationResponse(fixtures.stress, "flooding", [completed])).toBe(fixtures.stress);
  });
  it("does not resolve a different fixture or another network without that plan", () => {
    expect(resolvedSimulationResponse(fixtures.standard, "heavy-rain", [completed])).toBe(fixtures.standard);
    expect(resolvedSimulationResponse(fixtures.stress, "heavy-rain", [])).toBe(fixtures.stress);
  });
});