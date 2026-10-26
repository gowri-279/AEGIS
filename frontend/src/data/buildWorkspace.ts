/** Build Step 5 workspace demo data + pure design-edit rules. Synthetic only — replace with AEGIS design service responses. */
import { fixtureStandard } from "./mockCanonicalResponse";
import { layoutNetwork } from "./networkLayout";
import type { BuildPathKind } from "./buildRequirements";

export type ToolId = "select" | "junction" | "pipe" | "channel" | "detention" | "recharge" | "outfall";
export type ElementKind = "collection_inlet" | "junction" | "storage" | "outfall" | "detention" | "recharge";
export type LinkKind = "pipe" | "channel";
export type CandidateId = "A" | "B" | "C";

export interface WsNode { id: string; kind: ElementKind; x: number; y: number; proposed: boolean; props: [string, string][]; purpose?: string; warn?: boolean }
export interface WsLink { id: string; kind: LinkKind; from: string; to: string; proposed: boolean; capacity: number; length: number; purpose?: string; warn?: boolean; props?: [string, string][] }
export interface Design { nodes: WsNode[]; links: WsLink[] }

/** Unitless display positions in a 800 × 480 viewBox; not engineering geometry. */
const baselineLayout = layoutNetwork(fixtureStandard.network);
export const EXISTING: Design = {
  nodes: fixtureStandard.network.nodes.map((n) => {
    const p = baselineLayout.nodes[n.id];
    return { id: n.id, kind: n.type === "outlet" ? "outfall" : n.type === "downstream_junction" ? "junction" : n.type,
      x: (p?.x ?? 0) / baselineLayout.width * 800, y: (p?.y ?? 0) / baselineLayout.height * 480,
      proposed: false, props: Object.entries(n.attributes).map(([k, v]) => [k, String(v)] as [string, string]) };
  }),
  links: fixtureStandard.network.edges.map((e) => ({ ...e, kind: "pipe", proposed: false, capacity: 0, length: 0, props: [] })),
};

const J5: WsNode = { id: "J5", kind: "junction", x: 500, y: 370, proposed: true, props: [["Elevation", "817.2 m"]], purpose: "Collect runoff from eastern low-point corridor" };
const D01: WsNode = { id: "D01", kind: "detention", x: 600, y: 410, proposed: true, props: [["Estimated Effect", "Reduce downstream peak load"]], purpose: "Temporarily retain peak runoff" };
const R01: WsNode = { id: "R01", kind: "recharge", x: 690, y: 425, proposed: true, props: [], purpose: "Promote infiltration / reduce direct downstream discharge" };
const D02: WsNode = { id: "D02", kind: "detention", x: 440, y: 445, proposed: true, props: [["Estimated Effect", "Additional peak storage"]], purpose: "Additional storage capacity for extreme events" };
const P21: WsLink = { id: "P21", kind: "pipe", from: "J3", to: "J5", proposed: true, capacity: 120, length: 240, purpose: "Reduce loading on J3 → L2" };
const link = (id: string, from: string, to: string, kind: LinkKind = "pipe", purpose = "Proposed conveyance"): WsLink => ({ id, kind, from, to, proposed: true, capacity: 100, length: 150, purpose });

export interface Candidate { id: CandidateId; name: string; subtitle: string; recommended?: boolean; add: Design; metrics: [string, string][] }
export const WS_CANDIDATES: Candidate[] = [
  { id: "A", name: "Design A", subtitle: "Balanced", recommended: true,
    add: { nodes: [J5, D01, R01], links: [P21, link("P22", "J5", "D01"), link("P23", "D01", "R01"), link("P24", "D01", "O1", "pipe", "Controlled outlet branch to O1")] },
    metrics: [["Flood Risk", "-31%"], ["Downstream Load", "-18%"], ["Lake Impact", "Low"], ["Network Resilience", "+24%"], ["Construction", "Moderate"]] },
  { id: "B", name: "Design B", subtitle: "Minimum Infrastructure",
    add: { nodes: [J5], links: [P21, link("P25", "J5", "O1")] },
    metrics: [["Flood Risk", "-21%"], ["Downstream Load", "-10%"], ["Lake Impact", "Low"], ["Network Resilience", "+15%"], ["Construction", "Low"]] },
  { id: "C", name: "Design C", subtitle: "Maximum Resilience",
    add: { nodes: [J5, D01, R01, D02], links: [P21, link("P22", "J5", "D01"), link("P23", "D01", "R01"), link("P24", "D01", "O1", "pipe", "Controlled outlet branch to O1"), link("CH1", "J4", "J5", "channel", "Open-channel relief for J4"), link("P26", "J4", "D02", "pipe", "Feed additional storage")] },
    metrics: [["Flood Risk", "-39%"], ["Downstream Load", "-24%"], ["Lake Impact", "Very Low"], ["Network Resilience", "+34%"], ["Construction", "High"]] },
];

