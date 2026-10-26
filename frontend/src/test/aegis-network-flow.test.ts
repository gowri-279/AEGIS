import { describe, expect, it } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import {
  NETWORK_FLOW_HOP_SECONDS,
  networkFlowPlan,
} from "@/components/aegis/workspace/networkFlowPresentation";
import { flowPulseProgress } from "@/components/aegis/workspace/simulationFlowPresentation";

describe("normal Network illustrative water", () => {
  it("splits C1/C2 through J3 to L1/L2, merges at J4 and exits O1 on existing directed edges", () => {
    expect([...networkFlowPlan(fixtures.standard)]).toEqual([
      ["E-C1-J3", 0],
      ["E-C2-J3", 0],
      ["E-J3-L1", 1],
      ["E-J3-L2", 1],
      ["E-L1-J4", 2],
      ["E-L2-J4", 2],
      ["E-J4-O1", 3],
    ]);
  });
  it("does not imply successful routing through ineligible R1", () => {
    expect(networkFlowPlan(fixtures.standard).has("E-J3-R1")).toBe(false);
    const data = {
      ...fixtures.standard,
      candidates: fixtures.standard.candidates.filter((c) => c.node_id !== "R1"),
    };
    expect(networkFlowPlan(data).has("E-J3-R1")).toBe(false);
  });
  it("ends at recharge if supplied eligibility becomes available without adding downstream flow", () => {
    const data = {
      ...fixtures.standard,
      candidates: fixtures.standard.candidates.map((c) => ({ ...c, eligible: true })),
      network: {
        ...fixtures.standard.network,
        nodes: fixtures.standard.network.nodes.map((n) =>
          n.id === "R1" ? { ...n, attributes: {} } : n,
        ),
        edges: [...fixtures.standard.network.edges, { id: "R1-OUT", from: "R1", to: "J4" }],
      },
    };
    expect(networkFlowPlan(data).get("E-J3-R1")).toBe(1);
    expect(networkFlowPlan(data).has("R1-OUT")).toBe(false);
  });
  it("does not turn scenario feasibility or not-evaluated into operational routing status", () => {
    expect(networkFlowPlan(fixtures.standard).has("E-J3-L1")).toBe(true);
    expect([...networkFlowPlan(fixtures.critical_stale)]).toEqual([
      ...networkFlowPlan(fixtures.standard),
    ]);
    expect([...networkFlowPlan(fixtures.stress)]).toEqual([...networkFlowPlan(fixtures.standard)]);
  });
  it("moves forward one hop at a time using a fixed illustrative cadence", () => {
    expect(flowPulseProgress(0.55, 0, 3, NETWORK_FLOW_HOP_SECONDS)).toBeCloseTo(0.5);
    expect(flowPulseProgress(0.55, 1, 3, NETWORK_FLOW_HOP_SECONDS)).toBeNull();
    expect(flowPulseProgress(3.85, 3, 3, NETWORK_FLOW_HOP_SECONDS)).toBeCloseTo(0.5);
  });
  it("only starts from supplied collection inlets, without altering canonical data", () => {
    const before = JSON.stringify(fixtures.standard);
    networkFlowPlan(fixtures.standard);
    expect(JSON.stringify(fixtures.standard)).toBe(before);
    expect(
      networkFlowPlan({
        ...fixtures.standard,
        network: {
          ...fixtures.standard.network,
          nodes: fixtures.standard.network.nodes.filter((n) => n.type !== "collection_inlet"),
        },
      }).size,
    ).toBe(0);
  });
});
