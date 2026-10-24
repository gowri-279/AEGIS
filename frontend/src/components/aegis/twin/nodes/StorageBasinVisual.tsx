import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { twinPalette } from "../materials";
import { NETWORK } from "../visualConfig";
import { buildStorageBasinGeometry } from "./geometries/storageBasinGeometry";
import type { BasinPort } from "./nodePorts";
import { PipeTransitionCollar } from "./PipeTransitionCollar";

type Props = {
  blueprint: boolean;
  selected: boolean;
  dimmed: boolean;
  seed: number;
  variantIndex: number;
  ports: BasinPort[];
};

export function StorageBasinVisual({ blueprint, selected, dimmed, seed, variantIndex, ports }: Props) {
  const variant = NETWORK.storage.variants[variantIndex % NETWORK.storage.variants.length]!;
  const geometries = useMemo(() => buildStorageBasinGeometry(seed, variant), [seed, variant]);
  const water = useRef<THREE.Mesh>(null);
  const palette = blueprint ? twinPalette.network.storage.blueprint : twinPalette.network.storage;
  const { rx, rz } = geometries.basinRadii;
  const cfg = NETWORK.storage;

  useFrame(({ clock }) => {
    if (!water.current) return;
    water.current.position.y = cfg.waterRestY + Math.sin(clock.elapsedTime * 0.36 + seed) * cfg.waterRipple;
  });

  return (
    <group>
      <mesh geometry={geometries.outerBank} receiveShadow>
        <meshStandardMaterial color={palette.outerBank} side={THREE.DoubleSide} roughness={0.96} transparent={dimmed} opacity={dimmed ? 0.58 : 1} />
      </mesh>
      <mesh geometry={geometries.innerBank} receiveShadow>
        <meshStandardMaterial color={palette.innerBank} side={THREE.DoubleSide} roughness={0.92} transparent={dimmed} opacity={dimmed ? 0.6 : 1} />
      </mesh>
      <mesh geometry={geometries.shallowShelf} receiveShadow>
        <meshStandardMaterial color={palette.shelf} side={THREE.DoubleSide} roughness={0.75} transparent={dimmed} opacity={dimmed ? 0.62 : 1} />
      </mesh>
      <mesh ref={water} geometry={geometries.water} rotation-x={-Math.PI / 2}>
        <meshPhysicalMaterial
          color={palette.water}
          emissive={palette.waterEmissive}
          emissiveIntensity={0}
          roughness={blueprint ? 0.35 : 0.18}
          metalness={0.02}
          clearcoat={blueprint ? 0.35 : 0.72}
          clearcoatRoughness={0.22}
          reflectivity={0.55}
          ior={1.33}
          side={THREE.DoubleSide}
          transparent={dimmed}
          opacity={dimmed ? 0.72 : blueprint ? 0.88 : 0.94}
        />
      </mesh>
      <lineLoop geometry={geometries.outline} position={[0, cfg.waterRestY + cfg.outlineLift, 0]}>
        <lineBasicMaterial
          color={selected ? palette.outlineSelected : palette.outline}
          transparent
          opacity={blueprint ? 0.88 : 0.46}
        />
      </lineLoop>
      {ports.map((port, i) => (
        <group
          key={`${port.direction}-${i}`}
          position={[port.x * rx * 1.02, -0.04, port.z * rz * 1.02]}
          rotation-y={Math.atan2(port.x, port.z)}
        >
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[cfg.portStructureWidth, 0.3, 0.46]} />
            <meshStandardMaterial color={palette.port} roughness={0.78} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.07, 0.24]}>
            <boxGeometry args={[0.36, 0.16, 0.025]} />
            <meshStandardMaterial color={palette.portGrate} roughness={0.86} metalness={0.08} />
          </mesh>
          <PipeTransitionCollar blueprint={blueprint} dimmed={dimmed} x={0} z={0.38} rotationY={0} />
        </group>
      ))}
    </group>
  );
}
