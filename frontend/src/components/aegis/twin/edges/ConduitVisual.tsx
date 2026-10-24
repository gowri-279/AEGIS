import { useMemo } from "react";
import * as THREE from "three";
import type { NetworkEdge } from "@/data/types";
import { twinPalette } from "../materials";
import { pipeCurve } from "../pipeCurve";
import type { NodeLayout } from "../types";
import { GREYBOX } from "../visualConfig";
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
  const opacity = dimmed ? 0.18 : 0.9;
  const radius = selected ? GREYBOX.pipeRadiusSelected : GREYBOX.pipeRadius;
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

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(edge.id);
      }}
    >
      <mesh>
        <tubeGeometry args={[curve, 64, radius, 14, false]} />
        <meshStandardMaterial color={pipeColor} roughness={0.82} metalness={0.1} transparent opacity={opacity} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 64, 0.07, 10, false]} />
        <meshStandardMaterial
          color={blueprint ? "#12bade" : "#247a91"}
          emissive={blueprint ? "#087c98" : "#064052"}
          emissiveIntensity={blueprint ? 0.22 : 0.08}
          roughness={0.72}
          transparent
          opacity={dimmed ? 0.12 : 0.92}
        />
      </mesh>
      <mesh position={arrowPoint} quaternion={arrowRotation}>
        <coneGeometry args={[0.24, 0.56, 8]} />
        <meshStandardMaterial
          color={blueprint ? "#27c9e8" : "#51676a"}
          metalness={0.25}
          roughness={0.55}
          transparent
          opacity={dimmed ? 0.15 : 0.88}
        />
      </mesh>
      {simulationActive && <FlowDots curve={curve} dimmed={dimmed} />}
    </group>
  );
}
