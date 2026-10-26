/** Build Step 2 demo data. Mock/illustrative only — replace with backend responses later. */
import { EXISTING } from "./buildWorkspace";

export interface TerrainAnalysis {
  elevation: string; slope: string; drainagePaths: number; lowPoints: number; waterBodies: number; area: string;
}
export interface TerrainOption {
  id: string; name: string; area: string; landUse: string; relief: string; analysis: TerrainAnalysis;
}

export const DEMO_TERRAINS: TerrainOption[] = [
  { id: "north", name: "Demo Catchment North", area: "2.8 km²", landUse: "Mixed urban", relief: "Moderate slope",
    analysis: { elevation: "812.4 – 846.7 m", slope: "3.8%", drainagePaths: 6, lowPoints: 4, waterBodies: 1, area: "2.8 km²" } },
  { id: "east", name: "Demo Catchment East", area: "4.1 km²", landUse: "Dense urban", relief: "Low-lying",
    analysis: { elevation: "796.2 – 811.9 m", slope: "1.6%", drainagePaths: 8, lowPoints: 7, waterBodies: 1, area: "4.1 km²" } },
  { id: "south", name: "Demo Catchment South", area: "3.2 km²", landUse: "Mixed residential", relief: "Steeper terrain",
    analysis: { elevation: "828.0 – 881.5 m", slope: "6.4%", drainagePaths: 5, lowPoints: 3, waterBodies: 1, area: "3.2 km²" } },
];
/** The prepared demonstration terrain reuses the North model. */
export const DEMO_TERRAIN_ID = "north";

/** Unitless display positions (viewBox 0–800 × 0–480); not engineering geometry. */
export const TERRAIN_SCENE = {
  boundary: "M70 90 C 180 40, 420 30, 610 70 S 760 200, 730 330 S 560 450, 380 440 S 90 410, 60 300 S 20 140, 70 90 Z",
  contours: [0, 1, 2, 3, 4, 5].map((i) => `M${60 + i * 8} ${120 + i * 52} C ${220} ${80 + i * 54}, ${420} ${160 + i * 46}, ${740 - i * 6} ${110 + i * 50}`),
  roads: ["M40 250 L 300 230 L 520 280 L 780 260", "M300 230 L 330 40", "M520 280 L 560 460"],
  water: "M560 330 C 590 300, 660 305, 672 338 C 684 372, 620 392, 580 378 C 552 368, 546 348, 560 330 Z",
  flows: [[150, 120, 230, 190], [330, 110, 360, 200], [470, 140, 500, 230], [240, 300, 340, 340], [420, 330, 520, 350], [650, 180, 620, 280]] as [number, number, number, number][],
  lowPoints: [{ x: 250, y: 205 }, { x: 380, y: 230 }, { x: 520, y: 300 }, { x: 610, y: 350 }],
};

export interface TerrainScene {
  boundary: string; contours: string[]; roads: string[]; water: string;
  flows: [number, number, number, number][]; lowPoints: { x: number; y: number }[];
  blocks?: [number, number, number, number][];
}

