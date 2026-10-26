/** Build Step 8 — Engineering Review mock rules. Pure helpers over the Build Workspace design; no hydraulics are computed. */
import { candidateDesign, KIND_LABEL, WS_CANDIDATES, type CandidateId, type Design } from "./buildWorkspace";

export const REVIEW_STEPS = ["Terrain", "Requirements", "Design Brief", "Network Assessment", "Build Workspace", "Simulation", "Engineering Review"];

export const REVIEW_PURPOSE = "Reduce upstream flood concentration while limiting additional downstream hydraulic load.";
export const REVIEW_CHECKLIST = ["Terrain constraints considered", "Existing infrastructure preserved where possible", "J3 bottleneck addressed", "Downstream load reduced", "Protected water body considered", "Eastern low-point corridor addressed"];
export const PROTECTED_MESSAGE = { title: "Existing Infrastructure Protected", detail: "Existing network components cannot be removed during design review." };

export type RemoveResult = { ok: true; design: Design } | { ok: false; title: string; detail: string };

/** Removes a proposed node (with its attached proposed links) or a proposed link. Existing infrastructure is protected. */
export function removeProposed(design: Design, id: string): RemoveResult {
  const node = design.nodes.find((n) => n.id === id);
  const link = design.links.find((l) => l.id === id);
  if (!node && !link) return { ok: false, title: "Nothing Selected", detail: "Select a proposed component to remove." };
  if ((node && !node.proposed) || (link && !link.proposed)) return { ok: false, ...PROTECTED_MESSAGE };
  if (node) {
    if (design.links.some((l) => !l.proposed && (l.from === id || l.to === id))) return { ok: false, ...PROTECTED_MESSAGE };
    return { ok: true, design: { nodes: design.nodes.filter((n) => n.id !== id), links: design.links.filter((l) => l.from !== id && l.to !== id) } };
  }
  return { ok: true, design: { ...design, links: design.links.filter((l) => l.id !== id) } };
}

/** Updates a proposed node's demo property rows and purpose. Existing nodes are unchanged. */
export function updateProposedNode(design: Design, id: string, props: [string, string][], purpose: string): Design {
  return { ...design, nodes: design.nodes.map((n) => (n.id === id && n.proposed ? { ...n, props, purpose } : n)) };
}

export interface DesignChange { sign: "+" | "−" | "~"; id: string; label: string }
/** Compares the current design to the last simulated design. */
export function designChanges(before: Design, after: Design): DesignChange[] {
  const out: DesignChange[] = [];
  const items = (d: Design) => new Map<string, { kind: string; key: string }>([
    ...d.nodes.map((n) => [n.id, { kind: KIND_LABEL[n.kind], key: JSON.stringify([n.props, n.purpose, n.x, n.y]) }] as const),
    ...d.links.map((l) => [l.id, { kind: KIND_LABEL[l.kind], key: JSON.stringify([l.capacity, l.length, l.purpose, l.from, l.to]) }] as const),
  ]);
  const a = items(before), b = items(after);
  for (const [id, v] of b) {
    const old = a.get(id);
    if (!old) out.push({ sign: "+", id, label: `New ${v.kind}` });
    else if (old.key !== v.key) out.push({ sign: "~", id, label: `Modified ${v.kind}` });
  }
  for (const [id, v] of a) if (!b.has(id)) out.push({ sign: "−", id, label: `Removed ${v.kind}` });
  return out;
}

/** Demo metrics: each completed engineer re-simulation nudges flood risk by −3 pp and downstream load by −2 pp (illustrative, capped at 3 runs). */
export function reviewMetrics(candidate: CandidateId, resims: number): [string, string][] {
  const base = WS_CANDIDATES.find((c) => c.id === candidate)!.metrics;
  const n = Math.min(resims, 3);
  return base.map(([k, v]) => {
    const num = parseInt(v.replace("-", "−").replace("−", "-"), 10);
    if (k === "Flood Risk") return [k, `−${Math.abs(num) + 3 * n}%`];
    if (k === "Downstream Load") return [k, `−${Math.abs(num) + 2 * n}%`];
    return [k, v.replace("-", "−")];
  });
}

export const initialDesign = (id: CandidateId) => candidateDesign(id);
