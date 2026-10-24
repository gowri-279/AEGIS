import { useMemo } from "react";
import * as THREE from "three";
import { twinPalette } from "../materials";
import { NETWORK } from "../visualConfig";
import type { BasinPort } from "./nodePorts";
import { PipeTransitionCollar } from "./PipeTransitionCollar";

type Props = {
  blueprint: boolean;
  dimmed: boolean;
  seed: number;
  ports: BasinPort[];
};

export function RechargeStructureVisual({ blueprint, dimmed, seed, ports }: Props) {
  const cfg = NETWORK.recharge;
  const palette = blueprint ? twinPalette.network.recharge.blueprint : twinPalette.network.recharge;
  const basin = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const r = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.035 * Math.cos(a * 5);
      const p: [number, number] = [Math.cos(a) * cfg.basinRadiusX * r, Math.sin(a) * cfg.basinRadiusZ * r];
      if (!i) shape.moveTo(...p);
      else shape.lineTo(...p);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [cfg.basinRadiusX, cfg.basinRadiusZ, seed]);

  return (
    <group>
      <mesh geometry={basin} rotation-x={-Math.PI / 2} position={[0, -0.06, 0]}>
        <meshStandardMaterial color={palette.basin} side={THREE.DoubleSide} roughness={1} transparent={dimmed} opacity={dimmed ? 0.58 : 1} />
      </mesh>
      {cfg.terraceRadii.map((r, i) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.025 + i * 0.018, 0]}>
          <ringGeometry args={[r, r + (i ? 0.035 : 0.12), 56]} />
          <meshStandardMaterial color={i ? palette.terraceInner : palette.terrace} roughness={0.96} />
        </mesh>
      ))}
      <mesh position={[0, 0.065, 0]}>
        <cylinderGeometry args={[cfg.shaftRadius, cfg.shaftRadius * 1.12, 0.16, 16]} />
        <meshStandardMaterial color={palette.shaft} metalness={0.16} roughness={0.78} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.15, 0]}>
        <circleGeometry args={[cfg.grateRadius, 16]} />
        <meshStandardMaterial color={palette.grate} roughness={0.78} />
      </mesh>
      {Array.from({ length: cfg.infiltrationRingCount }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.04 + i * 0.015, 0]}>
          <ringGeometry args={[1.35 + i * 0.35, 1.48 + i * 0.35, 40]} />
          <meshStandardMaterial color={palette.terraceInner} roughness={0.94} transparent opacity={0.65} />
        </mesh>
      ))}
      {ports.map((port, i) => (
        <PipeTransitionCollar
          key={`${port.direction}-${i}`}
          blueprint={blueprint}
          dimmed={dimmed}
          x={port.x * cfg.basinRadiusX * 0.95}
          z={port.z * cfg.basinRadiusZ * 0.95}
          rotationY={Math.atan2(port.x, port.z)}
        />
      ))}
    </group>
  );
}
