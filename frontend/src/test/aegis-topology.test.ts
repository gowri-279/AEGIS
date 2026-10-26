import { describe, expect, it } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { spatialLayout, structureRole } from "@/components/aegis/workspace/spatialPresentation";
import { getCanonicalResponse, runScenario } from "@/services/api";

const ids = ["C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"];
const connections = ["C1→J3", "C2→J3", "J3→L1", "J3→R1", "J3→L2", "L1→J4", "L2→J4", "J4→O1"];

describe("approved synthetic network topology", () => {
  for (const [name, data] of Object.entries(fixtures)) {
    it(`${name} contains exactly the approved entities and connections`, () => {
      expect(data.network.nodes.map((n) => n.id)).toEqual(ids);
      expect(data.network.nodes.map((n) => n.type)).toEqual(["collection_inlet", "collection_inlet", "junction", "storage", "recharge", "storage", "downstream_junction", "outlet"]);
      expect(data.network.edges.map((e) => `${e.from}→${e.to}`)).toEqual(connections);
      expect(new Set(data.network.edges.map((e) => e.id)).size).toBe(8);
      const layout = spatialLayout(data.network);
      expect(Object.keys(layout.nodes)).toEqual(ids);
      expect(layout.edges).toHaveLength(8);
      for (const edge of data.network.edges) {
        expect(layout.nodes[edge.from]?.x).toBeLessThan(layout.nodes[edge.to]?.x ?? -Infinity);
      }
      expect(data.network.nodes.map((n) => structureRole(n, data.network))).toEqual(["inlet", "inlet", "junction", "storage", "recharge", "storage", "downstream", "outlet"]);
    });
  }
  it("preserves existing values without fabricating measurements for new structures", () => {
    const nodes = fixtures.standard.network.nodes;
    expect(nodes.find((n) => n.id === "L1")?.attributes["available_storage_m3"]).toBe(100);
    expect(nodes.find((n) => n.id === "L2")?.attributes["available_storage_m3"]).toBe(800);
    expect(nodes.find((n) => n.id === "R1")?.attributes["recharge_eligibility"]).toBe("ineligible");
    for (const id of ["C1", "C2", "J4", "O1"]) {
      const added = nodes.find((n) => n.id === id);
      expect(added?.attributes).toEqual({});
      expect(added?.sensor_ids).toEqual([]);
      expect(added?.candidate_id).toBeUndefined();
    }
    expect(fixtures.standard.candidates.map((c) => c.route_edge_ids)).toEqual([["E-J3-L1"], ["E-J3-R1"], ["E-J3-L2"]]);
  });
  it("delivers the same topology through the existing service boundary", async () => {
    const initial = await getCanonicalResponse();
    const scenario = await runScenario({ fixture: "stress" });
    expect(initial.network.nodes.map((n) => n.id)).toEqual(ids);
    expect(scenario.network).toEqual(initial.network);
    expect(scenario.recommendation.recommendation_status).toBe("no_feasible_candidate");
  });
});