export function candidateDesign(id: CandidateId, path: BuildPathKind = "redesign"): Design {
  const c = WS_CANDIDATES.find((x) => x.id === id);
  if (!c) return { nodes: [], links: [] };
  if (path === "new") {
    const nodes: WsNode[] = [
      { id: "C3", kind: "collection_inlet", x: 100, y: 140, proposed: true, props: [] },
      { id: "C4", kind: "collection_inlet", x: 100, y: 310, proposed: true, props: [] },
      ...c.add.nodes.map((n, i) => ({ ...n, x: 300 + i * 120, y: i === 0 ? 220 : 130 + i * 90 })),
      { id: "O2", kind: "outfall", x: 730, y: 220, proposed: true, props: [] },
    ];
    const links = c.add.links.map((l) => ({ ...l, from: l.from === "J3" ? "C3" : l.from === "J4" ? "C4" : l.from, to: l.to === "O1" ? "O2" : l.to }));
    links.push(link("P-C4-J5", "C4", "J5"));
    return { nodes, links };
  }
  return { nodes: [...EXISTING.nodes, ...c.add.nodes.map((n) => ({ ...n }))], links: [...EXISTING.links, ...c.add.links.map((l) => ({ ...l }))] };
}

/* ---------- Tools ---------- */
export const TOOLS: { id: ToolId; label: string; tip: string }[] = [
  { id: "select", label: "Select", tip: "Select and inspect components" },
  { id: "junction", label: "Junction", tip: "Place a junction on a valid snap point" },
  { id: "pipe", label: "Pipe / Drain", tip: "Connect two nodes with a closed conduit" },
  { id: "channel", label: "Channel", tip: "Connect two nodes with an open channel" },
  { id: "detention", label: "Detention", tip: "Place detention at a terrain low point" },
  { id: "recharge", label: "Recharge", tip: "Place recharge in an infiltration zone" },
  { id: "outfall", label: "Outfall", tip: "Place an outfall at a downstream connection point" },
];

export interface SnapPoint { id: string; x: number; y: number }
export const SNAP_POINTS: Partial<Record<ToolId, SnapPoint[]>> = {
  junction: [{ id: "s1", x: 250, y: 300 }, { id: "s2", x: 440, y: 300 }, { id: "s3", x: 620, y: 180 }],
  detention: [{ id: "s4", x: 250, y: 245 }, { id: "s5", x: 380, y: 270 }, { id: "s6", x: 610, y: 390 }],
  recharge: [{ id: "s7", x: 180, y: 360 }, { id: "s8", x: 300, y: 440 }],
  outfall: [{ id: "s9", x: 760, y: 390 }, { id: "s10", x: 740, y: 230 }],
};

/** Protected lake zone around L2 (display ellipse). */
export const PROTECTED_ZONE = { cx: 548, cy: 258, rx: 78, ry: 52 };
export const inProtectedZone = (x: number, y: number) =>
  ((x - PROTECTED_ZONE.cx) / PROTECTED_ZONE.rx) ** 2 + ((y - PROTECTED_ZONE.cy) / PROTECTED_ZONE.ry) ** 2 <= 1;

