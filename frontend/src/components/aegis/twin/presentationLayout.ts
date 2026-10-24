import type { Vec3 } from "@/data/networkLayout";
import { GREYBOX, SAMPLE_NODE_IDS } from "./visualConfig";
import type { NodeLayout } from "./types";

/** Synthetic visualization height — not elevation data. */
export function surfaceY(x: number, z: number) {
  return 0.12 * Math.sin(x * 0.17) + 0.16 * Math.cos(z * 0.14) + 0.08 * Math.sin((x + z) * 0.11);
}

export function samplePositions(canonical: NodeLayout, ids = SAMPLE_NODE_IDS.filter((id) => !(id in canonical))) {
  const points = Object.values(canonical);
  const max = points.reduce((acc, p) => Math.max(acc, Math.abs(p[0]), Math.abs(p[2])), 0);
  const radius = Math.max(19, max + 9);
  return Object.fromEntries(ids.map((id, index) => {
    const angle = index * Math.PI / 2 + Math.PI / 4;
    return [id, [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as Vec3];
  }));
}

export type NetworkBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  center: Vec3;
  span: number;
};

export function networkBounds(layout: NodeLayout): NetworkBounds {
  const points = Object.values(layout);
  if (!points.length) {
    return { minX: -8, maxX: 8, minZ: -8, maxZ: 8, center: [0, 0, 0], span: 16 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  points.forEach(([x, , z]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  });
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const cy = surfaceY(cx, cz);
  const span = Math.max(maxX - minX, maxZ - minZ, 12);
  return { minX, maxX, minZ, maxZ, center: [cx, cy, cz], span };
}

/** Tight default camera framing for the canonical network footprint (presentation only). */
export function networkFrame(layout: NodeLayout) {
  const bounds = networkBounds(layout);
  const { center, span } = bounds;
  const [cx, cy, cz] = center;
  const distance = Math.min(Math.max(span * 1.05, 16), 32);
  const pitch = 0.62;
  const yaw = 0.72;
  const horizontal = Math.cos(pitch) * distance;
  return {
    bounds,
    target: [cx, cy, cz] as Vec3,
    camera: [
      cx + Math.sin(yaw) * horizontal,
      cy + Math.sin(pitch) * distance,
      cz + Math.cos(yaw) * horizontal,
    ] as Vec3,
    orbit: {
      minDistance: Math.max(span * 0.42, 9),
      maxDistance: Math.min(span * 2.4, 72),
    },
  };
}
