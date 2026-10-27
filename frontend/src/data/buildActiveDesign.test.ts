import { describe, expect, it } from "vitest";
import { candidateDesign, placeComponent, WS_CANDIDATES } from "@/data/buildWorkspace";
import { reviewMetrics } from "@/data/buildReview";
import {
  addFinalizedBuildNetwork,
  getBuildDraft,
  getNetworkSession,
  saveBuildDraft,
} from "@/services/api";

describe("Build active design continuity", () => {
  it("selected candidate becomes the starting active design", () => {
    const design = candidateDesign("A", "redesign");
    expect(design.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["J3", "J5", "D01", "R01", "O1"]));
    expect(WS_CANDIDATES.find((c) => c.id === "A")!.metrics).toContainEqual(["Flood Risk", "-31%"]);
  });

  it("Apply Change / placement persists modifications into the draft", () => {
    let draft = getBuildDraft("redesign", "A");
    const placed = placeComponent(draft.design, "junction", 250, 300);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    draft = { ...draft, design: placed.design, revision: draft.revision + 1 };
    saveBuildDraft(draft);
    expect(getBuildDraft("redesign", "A").design.nodes.some((n) => n.id === placed.id)).toBe(true);
    expect(getBuildDraft("redesign", "A").revision).toBe(draft.revision);
  });

  it("simulation/review metrics stay bound to the candidate V2 values", () => {
    expect(reviewMetrics("A", 0)).toContainEqual(["Flood Risk", "−31%"]);
    expect(reviewMetrics("B", 0)).toContainEqual(["Flood Risk", "−21%"]);
    expect(reviewMetrics("C", 0)).toContainEqual(["Flood Risk", "−39%"]);
  });

  it("Engineering Review / finalization uses the applied active design", () => {
    const design = candidateDesign("A", "redesign");
    design.nodes = [...design.nodes, { id: "J9", kind: "junction", x: 250, y: 300, proposed: true, props: [], purpose: "Engineer add" }];
    const draft = { path: "redesign" as const, candidate: "A" as const, design, revision: 4, simulatedRevision: 4, notes: "Applied" };
    saveBuildDraft(draft);
    const entry = addFinalizedBuildNetwork(getBuildDraft("redesign", "A"), true, 0);
    expect(entry.response.network.nodes.some((n) => n.id === "J9")).toBe(true);
    expect(entry.design?.design.nodes.some((n) => n.id === "J9")).toBe(true);
  });

  it("New Network creates BLR-SYNTHETIC-02; Redesign preserves BLR-SYNTHETIC-01", () => {
    const prior = getNetworkSession().networks.find((n) => n.id === "BLR-SYNTHETIC-01");
    const created = addFinalizedBuildNetwork(
      { path: "new", candidate: "A", design: candidateDesign("A", "new"), revision: 1, simulatedRevision: 1, notes: "" },
      true,
      0,
    );
    expect(created.id).toBe("BLR-SYNTHETIC-02");
    const redesigned = addFinalizedBuildNetwork(
      { path: "redesign", candidate: "B", design: candidateDesign("B", "redesign"), revision: 1, simulatedRevision: 1, notes: "" },
      true,
      0,
    );
    expect(redesigned.id).toBe("BLR-SYNTHETIC-01");
    expect(getNetworkSession().networks.find((n) => n.id === "BLR-SYNTHETIC-01")).toBeTruthy();
    expect(prior?.id).toBe("BLR-SYNTHETIC-01");
  });

  it("existing V2 candidate parameters survive the Build flow", () => {
    const metrics = Object.fromEntries(WS_CANDIDATES.map((c) => [c.id, Object.fromEntries(c.metrics)]));
    expect(metrics.A["Flood Risk"]).toBe("-31%");
    expect(metrics.A["Downstream Load"]).toBe("-18%");
    expect(metrics.A["Lake Impact"]).toBe("Low");
    expect(metrics.A["Network Resilience"]).toBe("+24%");
    expect(metrics.A["Construction"]).toBe("Moderate");
    expect(metrics.B["Flood Risk"]).toBe("-21%");
    expect(metrics.C["Flood Risk"]).toBe("-39%");
    expect(metrics.C["Construction"]).toBe("High");
  });
});
