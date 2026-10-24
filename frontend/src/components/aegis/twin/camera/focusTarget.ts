import * as THREE from "three";
import type { CanonicalResponse } from "@/data/types";
import { surfaceY } from "../presentationLayout";
import type { NodeLayout } from "../types";
import { NETWORK } from "../visualConfig";

export function resolveFocusPoint(
  selected: string | null,
  data: CanonicalResponse,
  positions: NodeLayout,
): THREE.Vector3 | null {
  if (!selected) return null;

  const sensor = data.sensors.find((item) => item.id === selected);
  const nodeId = sensor?.node_id ?? selected;

  if (positions[nodeId]) {
    const [x, , z] = positions[nodeId]!;
    return new THREE.Vector3(x, surfaceY(x, z), z);
  }

  const edge = data.network.edges.find((item) => item.id === selected);
  if (edge && positions[edge.from] && positions[edge.to]) {
    const from = positions[edge.from]!;
    const to = positions[edge.to]!;
    const x = (from[0] + to[0]) / 2;
    const z = (from[2] + to[2]) / 2;
    const y = (surfaceY(from[0], from[2]) + surfaceY(to[0], to[2])) / 2 - NETWORK.conduit.buryDepth.default * 0.35;
    return new THREE.Vector3(x, y, z);
  }

  const riskTarget = data.risks.find((risk) => risk.target_id === selected)?.target_id;
  if (riskTarget && positions[riskTarget]) {
    const [x, , z] = positions[riskTarget]!;
    return new THREE.Vector3(x, surfaceY(x, z), z);
  }

  return null;
}

export function focusDistanceForSelection(
  selected: string | null,
  data: CanonicalResponse,
  span: number,
  currentOffset: THREE.Vector3,
): number {
  const sensor = selected ? data.sensors.find((item) => item.id === selected) : undefined;
  const nodeId = sensor?.node_id ?? selected;
  const node = nodeId ? data.network.nodes.find((item) => item.id === nodeId) : undefined;
  const edgeSelected = selected ? data.network.edges.some((edge) => edge.id === selected) : false;

  const byType = NETWORK.camera.focusDistanceByType;
  let preferred = byType.default;
  if (edgeSelected) preferred = byType.edge;
  else if (node?.type === "storage") preferred = byType.storage;
  else if (node?.type === "recharge") preferred = byType.recharge;
  else if (node?.type === "junction") preferred = byType.junction;

  const fromOrbit = currentOffset.length() * NETWORK.camera.focusOrbitScale;
  const spanScaled = span * NETWORK.camera.focusSpanScale;
  return THREE.MathUtils.clamp(
    Math.min(fromOrbit, preferred, spanScaled),
    NETWORK.camera.minFocusDistance,
    NETWORK.camera.maxFocusDistance,
  );
}

export function focusCameraOffset(distance: number, blueprint: boolean) {
  const pitch = blueprint ? NETWORK.camera.blueprintPitch : NETWORK.camera.terrainPitch;
  const yaw = NETWORK.camera.focusYaw;
  const horizontal = Math.cos(pitch) * distance;
  return new THREE.Vector3(
    Math.sin(yaw) * horizontal,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * horizontal,
  );
}
