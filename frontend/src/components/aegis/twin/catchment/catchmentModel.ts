import * as THREE from "three";
import type { NetworkNode } from "@/data/types";
import type { NetworkBounds } from "../presentationLayout";
import type { NodeLayout } from "../types";
import { CATCHMENT } from "../visualConfig";

export type StorageDepression = {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
};

export type CatchmentModel = {
  bounds: NetworkBounds;
  halfSize: number;
  drainCenter: [number, number];
  drainAxis: [number, number];
  storageDepressions: StorageDepression[];
  nodeClearance: number;
};

function legacyRipple(x: number, z: number) {
  return (
    0.12 * Math.sin(x * 0.17) +
    0.16 * Math.cos(z * 0.14) +
    0.08 * Math.sin((x + z) * 0.11)
  );
}

export function buildStorageDepressions(
  nodes: NetworkNode[],
  positions: NodeLayout,
  variantById: Map<string, number>,
): StorageDepression[] {
  return nodes
    .filter((node) => node.type === "storage")
    .map((node) => {
      const pos = positions[node.id];
      if (!pos) return null;
      const variant = CATCHMENT.storageTerrain.variants[variantById.get(node.id) ?? 0] ?? CATCHMENT.storageTerrain.variants[0]!;
      return {
        x: pos[0],
        z: pos[2],
        radiusX: variant.depressionRadiusX,
        radiusZ: variant.depressionRadiusZ,
      };
    })
    .filter((item): item is StorageDepression => Boolean(item));
}

export function createCatchmentModel(
  bounds: NetworkBounds,
  storageDepressions: StorageDepression[],
): CatchmentModel {
  const span = bounds.span;
  const halfSize = Math.min(Math.max(span * CATCHMENT.extentScale, CATCHMENT.minHalfSize), CATCHMENT.maxHalfSize);
  const [cx, , cz] = bounds.center;
  return {
    bounds,
    halfSize,
    drainCenter: [cx, cz],
    drainAxis: CATCHMENT.drainageAxis,
    storageDepressions,
    nodeClearance: Math.max(CATCHMENT.nodeClearanceMin, span * CATCHMENT.nodeClearanceScale),
  };
}

export function catchmentHeight(model: CatchmentModel, x: number, z: number) {
  const cfg = CATCHMENT.height;
  let y = legacyRipple(x, z) * cfg.rippleScale;

  const [cx, cz] = model.drainCenter;
  const [ax, az] = model.drainAxis;
  const axisLen = Math.hypot(ax, az) || 1;
  const along = ((x - cx) * ax + (z - cz) * az) / axisLen;
  const across = (-(x - cx) * az + (z - cz) * ax) / axisLen;
  y += along * cfg.drainageTilt + Math.sin(across * cfg.acrossFrequency) * cfg.acrossAmplitude;

  const edgeDist = Math.max(Math.abs(x - cx), Math.abs(z - cz)) / model.halfSize;
  y += THREE.MathUtils.smoothstep(edgeDist, cfg.edgeLiftStart, cfg.edgeLiftEnd) * cfg.edgeLift;

  let embankmentLift = 0;
  let depression = 0;
  model.storageDepressions.forEach((basin) => {
    const nx = (x - basin.x) / basin.radiusX;
    const nz = (z - basin.z) / basin.radiusZ;
    const radial = Math.hypot(nx, nz);
    const rim = THREE.MathUtils.smoothstep(radial, cfg.basinRimInner, cfg.basinRimOuter);
    embankmentLift = Math.max(embankmentLift, rim * cfg.basinRimHeight);
    const bowl = THREE.MathUtils.smoothstep(radial, cfg.basinFloorStart, cfg.basinFloorEnd);
    depression = Math.max(depression, bowl * cfg.basinDepth);
  });

  return y + embankmentLift - depression;
}

let boundModel: CatchmentModel | null = null;

/** Binds active catchment for shared ground height (network anchors, conduits). */
export function bindCatchmentModel(model: CatchmentModel | null) {
  boundModel = model;
}

export function groundSurfaceY(x: number, z: number) {
  return boundModel ? catchmentHeight(boundModel, x, z) : legacyRipple(x, z);
}
