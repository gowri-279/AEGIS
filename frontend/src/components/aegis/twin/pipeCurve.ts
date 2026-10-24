import * as THREE from "three";
import type { NetworkEdge } from "@/data/types";
import { GREYBOX } from "./visualConfig";
import { surfaceY } from "./presentationLayout";
import type { NodeLayout } from "./types";

function buryDepthForNode(id: string, typeById: Map<string, string>) {
  const type = typeById.get(id);
  if (type === "junction") return GREYBOX.buryDepth.junction;
  if (type === "storage") return GREYBOX.buryDepth.storage;
  if (type === "recharge") return GREYBOX.buryDepth.recharge;
  return GREYBOX.buryDepth.default;
}

export function pipeCurve(
  edge: Pick<NetworkEdge, "from" | "to">,
  positions: NodeLayout,
  typeById: Map<string, string>,
  blueprint: boolean,
) {
  const from = positions[edge.from]!;
  const to = positions[edge.to]!;
  const fromY = surfaceY(from[0], from[2]) - (blueprint ? GREYBOX.blueprintPipeDepth : buryDepthForNode(edge.from, typeById));
  const toY = surfaceY(to[0], to[2]) - (blueprint ? GREYBOX.blueprintPipeDepth : buryDepthForNode(edge.to, typeById));
  const a = new THREE.Vector3(from[0], fromY, from[2]);
  const b = new THREE.Vector3(to[0], toY, to[2]);
  const mid = a.clone().lerp(b, 0.5);
  const bend = ((edge.from.length + edge.to.length) % 2 ? 1 : -1) * Math.min(1.8, a.distanceTo(b) * 0.08);
  mid.x += bend;
  mid.y -= Math.min(0.8, a.distanceTo(b) * 0.025);
  return new THREE.CatmullRomCurve3([a, mid, b], false, "catmullrom", 0.25);
}
