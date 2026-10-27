import type { CanonicalResponse } from "@/data/types";

// Presentation cadence only: no measured velocity or modeled hydraulic timing.
export const NETWORK_FLOW_HOP_SECONDS = 1.1;

/** Normal connectivity, not a simulation recommendation or proof of live discharge.
 * Eligibility is supplied; scenario feasibility must not become operational status.
 */
export function networkFlowPlan(data: CanonicalResponse) {
  const nodes = new Map(data.network.nodes.map((node) => [node.id, node]));
  const unavailable = new Set(data.candidates.filter((candidate) => !candidate.eligible).map((candidate) => candidate.node_id));
  for (const node of nodes.values()) {
    if (node.attributes["recharge_eligibility"] === "ineligible") unavailable.add(node.id);
  }
  const edges = data.network.edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)
    && !unavailable.has(edge.from) && !unavailable.has(edge.to)
    && nodes.get(edge.from)?.type !== "recharge");
  const reachable = new Set(data.network.nodes.filter((node) => node.type === "collection_inlet" && !unavailable.has(node.id)).map((node) => node.id));
  const queue = [...reachable];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const edge of edges.filter((edge) => edge.from === queue[cursor])) {
      if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
    }
  }
  const incoming = new Map([...reachable].map((id) => [id, edges.filter((edge) => edge.to === id && reachable.has(edge.from)).length]));
  const arrivals = new Map<string, number>();
  const ready = [...reachable].filter((id) => incoming.get(id) === 0);
  const stages = new Map<string, number>();
  // A merge waits for the last incoming visual hop; this is graph timing, not physics.
  for (let cursor = 0; cursor < ready.length; cursor++) {
    const id = ready[cursor];
    if (id === undefined) continue;
    const stage = arrivals.get(id) ?? 0;
    for (const edge of edges.filter((edge) => edge.from === id)) {
      stages.set(edge.id, stage);
      arrivals.set(edge.to, Math.max(arrivals.get(edge.to) ?? 0, stage + 1));
      const remaining = (incoming.get(edge.to) ?? 0) - 1;
      incoming.set(edge.to, remaining);
      if (remaining === 0) ready.push(edge.to);
    }
  }
  return stages;
}