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

export function networkFrame(layout: NodeLayout) {
  const points = Object.values(layout);
  if (!points.length) return { target: [0, 0, 0] as Vec3, camera: [8, 18, 26] as Vec3 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  points.forEach(([x, , z]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  });
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ, 14);
  const distance = Math.min(Math.max(span * 1.35, 18), 38);
  return {
    target: [cx, 0, cz] as Vec3,
    camera: [cx + distance * 0.38, distance * 0.72, cz + distance * 0.82] as Vec3,
  };
}
