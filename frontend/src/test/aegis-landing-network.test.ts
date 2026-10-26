import { describe, expect, it } from "vitest";
import { getLandingDemoModel } from "@/services/api";
import { fixtures } from "@/data/mockCanonicalResponse";

describe("Isolated landing demonstration", () => {
  it("attaches the authored attention compartment and sensor to existing demo components", () => {
    const { network, highlights } = getLandingDemoModel();
    expect(network.nodes.find((node) => node.id === highlights.compartmentId)?.type).toBe("storage");
    expect(highlights.sensorNodeId).toBe("J1");
    expect(network.nodes.find((node) => node.id === "J1")?.type).toBe("junction");
    expect(network.nodes.map((node) => node.id)).toEqual(["C1", "C2", "C3", "J1", "J2", "L1", "R1", "J3", "O1"]);
  });
  it("uses a different structured network from Monitor without invented readings", () => {
    const { network } = getLandingDemoModel();
    expect(network).not.toBe(fixtures.standard.network);
    expect(network.edges.map((edge) => `${edge.from}->${edge.to}`)).not.toEqual(fixtures.standard.network.edges.map((edge) => `${edge.from}->${edge.to}`));
    expect(new Set(network.nodes.map((node) => node.type))).toEqual(new Set(["collection_inlet", "junction", "storage", "recharge", "downstream_junction", "outlet"]));
    expect(network.nodes.every((node) => node.sensor_ids.length === 0 && Object.keys(node.attributes).length === 0)).toBe(true);
  });

  it("authors flow only on actual demo connections and stops at recharge", () => {
    const { network, flowStages } = getLandingDemoModel();
    const ids = new Set(network.nodes.map((node) => node.id));
    expect(network.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
    expect(Object.keys(flowStages).sort()).toEqual(network.edges.map((edge) => edge.id).sort());
    const rechargeIds = new Set(network.nodes.filter((node) => node.type === "recharge").map((node) => node.id));
    expect(network.edges.some((edge) => rechargeIds.has(edge.to))).toBe(true);
    expect(network.edges.some((edge) => rechargeIds.has(edge.from))).toBe(false);
  });
});