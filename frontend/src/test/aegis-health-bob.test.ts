import { describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { mockHealthFindings } from "@/data/mockHealthFindings";
import { createHealthBobContext, mockHealthBobReply } from "@/data/healthBob";
import { getHealthBobReply } from "@/services/api";
import { CANONICAL_COMPONENT_IDS, COMPONENT_INTELLIGENCE } from "@/data/componentIntelligence";

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
    expect(c.component_intelligence?.component_id).toBe("J3");
    const reply = mockHealthBobReply({ context: c });
    expect(reply.source).toBe("deterministic");
    expect(reply.existing_problem).toContain("J3");
    expect(reply.text.toLowerCase()).not.toContain("authored");
    expect(reply.text.toLowerCase()).not.toContain("### uncertainty");
  });
  it("uses supplied L1 100 m³ and failed constraints without calculating feasibility", () => {
    const c = context("L1");
    expect(c.candidate?.available_storage_m3).toBe(100);
    expect(c.simulation.diverted_volume_m3).toBe(200);
    expect(c.candidate?.feasible).toBe(false);
    expect(c.downstream).toEqual(["J4"]);
    expect(c.component_intelligence?.observed_storage_m3).toBe(100);
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
  it("falls back without requiring a live backend", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("backend down"));
    try {
      for (const id of ["J3", "L1", "L2"]) {
        const reply = await getHealthBobReply({ context: context(id) });
        expect(reply.source).toBe("deterministic");
        expect(reply.existing_problem).toBeTruthy();
        expect(reply.text.toLowerCase()).not.toContain("fixed no-action demonstration");
      }
    } finally { fetchSpy.mockRestore(); }
  });
  it("exposes deterministic component intelligence for the canonical topology", () => {
    for (const id of CANONICAL_COMPONENT_IDS) {
      expect(COMPONENT_INTELLIGENCE[id]?.component_id).toBe(id);
    }
    expect(COMPONENT_INTELLIGENCE.L1?.observed_storage_m3).toBe(100);
    expect(COMPONENT_INTELLIGENCE.L1?.relevant_threshold?.limit).toBe(200);
  });
});
