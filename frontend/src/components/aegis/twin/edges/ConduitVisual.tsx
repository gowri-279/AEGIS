import { useMemo } from "react";
import * as THREE from "three";
import { edgeLayout } from "@/data/networkLayout";
import type { NetworkEdge } from "@/data/types";
import { twinPalette } from "../materials";
import { pipeCurve } from "../pipeCurve";
import type { NodeLayout } from "../types";
import { NETWORK } from "../visualConfig";
import { FlowDots } from "../effects/FlowDots";

type Props = {
  edge: NetworkEdge;
  positions: NodeLayout;
  typeById: Map<string, string>;
  selected: boolean;
  connected: boolean;
  dimmed: boolean;
  blueprint: boolean;
  onSelect: (id: string) => void;
  simulationActive: boolean;
};

export function ConduitVisual({
  edge,
  positions,
  typeById,
  selected,
  connected,
  dimmed,
  blueprint,
  onSelect,
  simulationActive,
}: Props) {
  const curve = useMemo(
    () => pipeCurve(edge, positions, typeById, blueprint),
    [blueprint, edge, positions, typeById],
  );
  const cfg = NETWORK.conduit;
  const layoutRadius = edge.id ? edgeLayout[edge.id]?.radius : undefined;
  const opacity = dimmed ? 0.18 : 0.92;
  const outerRadius = selected
    ? cfg.outerRadiusSelected
    : layoutRadius ?? cfg.outerRadius;
  const arrowPoint = curve.getPoint(0.72);
  const arrowTangent = curve.getTangent(0.72);
  const arrowRotation = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowTangent),
    [arrowTangent],
  );
  const pipeColor = selected
    ? twinPalette.network.pipeSelected
    : connected
      ? twinPalette.network.pipeConnected
      : blueprint
        ? twinPalette.network.pipeBlueprint
        : twinPalette.network.pipe;
  const innerColor = blueprint ? twinPalette.network.pipeInnerBlueprint : twinPalette.network.pipeInner;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(edge.id);
      }}
    >
      <mesh>
        <tubeGeometry args={[curve, cfg.segments, outerRadius, cfg.radialSegments, false]} />
        <meshStandardMaterial color={pipeColor} roughness={0.84} metalness={0.08} transparent opacity={opacity} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, cfg.segments, cfg.innerRadius, 10, false]} />
        <meshStandardMaterial
          color={innerColor}
          emissive={innerColor}
          emissiveIntensity={
            blueprint ? cfg.innerEmissiveBlueprint : cfg.innerEmissiveTerrain
          }
          roughness={0.74}
          transparent
          opacity={dimmed ? 0.14 : 0.9}
        />
      </mesh>
      <mesh position={arrowPoint} quaternion={arrowRotation}>
        <coneGeometry args={[cfg.arrowRadius, cfg.arrowHeight, 10]} />
        <meshStandardMaterial
          color={blueprint ? twinPalette.network.pipeInnerBlueprint : "#51676a"}
          metalness={0.2}
          roughness={0.58}
          transparent
          opacity={dimmed ? 0.16 : 0.86}
        />
      </mesh>
      {simulationActive && <FlowDots curve={curve} dimmed={dimmed} />}
    </group>
  );
}
