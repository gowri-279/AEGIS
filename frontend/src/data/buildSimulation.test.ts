import { describe, expect, it } from "vitest";
import { CAPACITY, REMAINING_RISKS, SIM_META, riskZones, simLinks } from "./buildSimulation";

describe("build simulation demo data", () => {
  it("baseline routes J3 → L2 → O1 only", () => {
    expect(simLinks("baseline").map((l) => `${l.from}-${l.to}`)).toEqual(["J3-L2", "L2-O1"]);
  });
  it("proposed keeps the existing connection and adds J3 → J5 → D01 → R01 → O1", () => {
    const ids = simLinks("proposed").map((l) => `${l.from}-${l.to}`);
    expect(ids).toEqual(expect.arrayContaining(["J3-L2", "J3-J5", "J5-D01", "D01-R01", "R01-O1"]));
  });
  it("J3 utilization drops from 87% to 61% and O1 stays a constraint at 74%", () => {
    expect(CAPACITY.find((c) => c.id === "J3")).toMatchObject({ baseline: 87, proposed: 61 });
    expect(CAPACITY.find((c) => c.id === "O1")?.proposed).toBe(74);
  });
  it("still reports remaining risks and 82% confidence", () => {
    expect(REMAINING_RISKS.length).toBe(4);
    expect(SIM_META.confidence).toBe(82);
  });
  it("proposed flood zone has no critical area", () => {
    expect(riskZones("proposed").some((z) => z.level === "critical")).toBe(false);
  });
});
