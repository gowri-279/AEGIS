// PRESENTATION-ONLY layout for the canonical network.
// Positions are generated from topology (edge direction) purely for display.
// They are NOT engineering coordinates, elevations or lengths and must never
// be fed back into any engineering reasoning.
import type { Network } from "./types";

export interface LayoutPoint {
  x: number;
  y: number;
}
export interface LayoutNode extends LayoutPoint {
  id: string;
  layer: number;
}
export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  mid: LayoutPoint;
}
export interface NetworkLayout {
  width: number;
  height: number;
  nodes: Record<string, LayoutNode>;
  edges: LayoutEdge[];
}

const COL = 336;
const ROW = 192;
const PAD_X = 150;
const PAD_Y = 120;
const NODE_R = 30;
const MIN_W = 780;
const MIN_H = 520;

/** Layered left→right layout derived only from edge direction. Works for any IDs. */
export function layoutNetwork(network: Network): NetworkLayout {
  const ids = network.nodes.map((n) => n.id);
  const known = new Set(ids);
  const edges = network.edges.filter(
    (e) => known.has(e.from) && known.has(e.to) && e.from !== e.to,
  );

  // Longest-path layering with a relaxation cap so cycles cannot loop forever.
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let i = 0; i < ids.length; i++) {
    let changed = false;
    for (const e of edges) {
      const next = (layer.get(e.from) ?? 0) + 1;
      if (next > (layer.get(e.to) ?? 0) && next < ids.length) {
        layer.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Isolated nodes (no edges at all) are placed in their own trailing column.
  const connected = new Set(edges.flatMap((e) => [e.from, e.to]));
  const maxLayer = Math.max(
    0,
    ...ids.filter((id) => connected.has(id)).map((id) => layer.get(id) ?? 0),
  );
  for (const id of ids) if (!connected.has(id) && edges.length) layer.set(id, maxLayer + 1);

  const columns = new Map<number, string[]>();
  for (const id of ids) {
    const l = layer.get(id) ?? 0;
    columns.set(l, [...(columns.get(l) ?? []), id]);
  }
  const colCount = Math.max(1, ...[...columns.keys()].map((k) => k + 1));
  const rowCount = Math.max(1, ...[...columns.values()].map((c) => c.length));
  // Minimum canvas so small networks are not blown up; content is centred.
  const contentW = (colCount - 1) * COL;
  const contentH = (rowCount - 1) * ROW;
  const width = Math.max(MIN_W, PAD_X * 2 + contentW);
  const height = Math.max(MIN_H, PAD_Y * 2 + contentH);
  const originX = (width - contentW) / 2;
  const originY = (height - contentH) / 2;

  const nodes: Record<string, LayoutNode> = {};
  for (const [l, col] of columns) {
    const offset = ((rowCount - col.length) * ROW) / 2;
    col.forEach((id, i) => {
      nodes[id] = { id, layer: l, x: originX + l * COL, y: originY + offset + i * ROW };
    });
  }

  const laidEdges: LayoutEdge[] = edges.map((e) => {
    const a = nodes[e.from]!;
    const b = nodes[e.to]!;
    const dir = b.x >= a.x ? 1 : -1;
    const x1 = a.x + NODE_R * dir;
    const x2 = b.x - NODE_R * dir;
    const mx = (x1 + x2) / 2;
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      d: `M ${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`,
      mid: { x: mx, y: (a.y + b.y) / 2 },
    };
  });

  return { width, height, nodes, edges: laidEdges };
}
