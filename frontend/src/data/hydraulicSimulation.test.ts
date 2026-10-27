import { describe, expect, it } from "vitest";
import {
  ALLOWED_HYDRAULIC_ACTIONS,
  HYDRAULIC_CONDITIONS,
  explainHydraulicResult,
  loadingState,
  parseBobHydraulicAction,
  runHydraulicSimulation,
} from "./hydraulicSimulation";
import { COMPONENT_INTELLIGENCE, EDGE_INTELLIGENCE } from "./componentIntelligence";
import { SCENARIOS } from "./simulationScenarios";
import { fixtures } from "./mockCanonicalResponse";

describe("P1 five conditions", () => {
  it("exposes exactly the five required rainfall conditions", () => {
    expect(SCENARIOS.map((s) => s.label)).toEqual([
      "Normal Rainfall",
      "Heavy Storm",
      "Flooding",
      "Extreme Rainfall",
      "Cloudburst / Peak Event",
    ]);
    expect(Object.keys(HYDRAULIC_CONDITIONS)).toHaveLength(5);
  });
});

describe("P2 hydraulic simulation", () => {
  it("is deterministic and preserves canonical topology", () => {
    const edgesBefore = structuredClone(EDGE_INTELLIGENCE);
    const compsBefore = structuredClone(COMPONENT_INTELLIGENCE);
    const a = runHydraulicSimulation({ condition: "cloudburst" });
    const b = runHydraulicSimulation({ condition: "cloudburst" });
    expect(a.edges).toEqual(b.edges);
    expect(a.baseline_mutated).toBe(false);
    expect(EDGE_INTELLIGENCE).toEqual(edgesBefore);
    expect(COMPONENT_INTELLIGENCE).toEqual(compsBefore);
  });

  it("maps loading ratios to green/amber/red/blinking_red and grey on failure", () => {
    expect(loadingState(0.5)).toBe("green");
    expect(loadingState(0.8)).toBe("amber");
    expect(loadingState(0.95)).toBe("red");
    expect(loadingState(1.2)).toBe("blinking_red");
    const cloud = runHydraulicSimulation({ condition: "cloudburst" });
    const overloaded = cloud.edges.filter((e) => e.loading_ratio > 1);
    expect(overloaded.length).toBeGreaterThan(0);
    for (const edge of overloaded) {
      expect(edge.state).toBe("grey");
      expect(edge.state_sequence).toContain("blinking_red");
      expect(edge.state_sequence).toContain("grey");
    }
  });

  it("produces different network loading across conditions", () => {
    const normal = runHydraulicSimulation({ condition: "normal_rainfall" });
    const cloud = runHydraulicSimulation({ condition: "cloudburst" });
    expect(normal.max_loading_ratio).toBeLessThan(cloud.max_loading_ratio);
  });
});

describe("P3 sensor confidence", () => {
  it("populates confidence for all canonical components", () => {
    const result = runHydraulicSimulation({ condition: "normal_rainfall" });
    for (const id of ["C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"]) {
      const sensor = result.sensors.find((s) => s.node_id === id);
      expect(sensor?.confidence).not.toBeNull();
      expect(sensor?.confidence).toBeTypeOf("number");
    }
    expect(result.sensors.find((s) => s.node_id === "J3")?.confidence).toBe(0.94);
    const fixtureSensors = fixtures.standard.sensors;
    for (const id of ["C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"]) {
      expect(fixtureSensors.find((s) => s.node_id === id)?.confidence).not.toBeNull();
    }
  });
});

describe("P4 Bob what-if actions", () => {
  it("parses allowlisted structured actions from natural language", () => {
    const cases: Array<[string, string]> = [
      ["What if all flow from L1 is diverted to L2?", "reroute_flow"],
      ["What if E-J3-L2 is removed?", "disable_edge"],
      ["Can this pipe handle the cloudburst?", "stress_edge"],
      ["What happens if L2 becomes unavailable?", "disable_component"],
      ["What if 70% of J3 flow goes through L2?", "change_flow_split"],
      ["What happens under extreme rainfall?", "run_condition"],
    ];
    for (const [message, action] of cases) {
      const parsed = parseBobHydraulicAction(message);
      expect(parsed?.action, message).toBe(action);
      expect(ALLOWED_HYDRAULIC_ACTIONS).toContain(parsed!.action);
    }
  });

  it("reroutes, disables, and resets without mutating baseline", () => {
    const baselineEdges = structuredClone(EDGE_INTELLIGENCE);
    const reroute = runHydraulicSimulation({
      condition: "heavy_storm",
      action: "reroute_flow",
      parameters: { from: "L1", to: "L2", percentage: 100 },
    });
    expect(reroute.edges.find((e) => e.edge_id === "E-J3-L1")?.flow_m3_s).toBe(0);
    expect(reroute.what_if).toBe(true);

    const disabled = runHydraulicSimulation({
      condition: "heavy_storm",
      action: "disable_edge",
      parameters: { edge_id: "E-J3-L2" },
    });
    expect(disabled.edges.find((e) => e.edge_id === "E-J3-L2")?.state).toBe("grey");

    const reset = runHydraulicSimulation({ action: "reset" });
    expect(reset.condition_id).toBe("normal_rainfall");
    expect(reset.what_if).toBe(false);
    expect(EDGE_INTELLIGENCE).toEqual(baselineEdges);
  });

  it("Bob explanation uses only simulation numbers", () => {
    const sim = runHydraulicSimulation({ condition: "extreme_rainfall", action: "run_condition" });
    const text = explainHydraulicResult(sim, "Test extreme rainfall");
    expect(text).toContain("WHAT I UNDERSTAND");
    expect(text).toContain("SIMULATION");
    expect(text).toContain("RESULT");
    expect(text).toContain(String(sim.max_loading_ratio));
    expect(text).toContain("baseline_mutated: false");
  });

  it("visual payload includes edge and node hydraulic states", () => {
    const sim = runHydraulicSimulation({ condition: "flooding" });
    expect(Object.keys(sim.visual.edgeStates).length).toBe(8);
    expect(sim.visual.scenarioId).toContain("FLOODING");
  });
});
