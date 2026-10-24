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

function ConduitSurfaceTicks({ curve, dimmed }: { curve: THREE.CatmullRomCurve3; dimmed: boolean }) {
  const ends = useMemo(() => [curve.getPoint(0), curve.getPoint(1)], [curve]);
  return (
    <group>
      {ends.map((point, i) => (
        <mesh key={i} position={point} rotation-x={Math.PI / 2}>
          <torusGeometry args={[NETWORK.conduit.outerRadius * 1.35, 0.035, 8, 20]} />
          <meshStandardMaterial color="#7a827c" roughness={0.9} transparent opacity={dimmed ? 0.2 : 0.55} />
        </mesh>
      ))}
    </group>
  );
}

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
  const opacity = dimmed ? 0.16 : blueprint ? 0.94 : 0.96;
  const outerRadius = selected ? cfg.outerRadiusSelected : layoutRadius ?? cfg.outerRadius;
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
      renderOrder={NETWORK.presentation.conduitRenderOrder}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(edge.id);
      }}
    >
      <mesh>
        <tubeGeometry args={[curve, cfg.segments, outerRadius, cfg.radialSegments, false]} />
        <meshStandardMaterial
          color={pipeColor}
          roughness={blueprint ? 0.92 : 0.88}
          metalness={blueprint ? 0.02 : 0.06}
          transparent
          opacity={opacity}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, cfg.segments, cfg.innerRadius, 10, false]} />
        <meshStandardMaterial
          color={innerColor}
          emissive={blueprint ? "#000000" : innerColor}
          emissiveIntensity={blueprint ? 0 : cfg.innerEmissiveTerrain}
          roughness={0.82}
          transparent
          opacity={dimmed ? 0.12 : blueprint ? 0.85 : 0.82}
        />
      </mesh>
      {!blueprint && <ConduitSurfaceTicks curve={curve} dimmed={dimmed} />}
      <mesh position={arrowPoint} quaternion={arrowRotation}>
        <coneGeometry args={[cfg.arrowRadius * 0.92, cfg.arrowHeight, 10]} />
        <meshStandardMaterial
          color={blueprint ? twinPalette.network.pipeInnerBlueprint : "#4a5c60"}
          metalness={0.12}
          roughness={0.72}
          transparent
          opacity={dimmed ? 0.14 : 0.82}
        />
      </mesh>
      {simulationActive && <FlowDots curve={curve} dimmed={dimmed} />}
    </group>
  );
}
