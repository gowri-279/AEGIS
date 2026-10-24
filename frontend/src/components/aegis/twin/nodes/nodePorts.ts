import type { NetworkEdge } from "@/data/types";
import type { NodeLayout } from "../types";

export type BasinPort = { x: number; z: number; direction: "inlet" | "outlet" };

export function portsForNode(nodeId: string, edges: NetworkEdge[], positions: NodeLayout): BasinPort[] {
  return edges.flatMap((edge) => {
    const isIncoming = edge.to === nodeId;
    const isOutgoing = edge.from === nodeId;
    if (!isIncoming && !isOutgoing) return [];
    const other = positions[isIncoming ? edge.from : edge.to];
    if (!other) return [];
    const dx = other[0] - positions[nodeId]![0];
    const dz = other[2] - positions[nodeId]![2];
    const length = Math.hypot(dx, dz) || 1;
    return [{ x: dx / length, z: dz / length, direction: isIncoming ? ("inlet" as const) : ("outlet" as const) }];
  });
}
