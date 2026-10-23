// FRONTEND VISUALIZATION METADATA ONLY
// These coordinates and visual dimensions are not canonical hydraulic/network data.
// They are not Bengaluru coordinates, elevations, surveyed positions or pipe lengths.

export type Vec3 = [number, number, number];

export const nodeLayout: Record<string, { position: Vec3; scale: number }> = {
  J3: { position: [0, 0, 0], scale: 1 },
  L1: { position: [-9, -0.6, -6], scale: 0.8 },
  R1: { position: [9, -0.4, -5], scale: 0.9 },
  L2: { position: [2, -1.2, 11], scale: 1.4 },
};

// Intermediate control points so pipes read as routed infrastructure.
export const edgeLayout: Record<string, { via: Vec3[]; radius: number }> = {
  "E-J3-L1": { via: [[-3, -0.2, -1.5], [-7, -0.5, -3]], radius: 0.28 },
  "E-J3-R1": { via: [[3.5, -0.2, -1], [7, -0.35, -2.5]], radius: 0.28 },
  "E-J3-L2": { via: [[0.5, -0.4, 4], [2.5, -0.9, 7.5]], radius: 0.38 },
};

export const sensorLayout: Record<string, { offset: Vec3 }> = {
  "WL-J3": { offset: [0.9, 1.9, 0.4] },
};

export const nl = (id: string) => nodeLayout[id] ?? { position: [0, 0, 0] as Vec3, scale: 1 };
