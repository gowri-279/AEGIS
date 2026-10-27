import type { CanonicalResponse } from "@/data/types";

// Fixed animation time per topology hop, never an engineering travel time.
export const FLOW_HOP_SECONDS = 0.55;

/** Select visual paths only; supplied feasibility/recommendations remain authoritative.
 * Upstream/downstream context is illustrative connectivity, not validated capacity.
 */
export function simulationFlowPlan(data: CanonicalResponse, phase: "idle" | "running" | "done") {
  const stages = new Map<string, number>();
  try {
    if (phase === "idle") return stages;
    if (!data?.network?.nodes?.length || !data.network.edges) return stages;
    const recommendation = data.recommendation;
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const recommended = recommendation?.recommendation_status === "recommended"
      ? candidates.find((candidate) => candidate.id === recommendation.selected_candidate_id) : undefined;
    const routes = new Set(recommended?.eligible && recommended.feasible === true ? (recommended.route_edge_ids ?? []) : []);
    if (phase === "done" && routes.size === 0) return stages;
    const candidateEdges = new Set(candidates.flatMap((candidate) => candidate.route_edge_ids ?? []));
    const nodes = new Map(data.network.nodes.map((node) => [node.id, node]));
    const allowed = data.network.edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)
      && nodes.get(edge.from)?.type !== "recharge"
      && (phase === "running" || !candidateEdges.has(edge.id) || routes.has(edge.id)));
    const queue = data.network.nodes.filter((node) => node.type === "collection_inlet").map((node) => ({ id: node.id, stage: 0 }));
    const visited = new Set<string>();
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const entry = queue[cursor];
      if (!entry || visited.has(entry.id)) continue;
      visited.add(entry.id);
      for (const edge of allowed.filter((edge) => edge.from === entry.id)) {
        stages.set(edge.id, entry.stage);
        queue.push({ id: edge.to, stage: entry.stage + 1 });
      }
    }
  } catch (error) {
    console.warn("[aegis] simulationFlowPlan failed", error);
  }
  return stages;
}

/** A directed pulse arrives on the next hop only after traversing this one. */
export function flowPulseProgress(elapsed: number, stage: number, lastStage: number, hopSeconds = FLOW_HOP_SECONDS) {
  const period = (lastStage + 1) * hopSeconds + 0.8;
  const cycle = ((elapsed % period) + period) % period;
  const progress = (cycle - stage * hopSeconds) / hopSeconds;
  return progress >= 0 && progress <= 1 ? progress : null;
}