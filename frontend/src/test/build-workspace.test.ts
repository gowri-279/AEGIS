import { describe, expect, it } from "vitest";
import { candidateDesign, connectNodes, EXISTING, placeComponent, updateLink } from "@/data/buildWorkspace";

const ids = (d: ReturnType<typeof candidateDesign>) => [...d.nodes.map((n) => n.id), ...d.links.map((l) => l.id)];

describe("Build workspace design rules", () => {
  it("Design A adds J5, P21, D01 and R01 and retains every existing component", () => {
    const d = candidateDesign("A");
    expect(ids(d)).toEqual(expect.arrayContaining(["J5", "P21", "D01", "R01", "O1", "C1", "C2", "J3", "J4", "L1", "L2", "R1", "E-C1-J3", "E-J3-L2"]));
    expect(d.nodes.filter((n) => !n.proposed)).toHaveLength(EXISTING.nodes.length);
  });
  it("Design B adds no recharge unit but retains existing R1", () => {
    expect(candidateDesign("B").nodes.some((n) => n.kind === "recharge" && n.proposed)).toBe(false);
    expect(candidateDesign("B").nodes.some((n) => n.id === "R1")).toBe(true);
  });
  it("Design C adds a channel", () => {
    expect(candidateDesign("C").links.some((l) => l.kind === "channel" && l.proposed)).toBe(true);
  });
  it("rejects placement inside the protected lake", () => {
    const r = placeComponent(candidateDesign("A"), "junction", 548, 258);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe("Placement Conflict");
  });
  it("places a proposed junction on a valid snap point", () => {
    const r = placeComponent(candidateDesign("A"), "junction", 440, 300);
    expect(r.ok && r.design.nodes.find((n) => n.id === r.id)?.proposed).toBe(true);
  });
  it("rejects duplicate connections", () => {
    expect(connectNodes(candidateDesign("A"), "pipe", "J5", "J3").ok).toBe(false);
  });
  it("never edits existing infrastructure", () => {
    const d = updateLink(candidateDesign("A"), "E-J3-L2", { capacity: 300 });
    expect(d.links.find((l) => l.id === "E-J3-L2")?.capacity).toBe(0);
  });
});
