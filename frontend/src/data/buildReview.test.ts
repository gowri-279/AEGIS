import { describe, expect, it } from "vitest";
import { designChanges, initialDesign, removeProposed, reviewMetrics, updateProposedNode } from "./buildReview";

describe("Engineering review rules", () => {
  const a = initialDesign("A");
  it("existing infrastructure cannot be removed", () => {
    const r = removeProposed(a, "J3");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Existing Infrastructure Protected");
  });
  it("removing proposed R01 drops it and its links and is reported", () => {
    const r = removeProposed(a, "R01");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.design.nodes.some((n) => n.id === "R01")).toBe(false);
    expect(r.design.links.some((l) => l.from === "R01" || l.to === "R01")).toBe(false);
    expect(designChanges(a, r.design)).toContainEqual({ sign: "−", id: "R01", label: "Removed Recharge" });
  });
  it("editing D01 reports a modified detention", () => {
    const next = updateProposedNode(a, "D01", [["Capacity", "200"]], "More storage");
    expect(designChanges(a, next)).toEqual([{ sign: "~", id: "D01", label: "Modified Detention" }]);
  });
  it("no change → no differences", () => expect(designChanges(a, initialDesign("A"))).toEqual([]));
  it("first re-simulation moves Design A flood −31% → −34% and downstream −18% → −20%", () => {
    expect(reviewMetrics("A", 0)).toContainEqual(["Flood Risk", "−31%"]);
    const m = reviewMetrics("A", 1);
    expect(m).toContainEqual(["Flood Risk", "−34%"]);
    expect(m).toContainEqual(["Downstream Load", "−20%"]);
  });
});
