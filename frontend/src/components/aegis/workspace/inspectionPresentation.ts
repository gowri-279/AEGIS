import type { Network } from "@/data/types";
import { spatialLayout, type DisplayPosition } from "./spatialPresentation";

export type ModelRepresentation = "terrain" | "blueprint";

/** Unitless cutaway depth, not a surveyed pipe elevation. */
export const DISPLAY_CONDUIT_Y = -1.2;
export const DISPLAY_CONDUIT_RADIUS = 0.19;

/** Camera targets are unitless display positions, never engineering geometry. */
export function inspectionTarget(network: Network, id: string | null): DisplayPosition | null {
  if (!id) return null;
  const layout = spatialLayout(network);
  const node = layout.nodes[id];
  if (node) return node;
  const edge = network.edges.find((item) => item.id === id);
  const a = edge ? layout.nodes[edge.from] : undefined;
  const b = edge ? layout.nodes[edge.to] : undefined;
  return a && b ? { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 } : null;
}

/** Bring the selected component prominently close while keeping its immediate connections in frame. */
export function inspectionFraming(network: Network, id: string | null) {
  const selected = inspectionTarget(network, id);
  if (!selected) return { target: { x: 0, z: 0 }, zoomMultiplier: 1 };
  const layout = spatialLayout(network);
  const neighbours = new Set(
    network.edges
      .filter((edge) => edge.from === id || edge.to === id)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  neighbours.delete(id ?? "");
  const points = [...neighbours].flatMap((key) => (layout.nodes[key] ? [layout.nodes[key]] : []));
  return { target: { x: selected.x, z: selected.z }, zoomMultiplier: points.length ? 3.6 : 2.8 };
}

/** Abstract presentation relief only. Flatten around canonical structures. */
export function displayRelief(x: number, z: number, points: DisplayPosition[]): number {
  const clearance = points.reduce(
    (distance, p) => Math.min(distance, Math.hypot(x - p.x, z - p.z)),
    Infinity,
  );
  const blend = Math.min(1, Math.max(0, (clearance - 1.3) / 1.8));
  return -0.06 + blend * (0.16 + 0.16 * Math.sin(x * 0.65) * Math.cos(z * 0.7));
}

/** Cutaway is a camera-angle presentation effect, not a network mode. */
export function terrainOpacity(polarAngle: number): number {
  return Math.max(0.12, Math.min(1, 1 - Math.max(0, polarAngle - 0.95) * 1.5));
}
