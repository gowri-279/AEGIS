/** Build mode demo content. Mock/illustrative only — to be replaced by backend responses. */
export type BuildPathId = "new" | "redesign";

export interface BuildPath {
  id: BuildPathId;
  index: string;
  title: string;
  description: string;
  details: string[];
  cta: string;
  to: "/build/new" | "/build/redesign";
}

export const BUILD_PATHS: BuildPath[] = [
  {
    id: "new", index: "A", title: "New Network",
    description: "Design a stormwater network for a new terrain or catchment.",
    details: ["Analyze terrain", "Identify natural drainage paths", "Define design objectives", "Generate candidate networks", "Simulate and review"],
    cta: "Start New Network", to: "/build/new",
  },
  {
    id: "redesign", index: "B", title: "Redesign",
    description: "Improve an existing AEGIS network using current network intelligence.",
    details: ["Select an existing network region", "Identify bottlenecks and risks", "Define improvement objectives", "Generate redesign alternatives", "Simulate and review"],
    cta: "Redesign Network", to: "/build/redesign",
  },
];

const TAIL = ["Requirements", "Design Brief", "Network Assessment", "Build Workspace"];
export const BUILD_STEPS: Record<BuildPathId, string[]> = {
  new: ["Terrain", ...TAIL],
  redesign: ["Network", ...TAIL],
};

/** Decorative schematic only; not engineering geometry. */
export const buildBackdropNetwork = {
  nodes: [
    { id: "a", x: 140, y: 150, kind: "inlet" }, { id: "b", x: 300, y: 110, kind: "inlet" },
    { id: "c", x: 420, y: 250, kind: "junction" }, { id: "d", x: 620, y: 220, kind: "storage" },
    { id: "e", x: 560, y: 420, kind: "design" }, { id: "f", x: 800, y: 360, kind: "junction" },
    { id: "g", x: 980, y: 300, kind: "storage" }, { id: "h", x: 1080, y: 520, kind: "outlet" },
    { id: "i", x: 260, y: 470, kind: "inlet" }, { id: "j", x: 900, y: 580, kind: "design" },
  ],
  links: [["a", "c"], ["b", "c"], ["c", "d"], ["c", "e"], ["i", "e"], ["e", "f"], ["d", "f"], ["f", "g"], ["f", "j"], ["j", "h"], ["g", "h"]] as [string, string][],
} as const;
