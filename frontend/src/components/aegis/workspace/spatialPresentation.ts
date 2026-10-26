// All sizes/positions in this module are unitless display geometry, not metres.
// Structural roles are presentation classifications, never hydraulic reasoning.
import type { Network, NetworkNode, CanonicalResponse } from "@/data/types";
import { layoutNetwork } from "@/data/networkLayout";
import {
  attentionTone,
  edgeCandidates,
  feasibilityTone,
  nodeCandidate,
  type Tone,
} from "@/lib/aegis";
import type { WorkspaceMode } from "./types";

export type StructureRole =
  "inlet" | "junction" | "downstream" | "storage" | "recharge" | "outlet" | "other";
export interface DisplayPosition {
  x: number;
  z: number;
}

export function structureRole(node: NetworkNode, network: Network): StructureRole {
  const type: string = node.type;
  if (["collection", "collection_inlet", "inlet", "drain"].includes(type)) return "inlet";
  if (["outlet", "outfall"].includes(type)) return "outlet";
  if (type === "storage" || type === "recharge") return type;
  if (type === "downstream_junction") return "downstream";
  if (type === "junction") {
    // A merge after intervention nodes is represented by a wider chamber.
    // This expresses connectivity only, not capacity or physical dimensions.
    const upstream = network.edges
      .filter((e) => e.to === node.id)
      .map((e) => network.nodes.find((n) => n.id === e.from));
    return upstream.some((n) => n?.type === "storage" || n?.type === "recharge")
      ? "downstream"
      : "junction";
  }
  return "other";
}

export function spatialLayout(network: Network) {
  const layout = layoutNetwork(network);
  const nodes: Record<string, DisplayPosition> = {};
  for (const node of Object.values(layout.nodes)) {
    nodes[node.id] = { x: (node.x - layout.width / 2) / 60, z: (node.y - layout.height / 2) / 60 };
  }
  return { nodes, edges: layout.edges, width: layout.width / 60, depth: layout.height / 60 };
}

export function routeMembership(data: CanonicalResponse) {
  const candidate =
    data.recommendation.recommendation_status === "recommended"
      ? data.candidates.find((c) => c.id === data.recommendation.selected_candidate_id)
      : undefined;
  const edges = new Set(candidate?.route_edge_ids ?? []);
  const nodes = new Set(
    candidate
      ? [
          candidate.node_id,
          ...data.network.edges.filter((e) => edges.has(e.id)).flatMap((e) => [e.from, e.to]),
        ]
      : [],
  );
  return { edges, nodes, candidate };
}

export function spatialNodeTone(
  data: CanonicalResponse,
  node: NetworkNode,
  mode: WorkspaceMode,
  healthDone: boolean,
): Tone {
  if (mode === "health") return healthDone ? attentionTone(data, node) : "neutral";
  if (mode === "simulate") {
    const c = nodeCandidate(data, node);
    return c ? feasibilityTone(c.feasible) : "neutral";
  }
  if (mode === "review") return routeMembership(data).nodes.has(node.id) ? "ok" : "neutral";
  return "neutral";
}

export function spatialEdgeTone(data: CanonicalResponse, id: string, mode: WorkspaceMode): Tone {
  if (mode === "review") return routeMembership(data).edges.has(id) ? "ok" : "neutral";
  if (mode === "simulate") {
    const c = edgeCandidates(data, id);
    return c.length === 1 && c[0] ? feasibilityTone(c[0].feasible) : c.length ? "info" : "neutral";
  }
  return "neutral";
}
