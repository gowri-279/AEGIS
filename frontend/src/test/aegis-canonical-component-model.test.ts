import { describe, expect, it } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { mockHealthFindings } from "@/data/mockHealthFindings";
import {
  CANONICAL_COMPONENT_IDS,
  CANONICAL_EDGE_IDS,
  COMPONENT_INTELLIGENCE,
  EDGE_INTELLIGENCE,
  resolveComponentProfile,
} from "@/data/componentIntelligence";
import { createHealthBobContext } from "@/data/healthBob";

const data = { ...fixtures.standard, risks: mockHealthFindings("standard") };

describe("canonical component model", () => {
  it("covers all 8 nodes with correct types", () => {
    expect([...CANONICAL_COMPONENT_IDS]).toEqual(["C1", "C2", "J3", "L1", "R1", "L2", "J4", "O1"]);
    expect(COMPONENT_INTELLIGENCE.C1?.component_type).toBe("collection_inlet");
    expect(COMPONENT_INTELLIGENCE.C2?.component_type).toBe("collection_inlet");
    expect(COMPONENT_INTELLIGENCE.J3?.component_type).toBe("junction");
    expect(COMPONENT_INTELLIGENCE.L1?.component_type).toBe("storage");
    expect(COMPONENT_INTELLIGENCE.R1?.component_type).toBe("recharge");
    expect(COMPONENT_INTELLIGENCE.L2?.component_type).toBe("storage");
    expect(COMPONENT_INTELLIGENCE.J4?.component_type).toBe("downstream_junction");
    expect(COMPONENT_INTELLIGENCE.O1?.component_type).toBe("outlet");
  });

  it("covers all canonical edges", () => {
    expect([...CANONICAL_EDGE_IDS]).toHaveLength(8);
    for (const id of CANONICAL_EDGE_IDS) expect(EDGE_INTELLIGENCE[id]?.edge_id).toBe(id);
  });

  it("resolves a distinct profile for each of the 8 nodes", () => {
    for (const id of CANONICAL_COMPONENT_IDS) {
      const profile = resolveComponentProfile(data, id);
      expect(profile?.component_id).toBe(id);
      expect(profile?.name).toContain(id);
      expect(profile?.operational.length).toBeGreaterThan(0);
    }
  });

  it("does not show L1 data when another component is selected", () => {
    const l2 = resolveComponentProfile(data, "L2");
    expect(l2?.component_id).toBe("L2");
    expect(l2?.operational.some((row) => row.label === "Available Storage" && row.value === "800")).toBe(true);
    expect(l2?.name).not.toContain("L1");
    expect(JSON.stringify(l2)).not.toContain("Limited storage at L1");
  });

  it("shows L2-specific storage and stale sensor context", () => {
    const l2 = resolveComponentProfile(data, "L2")!;
    expect(l2.intel.available_storage_m3).toBe(800);
    expect(l2.sensors.some((s) => s.detail.toLowerCase().includes("stale"))).toBe(true);
    expect(l2.intervention?.candidate_id).toBe("C-L2");
  });

  it("shows J3 water-depth and WL-J3 sensor data", () => {
    const j3 = resolveComponentProfile(data, "J3")!;
    expect(j3.operational.some((row) => row.label === "Water Depth")).toBe(true);
    expect(j3.sensors.some((s) => s.id === "WL-J3")).toBe(true);
    expect(j3.intel.sensor_confidence).toBe(0.94);
  });

  it("shows C1/C2 collection-inlet flow information", () => {
    const c1 = resolveComponentProfile(data, "C1")!;
    const c2 = resolveComponentProfile(data, "C2")!;
    expect(c1.component_type).toBe("collection_inlet");
    expect(c2.component_type).toBe("collection_inlet");
    expect(c1.operational.some((row) => row.label === "Observed Flow")).toBe(true);
    expect(c2.operational.some((row) => row.label === "Flow Capacity")).toBe(true);
  });

  it("shows R1 recharge-specific information", () => {
    const r1 = resolveComponentProfile(data, "R1")!;
    expect(r1.operational.some((row) => row.label === "Recharge Eligibility")).toBe(true);
    expect(r1.intervention?.feasibility.toLowerCase()).toContain("ineligible");
  });

  it("shows J4 downstream-junction and O1 outlet information", () => {
    const j4 = resolveComponentProfile(data, "J4")!;
    const o1 = resolveComponentProfile(data, "O1")!;
    expect(j4.operational.some((row) => /Combined Flow/i.test(row.label))).toBe(true);
    expect(o1.operational.some((row) => /Discharge/i.test(row.label))).toBe(true);
  });

  it("preserves L1 health/problem behavior", () => {
    const l1 = resolveComponentProfile(data, "L1")!;
    expect(l1.operational.some((row) => row.label === "Available Storage" && row.value === "100")).toBe(true);
    expect(l1.risks.some((r) => /Limited storage/i.test(r.title) && r.severity === "low")).toBe(true);
    expect(l1.intervention?.candidate_id).toBe("C-L1");
    expect(l1.intervention?.feasibility).toBe("Infeasible");
  });

  it("gives Monitor Bob structured selected-component + neighbor context", () => {
    const node = data.network.nodes.find((n) => n.id === "L2")!;
    const finding = data.risks.find((r) => r.target_id === "L2")!;
    const ctx = createHealthBobContext(data, node, finding);
    expect(ctx.component_profile?.component_id).toBe("L2");
    expect(ctx.component_intelligence?.available_storage_m3).toBe(800);
    expect(ctx.related_edges.length).toBeGreaterThan(0);
    expect(ctx.neighbor_components.upstream.some((c) => c.component_id === "J3")).toBe(true);
    expect(ctx.neighbor_components.downstream.some((c) => c.component_id === "J4")).toBe(true);
    expect(ctx.topology_path).toContain("L2");
  });

  it("is deterministic across repeated lookups", () => {
    const a = resolveComponentProfile(data, "J3");
    const b = resolveComponentProfile(data, "J3");
    expect(a).toEqual(b);
  });
});

describe("Network Health / Action Plan UI cleanup", () => {
  it("Review panel source no longer includes Uncertainty or Approximate Implementation Budget sections", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(path.resolve(__dirname, "../components/aegis/workspace/ModePanels.tsx"), "utf8");
    expect(file).not.toMatch(/Section title="Uncertainty"/);
    expect(file).not.toMatch(/Approximate Implementation Budget/);
  });

  it("ComponentProfile source does not render Limitations / Uncertainty", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(path.resolve(__dirname, "../components/aegis/ComponentProfile.tsx"), "utf8");
    expect(file).not.toMatch(/Limitations \/ Uncertainty/);
  });
});