const TOOL_KIND: Partial<Record<ToolId, ElementKind>> = { junction: "junction", detention: "detention", recharge: "recharge", outfall: "outfall" };
const PREFIX: Record<ElementKind, string> = { collection_inlet: "C", junction: "J", storage: "L", outfall: "O", detention: "D", recharge: "R" };
export const KIND_LABEL: Record<ElementKind | LinkKind, string> = { collection_inlet: "Collection Inlet", junction: "Junction", storage: "Storage", outfall: "Outfall", detention: "Detention", recharge: "Recharge", pipe: "Pipe / Drain", channel: "Channel" };

export type EditResult = { ok: true; design: Design; id: string } | { ok: false; title: string; detail: string };

function nextId(design: Design, prefix: string, start: number, pad = 1) {
  const used = new Set([...design.nodes.map((n) => n.id), ...design.links.map((l) => l.id)]);
  let i = start; while (used.has(`${prefix}${String(i).padStart(pad, "0")}`)) i++;
  return `${prefix}${String(i).padStart(pad, "0")}`;
}

export function placeComponent(design: Design, tool: ToolId, x: number, y: number): EditResult {
  const kind = TOOL_KIND[tool];
  if (!kind) return { ok: false, title: "Invalid Tool", detail: "This tool does not place a component." };
  if (inProtectedZone(x, y)) return { ok: false, title: "Placement Conflict", detail: "Protected water body / restricted zone." };
  const valid = (SNAP_POINTS[tool] ?? []).some((p) => Math.hypot(p.x - x, p.y - y) < 14);
  if (!valid) return { ok: false, title: "Placement Conflict", detail: "Not a valid placement location — use a highlighted snap point." };
  if (design.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 14)) return { ok: false, title: "Placement Conflict", detail: "Location already occupied." };
  const id = kind === "junction" ? nextId(design, "J", 6) : nextId(design, PREFIX[kind], 1, 2);
  const node: WsNode = { id, kind, x, y, proposed: true, props: [], purpose: "Engineer-placed component" };
  return { ok: true, id, design: { ...design, nodes: [...design.nodes, node] } };
}

export function connectNodes(design: Design, kind: LinkKind, from: string, to: string): EditResult {
  if (from === to) return { ok: false, title: "Connection Conflict", detail: "Source and destination must differ." };
  if (design.links.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from)))
    return { ok: false, title: "Connection Conflict", detail: "These nodes are already connected." };
  const id = nextId(design, kind === "pipe" ? "P" : "CH", kind === "pipe" ? 30 : 2);
  return { ok: true, id, design: { ...design, links: [...design.links, { id, kind, from, to, proposed: true, capacity: 100, length: 150, purpose: "Engineer-added connection" }] } };
}

export function updateLink(design: Design, id: string, patch: Partial<Pick<WsLink, "capacity" | "length" | "purpose">>): Design {
  return { ...design, links: design.links.map((l) => (l.id === id && l.proposed ? { ...l, ...patch } : l)) };
}
export function updateNodePurpose(design: Design, id: string, purpose: string): Design {
  return { ...design, nodes: design.nodes.map((n) => (n.id === id && n.proposed ? { ...n, purpose } : n)) };
}

export const WHY = ["Addresses the J3 → L2 bottleneck", "Uses existing infrastructure", "Reduces downstream hydraulic transfer", "Protects the lake", "Accounts for eastern low-point concentration", "Avoids high-risk construction zones"];
export const EXPLANATION: [string, string][] = [
  ["Problem Identified", "J3 → L2 is the primary bottleneck."],
  ["Terrain Influence", "Runoff concentrates toward the eastern low-point corridor."],
  ["Proposed Intervention", "Redirect part of peak runoff through J5 and temporary detention."],
  ["Downstream Protection", "Avoid increasing direct hydraulic load at O1."],
  ["Environmental Protection", "Protect the L2 water body from increased peak inflow."],
  ["Reliability Consideration", "L2 observation is stale and therefore treated with reduced confidence."],
];
export const STATUS_LEFT: [string, string, "ok" | "warn" | "crit"][] = [["Network", "Connected", "ok"], ["Terrain", "Analyzed", "ok"], ["Sensors", "89% Reliable", "ok"], ["Downstream", "Attention", "warn"], ["Environment", "High Priority", "crit"]];
