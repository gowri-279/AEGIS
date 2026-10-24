import * as THREE from "three";
import { edgeLayout } from "@/data/networkLayout";
import type { NetworkEdge } from "@/data/types";
import { NETWORK } from "./visualConfig";
import { surfaceY } from "./presentationLayout";
import type { NodeLayout } from "./types";

function buryDepthForNode(id: string, typeById: Map<string, string>) {
  const type = typeById.get(id);
  const depths = NETWORK.conduit.buryDepth;
  if (type === "junction") return depths.junction;
  if (type === "storage") return depths.storage;
  if (type === "recharge") return depths.recharge;
  return depths.default;
}

function pointAt(x: number, z: number, blueprint: boolean, nodeId: string, typeById: Map<string, string>) {
  const depth = blueprint ? NETWORK.conduit.blueprintDepth : buryDepthForNode(nodeId, typeById);
  return new THREE.Vector3(x, surfaceY(x, z) - depth, z);
}

export function pipeCurve(
  edge: Pick<NetworkEdge, "id" | "from" | "to">,
  positions: NodeLayout,
  typeById: Map<string, string>,
  blueprint: boolean,
) {
  const from = positions[edge.from]!;
  const to = positions[edge.to]!;
  const a = pointAt(from[0], from[2], blueprint, edge.from, typeById);
  const b = pointAt(to[0], to[2], blueprint, edge.to, typeById);

  const routed = !blueprint && edge.id && edgeLayout[edge.id]?.via;
  if (routed) {
    const midDepth =
      (buryDepthForNode(edge.from, typeById) + buryDepthForNode(edge.to, typeById)) / 2;
    const via = edgeLayout[edge.id]!.via.map(([x, yOffset, z]) => {
      const base = surfaceY(x, z) - midDepth;
      return new THREE.Vector3(x, base + (yOffset ?? 0), z);
    });
    return new THREE.CatmullRomCurve3([a, ...via, b], false, "catmullrom", 0.25);
  }

  const mid = a.clone().lerp(b, 0.5);
  const bend = ((edge.from.length + edge.to.length) % 2 ? 1 : -1) * Math.min(1.8, a.distanceTo(b) * 0.08);
  mid.x += bend;
  mid.y -= Math.min(0.8, a.distanceTo(b) * 0.025);
  return new THREE.CatmullRomCurve3([a, mid, b], false, "catmullrom", 0.25);
}
