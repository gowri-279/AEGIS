import { describe, expect, it } from "vitest";
import { candidateDesign } from "@/data/buildWorkspace";
import { fixtureStandard } from "@/data/mockCanonicalResponse";
import { layoutNetwork } from "@/data/networkLayout";
import { spatialLayout } from "@/components/aegis/workspace/spatialPresentation";
import { addFinalizedBuildNetwork, getBuildDraft, getNetworkSession, saveBuildDraft, selectSessionNetwork } from "@/services/api";

describe("Build to Monitor session handoff", () => {
  it("redesign updates BLR-SYNTHETIC-01 with real infrastructure, retaining baseline topology and exact presentation frame", () => {
    const baseline = structuredClone(fixtureStandard);
    const frame = layoutNetwork(fixtureStandard.network);
    const spatial = spatialLayout(fixtureStandard.network);
    const entry = addFinalizedBuildNetwork({ path: "redesign", candidate: "A", design: candidateDesign("A"), revision: 1, simulatedRevision: 1, notes: "Reviewed" }, true, 0);
    expect(entry.id).toBe("BLR-SYNTHETIC-01");
    expect(entry.status).toBe("Updated");
    expect(entry.response.network.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["C1", "C2", "J3", "L1", "L2", "R1", "J4", "O1", "J5", "D01", "R01"]));
    expect(entry.response.network.edges).toEqual(expect.arrayContaining(baseline.network.edges));
    expect(entry.response.network.edges).toContainEqual({ id: "P21", from: "J3", to: "J5" });
    const updatedFrame = layoutNetwork(entry.response.network);
    expect([updatedFrame.width, updatedFrame.height]).toEqual([frame.width, frame.height]);
    for (const n of baseline.network.nodes) expect(spatialLayout(entry.response.network).nodes[n.id]).toEqual(spatial.nodes[n.id]);
    expect(fixtureStandard).toEqual(baseline);
  });
  it("new design creates distinct BLR-SYNTHETIC-02 without overwriting 01 and switches active topology", () => {
    const previous = getNetworkSession().networks.find((n) => n.id === "BLR-SYNTHETIC-01");
    const draft = { path: "new" as const, candidate: "A" as const, design: candidateDesign("A", "new"), revision: 0, simulatedRevision: 0, notes: "New" };
    const entry = addFinalizedBuildNetwork(draft, true, 0);
    expect(entry.id).toBe("BLR-SYNTHETIC-02");
    expect(entry.response.network.nodes.map((n) => n.id)).toEqual(["C3", "C4", "J5", "D01", "R01", "O2"]);
    expect(entry.response.network.edges).toContainEqual({ id: "P21", from: "C3", to: "J5" });
    expect(entry.response.network.edges.some((e) => e.from === "R01")).toBe(false);
    expect(getNetworkSession().networks.find((n) => n.id === "BLR-SYNTHETIC-01")).toBe(previous);
    expect(getNetworkSession().activeId).toBe("BLR-SYNTHETIC-02");
    selectSessionNetwork("BLR-SYNTHETIC-01");
    expect(getNetworkSession().activeId).toBe("BLR-SYNTHETIC-01");
    addFinalizedBuildNetwork(draft, true, 0);
    expect(getNetworkSession().networks).toHaveLength(2);
    expect(entry.response.candidates).toEqual([]);
    expect(entry.response.recommendation.recommendation_status).toBe("abstained");
  });
  it("retains actual engineer edits and notes through the session handoff", () => {
    const design = candidateDesign("A", "new");
    design.nodes = design.nodes.filter((n) => n.id !== "R01");
    design.links = design.links.filter((e) => e.to !== "R01");
    const draft = { path: "new" as const, candidate: "A" as const, design, revision: 2, simulatedRevision: 2, notes: "Recharge removed" };
    saveBuildDraft(draft);
    const entry = addFinalizedBuildNetwork(getBuildDraft("new", "A"), true, 0);
    expect(entry.response.network.nodes.some((n) => n.id === "R01")).toBe(false);
    expect(entry.design?.notes).toBe("Recharge removed");
    expect(entry.revision).toBe(2);
  });
  it("blocks unapproved, blocked and stale designs from changing the registry", () => {
    const draft = getBuildDraft("new", "B");
    const before = getNetworkSession();
    expect(() => addFinalizedBuildNetwork(draft, false, 0)).toThrow();
    expect(() => addFinalizedBuildNetwork(draft, true, 1)).toThrow();
    expect(() => addFinalizedBuildNetwork({ ...draft, revision: 3, simulatedRevision: 2 }, true, 0)).toThrow();
    expect(getNetworkSession()).toBe(before);
  });
});