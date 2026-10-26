import { describe, expect, it } from "vitest";
import type { Network, NetworkNode } from "@/data/types";
import { fixtures } from "@/data/mockCanonicalResponse";
import {
  routeMembership,
  spatialLayout,
  spatialNodeTone,
  structureRole,
} from "@/components/aegis/workspace/spatialPresentation";

const node = (id: string, type: string): NetworkNode => ({
  id,
  type: type as NetworkNode["type"],
  label: id,
  sensor_ids: [],
  attributes: {},
});
const network: Network = {
  network_id: "eight-node-presentation-test",
  nodes: [
    node("C1", "collection_inlet"),
    node("C2", "collection_inlet"),
    node("J3", "junction"),
    node("L1", "storage"),
    node("R1", "recharge"),
    node("L2", "storage"),
    node("J4", "junction"),
    node("O1", "outlet"),
  ],
  edges: [
    ["C1", "J3"],
    ["C2", "J3"],
    ["J3", "L1"],
    ["J3", "R1"],
    ["J3", "L2"],
    ["L1", "J4"],
    ["L2", "J4"],
    ["J4", "O1"],
  ].map(([from, to], i) => ({ id: `e${i}`, from: from ?? "", to: to ?? "" })),
};

describe("spatial presentation remains graph-driven", () => {
  it("supports the requested eight-node collection-to-outlet topology", () => {
    const layout = spatialLayout(network);
    expect(Object.keys(layout.nodes)).toHaveLength(8);
    expect(layout.edges).toHaveLength(8);
    for (const edge of network.edges) {
      expect(layout.nodes[edge.from]?.x).toBeLessThan(layout.nodes[edge.to]?.x ?? -Infinity);
    }
    expect(structureRole(network.nodes[0] ?? node("", ""), network)).toBe("inlet");
    expect(structureRole(network.nodes[6] ?? node("", ""), network)).toBe("downstream");
    expect(structureRole(network.nodes[7] ?? node("", ""), network)).toBe("outlet");
  });
  it("assigns the same structural roles with unrelated IDs", () => {
    const renamed = {
      ...network,
      nodes: network.nodes.map((n) => ({ ...n, id: `x-${n.id}` })),
      edges: network.edges.map((e) => ({ ...e, from: `x-${e.from}`, to: `x-${e.to}` })),
    };
    expect(renamed.nodes.map((n) => structureRole(n, renamed))).toEqual([
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
  it("renders only supplied nodes even when a response contains the original four-node graph", () => {
    const original = {
      ...fixtures.standard.network,
      nodes: fixtures.standard.network.nodes.filter((n) => ["J3", "L1", "L2", "R1"].includes(n.id)),
      edges: fixtures.standard.network.edges.filter((e) => e.from === "J3"),
    };
    expect(Object.keys(spatialLayout(original).nodes).sort()).toEqual(["J3", "L1", "L2", "R1"]);
  });
});

describe("spatial overlays use canonical outcomes", () => {
  it("highlights only the canonical recommended edge", () => {
    expect([...routeMembership(fixtures.standard).edges]).toEqual(["E-J3-L2"]);
  });
  it("never highlights a recommendation when the response abstains", () => {
    expect([...routeMembership(fixtures.critical_stale).edges]).toEqual([]);
    expect([...routeMembership(fixtures.critical_stale).nodes]).toEqual([]);
  });
  it("keeps not-determined feasibility unknown rather than failed", () => {
    const candidateNode = fixtures.critical_stale.network.nodes.find((n) => n.id === "L2");
    expect(candidateNode).toBeDefined();
    if (!candidateNode) return;
    expect(spatialNodeTone(fixtures.critical_stale, candidateNode, "simulate", false)).toBe(
      "unknown",
    );
  });
});