/** Per-terrain schematic scenes (unitless, illustrative; not GIS rendering). */
export const TERRAIN_SCENES: Record<string, TerrainScene> = {
  north: TERRAIN_SCENE,
  east: {
    boundary: "M50 120 C 160 70, 400 60, 640 90 S 770 230, 750 340 S 600 440, 400 446 S 80 430, 50 330 S 30 170, 50 120 Z",
    contours: [0, 1, 2].map((i) => `M40 ${170 + i * 100} C 260 ${150 + i * 104}, 520 ${190 + i * 96}, 760 ${165 + i * 102}`),
    roads: ["M40 200 L 760 200", "M40 320 L 760 320", "M200 70 L 200 450", "M380 60 L 380 450", "M560 70 L 560 450"],
    water: "M420 360 C 450 336, 520 340, 532 370 C 542 400, 480 420, 440 410 C 412 402, 404 378, 420 360 Z",
    flows: [[120, 150, 220, 250], [300, 130, 360, 250], [620, 140, 560, 260], [700, 260, 600, 320], [160, 380, 300, 350], [460, 250, 470, 330]],
    lowPoints: [{ x: 300, y: 280 }, { x: 470, y: 300 }, { x: 600, y: 340 }, { x: 360, y: 380 }, { x: 640, y: 260 }, { x: 240, y: 360 }, { x: 520, y: 240 }],
    blocks: [[100, 120, 70, 50], [240, 110, 110, 60], [420, 110, 110, 60], [600, 130, 90, 45], [100, 240, 70, 55], [240, 240, 110, 55], [420, 240, 110, 55], [600, 240, 110, 55], [240, 345, 110, 60], [600, 345, 80, 50]],
  },
  south: {
    boundary: "M110 50 C 260 30, 520 40, 680 80 S 760 260, 700 380 S 480 460, 300 450 S 70 400, 60 260 S 40 80, 110 50 Z",
    contours: Array.from({ length: 11 }, (_, i) => `M${40 + i * 30} 40 C ${160 + i * 34} ${140 + i * 8}, ${200 + i * 30} ${300 + i * 6}, ${80 + i * 34} 460`),
    roads: ["M60 140 L 420 300 L 760 360", "M420 300 L 380 470"],
    water: "M150 380 C 180 350, 250 356, 262 386 C 272 418, 210 436, 172 426 C 144 418, 136 398, 150 380 Z",
    flows: [[620, 100, 470, 190], [660, 210, 500, 290], [560, 70, 400, 150], [440, 210, 300, 290], [380, 330, 240, 370], [690, 320, 540, 380]],
    lowPoints: [{ x: 220, y: 330 }, { x: 330, y: 400 }, { x: 470, y: 420 }],
  },
};
export const terrainScene = (id: string | null | undefined): TerrainScene => TERRAIN_SCENES[id ?? DEMO_TERRAIN_ID] ?? TERRAIN_SCENE;

export interface ConnectionPoint { id: string; x: number; y: number; role: string }
export const CONNECTION_POINTS: ConnectionPoint[] = [
  { id: "J3", x: 360, y: 228, role: "Upstream junction" },
  { id: "J4", x: 540, y: 300, role: "Downstream junction" },
  { id: "O1", x: 700, y: 360, role: "Network outlet" },
];

export type ConnectionChoice = "yes" | "no" | null;
export function terrainSetupComplete(terrainId: string | null, connection: ConnectionChoice, points: string[]): boolean {
  if (!terrainId || !connection) return false;
  return connection === "no" || points.length > 0;
}

/* ---------- Redesign Existing ---------- */
export interface RedesignNode {
  id: string; kind: "collection_inlet" | "junction" | "storage" | "recharge" | "outlet"; x: number; y: number;
  elevation: string; utilization: number | null; status: string; warn?: boolean; downstream: string;
}
export interface RedesignLink { id: string; from: string; to: string; utilization: number | null; status: string; warn?: boolean }

export const REDESIGN_NODES: RedesignNode[] = EXISTING.nodes.map((n) => ({ id: n.id, kind: n.kind === "outfall" ? "outlet" : n.kind === "detention" ? "storage" : n.kind,
  x: n.x, y: n.y, elevation: "Not supplied", utilization: null, status: "Existing · Synthetic", downstream: EXISTING.links.filter((e) => e.from === n.id).map((e) => e.to).join(" · ") || "—" }));
export const REDESIGN_LINKS: RedesignLink[] = EXISTING.links.map((e) => ({ id: e.id, from: e.from, to: e.to, utilization: null, status: "Existing · Synthetic" }));

export const REDESIGN_REGION = {
  id: "R-J3-O1", label: "J3 → L2 → J4 → O1",
  nodeIds: ["J3", "L2", "J4", "O1"], linkIds: ["E-J3-L2", "E-L2-J4", "E-J4-O1"],
  condition: "Downstream bottleneck", utilization: "87%", risk: "Elevated",
  issues: ["High capacity utilization", "Downstream bottleneck", "Flood exposure near J3"],
};
