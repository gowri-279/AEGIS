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

/** Deterministic presentation-only graph placement; coordinates are never engineering data. */
export function layoutCanonicalNetwork(nodes: { id: string }[], edges: { from: string; to: string }[]): Record<string, Vec3> {
  const canonical = new Set(nodes.map((node) => node.id));
  if (!nodes.length) return {};
  const typeById = new Map(nodes.map((node) => [node.id, "type" in node ? String(node.type) : ""]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  const neighbors = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  edges.forEach(({ from, to }) => {
    if (!canonical.has(from) || !canonical.has(to)) return;
    outgoing.get(from)?.add(to);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
    neighbors.get(from)?.add(to);
    neighbors.get(to)?.add(from);
  });
  const levels = new Map<string, number>();
  const indegree = new Map(incoming);
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id).sort();
  queue.forEach((id) => levels.set(id, 0));
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    [...(outgoing.get(id) ?? [])].sort().forEach((next) => {
      levels.set(next, Math.max(levels.get(next) ?? 0, (levels.get(id) ?? 0) + 1));
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    });
  }
  if (visited !== nodes.length) {
    levels.clear();
    const starts = [...nodes].sort((a, b) => (neighbors.get(b.id)?.size ?? 0) - (neighbors.get(a.id)?.size ?? 0) || a.id.localeCompare(b.id));
    const bfs = [starts[0]!.id]; levels.set(bfs[0]!, 0);
    while (bfs.length) {
      const id = bfs.shift()!;
      [...(neighbors.get(id) ?? [])].sort().forEach((next) => {
        if (levels.has(next)) return;
        levels.set(next, levels.get(id)! + 1); bfs.push(next);
      });
    }
  }
  const maxLevel = Math.max(...levels.values());
  nodes.forEach((node) => { if (!levels.has(node.id)) levels.set(node.id, maxLevel + 1); });
  const groups = new Map<number, string[]>();
  nodes.forEach((node) => groups.set(levels.get(node.id)!, [...(groups.get(levels.get(node.id)!) ?? []), node.id]));
  const result: Record<string, Vec3> = {};
  groups.forEach((ids, level) => {
    const storage = ids.filter((id) => typeById.get(id) === "storage").sort();
    const other = ids.filter((id) => typeById.get(id) !== "storage").sort((a, b) => (typeById.get(a) ?? "").localeCompare(typeById.get(b) ?? "") || a.localeCompare(b));
    let otherIndex = 0;
    const ordered = new Array<string>(ids.length);
    storage.forEach((id, index) => { const slot = storage.length === 1 ? Math.floor((ids.length - 1) / 2) : Math.round(index * (ids.length - 1) / (storage.length - 1)); ordered[slot] = id; });
    for (let slot = 0; slot < ordered.length; slot++) if (!ordered[slot]) ordered[slot] = other[otherIndex++]!;
    const spacing = Math.min(17, Math.max(12, 34 / Math.max(1, ordered.length - 1)));
    ordered.forEach((id) => {
      const index = ordered.indexOf(id);
      result[id] = [(index - (ordered.length - 1) / 2) * spacing, 0, (level - maxLevel / 2) * 15];
    });
  });
  return result;
}
