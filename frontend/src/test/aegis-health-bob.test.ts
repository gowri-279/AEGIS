import { describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { mockHealthFindings } from "@/data/mockHealthFindings";
import { createHealthBobContext, mockHealthBobReply } from "@/data/healthBob";
import { getHealthBobReply } from "@/services/api";

function context(id: string) {
  const data = { ...fixtures.standard, risks: mockHealthFindings("standard") };
  const node = data.network.nodes.find((n) => n.id === id);
  const finding = data.risks.find((risk) => risk.target_id === id);
  if (!node || !finding) throw new Error("Missing test context");
  return createHealthBobContext(data, node, finding);
}

describe("synthetic-only Health Bob", () => {
  it("retains J3's supplied observation, threshold, confidence, sensor and directed neighbors", () => {
    const c = context("J3");
    expect(c.finding.observed_value).toBe(0.60);
    expect(c.finding.threshold).toBe(0.80);
    expect(c.finding.confidence).toBe(0.94);
    expect(c.sensors[0]?.id).toBe("WL-J3");
    expect(c.sensors[0]?.status).toBe("fresh");
    expect(c.upstream).toEqual(["C1", "C2"]);
    expect(c.downstream).toEqual(["L1", "R1", "L2"]);
    expect(mockHealthBobReply({ context: c }).source).toBe("mock");
  });
  it("uses supplied L1 100 m³ and failed constraints without calculating feasibility", () => {
    const c = context("L1");
    expect(c.candidate?.available_storage_m3).toBe(100);
    expect(c.simulation.diverted_volume_m3).toBe(200);
    expect(c.candidate?.feasible).toBe(false);
    expect(c.downstream).toEqual(["J4"]);
    const before = JSON.stringify(c);
    mockHealthBobReply({ context: c, question: "Explain the capacity" });
    expect(JSON.stringify(c)).toBe(before);
  });
  it("keeps L2 overflow values null independently of its supplied feasible candidate", () => {
    const c = context("L2");
    expect(c.finding.observed_value).toBeNull();
    expect(c.finding.threshold).toBeNull();
    expect(c.finding.confidence).toBeNull();
    expect(c.candidate?.available_storage_m3).toBe(800);
    expect(c.candidate?.feasible).toBe(true);
    expect(c.downstream).toEqual(["J4"]);
    expect(c.network.edges.some((edge) => edge.from === "R1" && edge.to === "J4")).toBe(false);
  });
  it("serves initial analysis and follow-ups without any external request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External calls forbidden"));
    try {
      for (const id of ["J3", "L1", "L2"]) {
        expect((await getHealthBobReply({ context: context(id) })).source).toBe("mock");
        expect((await getHealthBobReply({ context: context(id), question: "What should I check?" })).source).toBe("mock");
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});