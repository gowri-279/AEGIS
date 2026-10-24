import * as THREE from "three";
import type { Vec3 } from "@/data/networkLayout";
import { catchmentHeight, type CatchmentModel } from "../catchment/catchmentModel";
import type { NodeLayout } from "../types";
import { URBAN, VEGETATION } from "../visualConfig";

export type RoadSegment = {
  x: number;
  z: number;
  width: number;
  length: number;
  rotation: number;
  primary: boolean;
};

export type BuildingLot = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  variant: number;
};

export type TreePlacement = {
  position: Vec3;
  scale: number;
  variant: number;
};

export type UrbanLayout = {
  roads: RoadSegment[];
  buildings: BuildingLot[];
  trees: TreePlacement[];
};

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function tooCloseToNetwork(x: number, z: number, positions: NodeLayout, model: CatchmentModel) {
  const clearance = model.nodeClearance * URBAN.clearanceFromNode;
  for (const [nx, , nz] of Object.values(positions)) {
    if (Math.hypot(x - nx, z - nz) < clearance) return true;
  }
  for (const basin of model.storageDepressions) {
    const nx = (x - basin.x) / (basin.radiusX * URBAN.clearanceFromStorage);
    const nz = (z - basin.z) / (basin.radiusZ * URBAN.clearanceFromStorage);
    if (nx * nx + nz * nz < 1) return true;
  }
  return false;
}

export function buildUrbanLayout(model: CatchmentModel, positions: NodeLayout, seed: number): UrbanLayout {
  const random = seededRandom(seed);
  const [cx, , cz] = model.bounds.center;
  const half = model.halfSize * 0.92;
  const rotation = URBAN.gridRotation;

  const roads: RoadSegment[] = [];
  const gridLines = URBAN.blockCountX + 1;
  for (let i = 0; i < gridLines; i++) {
    const t = i / URBAN.blockCountX - 0.5;
    const offset = t * half * 1.65;
    roads.push({
      x: cx + Math.cos(rotation) * offset,
      z: cz + Math.sin(rotation) * offset,
      width: i % 2 === 0 ? URBAN.streetWidthPrimary : URBAN.streetWidthSecondary,
      length: half * 3.1,
      rotation: rotation + Math.PI / 2,
      primary: i % 2 === 0,
    });
    roads.push({
      x: cx - Math.sin(rotation) * offset,
      z: cz + Math.cos(rotation) * offset,
      width: i % 2 === 0 ? URBAN.streetWidthSecondary : URBAN.streetWidthPrimary,
      length: half * 3.1,
      rotation,
      primary: i % 2 === 1,
    });
  }

  const buildings: BuildingLot[] = [];
  const trees: TreePlacement[] = [];
  const attempts = URBAN.maxBuildings * 3;
  for (let i = 0; i < attempts && buildings.length < URBAN.maxBuildings; i++) {
    if (random() > URBAN.buildingDensity) continue;
    const x = cx + (random() - 0.5) * half * 2.4;
    const z = cz + (random() - 0.5) * half * 2.2;
    if (tooCloseToNetwork(x, z, positions, model)) continue;
    if (roads.some((road) => {
      const halfLen = road.length / 2;
      const ax = road.x - Math.sin(road.rotation) * halfLen;
      const az = road.z - Math.cos(road.rotation) * halfLen;
      const bx = road.x + Math.sin(road.rotation) * halfLen;
      const bz = road.z + Math.cos(road.rotation) * halfLen;
      return distanceToSegment(x, z, ax, az, bx, bz) < road.width / 2 + URBAN.sidewalkWidth + 1.4;
    })) continue;

    const w = THREE.MathUtils.lerp(URBAN.building.minWidth, URBAN.building.maxWidth, random());
    const d = THREE.MathUtils.lerp(URBAN.building.minDepth, URBAN.building.maxDepth, random());
    const h = THREE.MathUtils.lerp(URBAN.building.minHeight, URBAN.building.maxHeight, random());
    buildings.push({ x, z, w, d, h, variant: Math.floor(random() * 20) });
  }

  for (let i = 0; i < URBAN.maxTrees * 2 && trees.length < URBAN.maxTrees; i++) {
    const road = roads[Math.floor(random() * roads.length)];
    if (!road) break;
    const along = (random() - 0.5) * road.length * 0.86;
    const side = (random() > 0.5 ? 1 : -1) * (road.width / 2 + URBAN.sidewalkWidth + 0.55);
    const x = road.x + Math.sin(road.rotation) * along + Math.cos(road.rotation) * side;
    const z = road.z + Math.cos(road.rotation) * along - Math.sin(road.rotation) * side;
    if (tooCloseToNetwork(x, z, positions, model)) continue;
    const y = catchmentHeight(model, x, z);
    trees.push({
      position: [x, y, z],
      scale: THREE.MathUtils.lerp(VEGETATION.minScale, VEGETATION.maxScale, random()),
      variant: Math.floor(random() * 12),
    });
  }

  return { roads, buildings, trees };
}
