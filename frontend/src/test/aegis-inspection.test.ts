import { describe, expect, it } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import {
  DISPLAY_CONDUIT_RADIUS,
  DISPLAY_CONDUIT_Y,
  displayRelief,
  inspectionFraming,
  inspectionTarget,
  terrainOpacity,
} from "@/components/aegis/workspace/inspectionPresentation";
import { spatialLayout } from "@/components/aegis/workspace/spatialPresentation";
import { act, renderHook } from "@testing-library/react";
import { useNetworkSelection } from "@/components/aegis/useNetworkSelection";

describe("inspection presentation boundaries", () => {
  it("issues a fresh focus request when the same component is selected again", () => {
    const { result } = renderHook(() => useNetworkSelection());
    act(() => result.current.select("J3"));
    expect(result.current.selectedId).toBe("J3");
    expect(result.current.selectionRevision).toBe(1);
    act(() => result.current.select("J3"));
    expect(result.current.selectedId).toBe("J3");
    expect(result.current.selectionRevision).toBe(2);
  });
  it("focuses a selected node using only its topology display position", () => {
    expect(inspectionTarget(fixtures.standard.network, "J3")).toEqual(
      spatialLayout(fixtures.standard.network).nodes["J3"],
    );
  });
  it("focuses connections between their canonical endpoints", () => {
    const layout = spatialLayout(fixtures.standard.network);
    const a = layout.nodes["J3"],
      b = layout.nodes["L2"];
    if (!a || !b) throw new Error("Fixture endpoints missing");
    expect(inspectionTarget(fixtures.standard.network, "E-J3-L2")).toEqual({
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
    });
  });
  it("does not invent a focus position for unavailable components", () => {
    expect(inspectionTarget(fixtures.standard.network, "MISSING")).toBeNull();
    expect(inspectionTarget(fixtures.standard.network, null)).toBeNull();
  });
  it("prominently enlarges selected nodes while retaining context toward connected infrastructure", () => {
    const layout = spatialLayout(fixtures.standard.network);
    const junction = layout.nodes["J3"],
      downstream = layout.nodes["J4"],
      storage = layout.nodes["L2"];
    if (!junction || !downstream || !storage) throw new Error("Fixture endpoints missing");
    const framing = inspectionFraming(fixtures.standard.network, "L2");
    expect(framing.zoomMultiplier).toBe(3.6);
    expect(framing.target.x).toBeCloseTo(storage.x);
    expect(framing.target.z).toBeCloseTo(storage.z);
  });
  it("restores full-network framing without fabricating unavailable nodes", () => {
    expect(inspectionFraming(fixtures.standard.network, null)).toEqual({
      target: { x: 0, z: 0 },
      zoomMultiplier: 1,
    });
    expect(inspectionFraming(fixtures.standard.network, "MISSING")).toEqual({
      target: { x: 0, z: 0 },
      zoomMultiplier: 1,
    });
  });
  it("reveals subsurface infrastructure by angle without adding a mode", () => {
    expect(terrainOpacity(0.5)).toBe(1);
    expect(terrainOpacity(1.7)).toBe(0.12);
    expect(terrainOpacity(1.2)).toBeLessThan(terrainOpacity(0.9));
  });
  it("keeps abstract relief flat around infrastructure without changing canonical data", () => {
    const before = JSON.stringify(fixtures.standard);
    expect(displayRelief(0, 0, [{ x: 0, z: 0 }])).toBe(-0.06);
    inspectionTarget(fixtures.standard.network, "L1");
    expect(JSON.stringify(fixtures.standard)).toBe(before);
  });
  it("keeps the whole main conduit below the abstract terrain surface", () => {
    expect(DISPLAY_CONDUIT_Y + DISPLAY_CONDUIT_RADIUS).toBeLessThan(
      displayRelief(0, 0, [{ x: 0, z: 0 }]),
    );
  });
});
