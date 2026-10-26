import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { spatialLayout, structureRole } from "@/components/aegis/workspace/spatialPresentation";
import { getCanonicalResponse, runScenario } from "@/services/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ids = ["C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"];
const connections = ["C1→J3", "C2→J3", "J3→L1", "J3→R1", "J3→L2", "L1→J4", "L2→J4", "J4→O1"];

describe("approved synthetic network topology", () => {
  for (const [name, data] of Object.entries(fixtures)) {
    it(`${name} contains exactly the approved entities and connections`, () => {
      expect(data.network.nodes.map((n) => n.id)).toEqual(ids);
      expect(data.network.nodes.map((n) => n.type)).toEqual([
        "collection_inlet",
        "collection_inlet",
        "junction",
        "storage",
        "recharge",
        "storage",
        "downstream_junction",
        "outlet",
      ]);
      expect(data.network.edges.map((e) => `${e.from}→${e.to}`)).toEqual(connections);
      expect(new Set(data.network.edges.map((e) => e.id)).size).toBe(8);
      const layout = spatialLayout(data.network);
      expect(Object.keys(layout.nodes)).toEqual(ids);
      expect(layout.edges).toHaveLength(8);
      for (const edge of data.network.edges) {
        expect(layout.nodes[edge.from]?.x).toBeLessThan(layout.nodes[edge.to]?.x ?? -Infinity);
      }
      expect(data.network.nodes.map((n) => structureRole(n, data.network))).toEqual([
        "inlet",
        "inlet",
        "junction",
        "storage",
        "recharge",
        "storage",
        "downstream",
        "outlet",
      ]);
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
    expect(fixtures.standard.candidates.map((c) => c.route_edge_ids)).toEqual([
      ["E-J3-L1"],
      ["E-J3-R1"],
      ["E-J3-L2"],
    ]);
  });
  it("delivers the same topology through the existing service boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            network: {
              network_id: fixtures.standard.network.network_id,
              nodes: fixtures.standard.network.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                ...node.attributes,
                sensor_ids: node.sensor_ids,
                ...(node.candidate_id ? { candidate_id: node.candidate_id } : {}),
              })),
              edges: fixtures.standard.network.edges,
            },
            network_state: { sensors: [] },
            assessed_state: { risk_findings: [] },
            scenario: { scenario_id: "standard", proposed_volume_m3: 200, duration_seconds: 600 },
            simulation_result: {
              scenario_id: "standard",
              proposed_volume_m3: 200,
              duration_seconds: 600,
              proposed_flow_m3_s: 1 / 3,
            },
            candidate_evaluations: [],
            ranking: [],
            recommendation: {
              recommendation_status: "recommended",
              selected_candidate_id: "C-L2",
              recommendation_scope: "limited_mvp_scope",
              safety_qualified: false,
              selection_basis: "sole_feasible_candidate",
              rationale: [],
              uncertainty: [],
              data_limitations: [],
              reason_codes: [],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            network: {
              network_id: fixtures.stress.network.network_id,
              nodes: fixtures.stress.network.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                ...node.attributes,
                sensor_ids: node.sensor_ids,
                ...(node.candidate_id ? { candidate_id: node.candidate_id } : {}),
              })),
              edges: fixtures.stress.network.edges,
            },
            network_state: { sensors: [] },
            assessed_state: { risk_findings: [] },
            scenario: { scenario_id: "stress", proposed_volume_m3: 900, duration_seconds: 600 },
            simulation_result: {
              scenario_id: "stress",
              proposed_volume_m3: 900,
              duration_seconds: 600,
              proposed_flow_m3_s: 1.5,
            },
            candidate_evaluations: [],
            ranking: [],
            recommendation: {
              recommendation_status: "no_feasible_candidate",
              selected_candidate_id: null,
              recommendation_scope: "limited_mvp_scope",
              safety_qualified: false,
              selection_basis: null,
              rationale: [],
              uncertainty: [],
              data_limitations: [],
              reason_codes: ["NO_FEASIBLE_CANDIDATE"],
            },
          }),
        }),
    );

    const initial = await getCanonicalResponse();
    const scenario = await runScenario({ fixture: "stress" });

    expect(initial.network.nodes.map((n) => n.id)).toEqual(ids);
    expect(scenario.network).toEqual(initial.network);
    expect(scenario.recommendation.recommendation_status).toBe("no_feasible_candidate");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
