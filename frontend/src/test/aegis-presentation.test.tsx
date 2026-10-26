import { describe, expect, it } from "vitest";
import { layoutNetwork } from "@/data/networkLayout";
import { fixtures } from "@/data/mockCanonicalResponse";
import { constraintLabel, constraintTone, display, resolveTarget } from "@/lib/aegis";
import { explain } from "@/components/aegis/bob/bobExplain";

describe("network layout is generic", () => {
  it("lays out arbitrary node ids with sources left of targets", () => {
    const layout = layoutNetwork({
      network_id: "x",
      nodes: [{ id: "A9", type: "junction", label: "a", sensor_ids: [], attributes: {} }, { id: "Q-7", type: "pump" as never, label: "q", sensor_ids: [], attributes: {} }, { id: "Z", type: "storage", label: "z", sensor_ids: [], attributes: {} }],
      edges: [{ id: "e1", from: "A9", to: "Q-7" }, { id: "e2", from: "Q-7", to: "Z" }, { id: "bad", from: "A9", to: "MISSING" }],
    });
    expect(Object.keys(layout.nodes).sort()).toEqual(["A9", "Q-7", "Z"]);
    expect(layout.nodes["A9"]!.x).toBeLessThan(layout.nodes["Q-7"]!.x);
    expect(layout.nodes["Q-7"]!.x).toBeLessThan(layout.nodes["Z"]!.x);
    expect(layout.edges.map((e) => e.id)).toEqual(["e1", "e2"]);
  });
});

describe("unknown stays unknown", () => {
  it("renders null as a dash, never zero", () => {
    expect(display(null, "m")).toBe("—");
    expect(display(0, "m")).toBe("0 m");
  });
  it("not_evaluated is distinct from failed", () => {
    expect(constraintTone.not_evaluated).not.toBe(constraintTone.fail);
    expect(constraintLabel.not_evaluated).toBe("Not evaluated");
  });
});

describe("selection and Bob stay grounded", () => {
  it("maps a sensor id to its node", () => {
    expect(resolveTarget(fixtures.standard, "WL-J3")).toBe("J3");
  });
  it("reports the abstained recommendation from the response without inventing a candidate", () => {
    const text = explain(fixtures.critical_stale, null).map((l) => l.text).join(" ");
    expect(text).toContain("Abstained");
    expect(text).toContain("safety qualified: no");
    expect(text).not.toContain("C-L2");
  });
});
