import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

export function CompartmentHighlight({ palette }: { palette: Record<string, string> }) {
  return (
    <group name="demo-amber-compartment" position-y={-0.15}>
      <mesh>
        <boxGeometry args={[2.6, 2.3, 2.6]} />
        <meshBasicMaterial
          color={palette["warn"] ?? ""}
          transparent
          opacity={0.045}
          depthWrite={false}
        />
        <Edges color={palette["warn"] ?? ""} transparent opacity={0.72} />
      </mesh>
      <mesh>
        <boxGeometry args={[2.68, 2.38, 2.68]} />
        <meshBasicMaterial
          color={palette["warn"] ?? ""}
          transparent
          opacity={0.018}
          depthWrite={false}
        />
        <Edges color={palette["warn"] ?? ""} transparent opacity={0.12} />
      </mesh>
      <pointLight color={palette["warn"] ?? ""} intensity={0.65} distance={4} decay={2} />
    </group>
  );
}

export function JunctionSensor({
  palette,
  reduced,
}: {
  palette: Record<string, string>;
  reduced: boolean;
}) {
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useRef(0);
  useFrame((_, rawDelta) => {
    if (!halo.current || reduced) return;
    phase.current += Math.min(rawDelta, 0.05);
    halo.current.opacity = 0.1 + 0.06 * Math.sin(phase.current * 2.2);
  });
  return (
    <group name="demo-j1-sensor" position-y={0.78}>
      <mesh position-y={-0.22}>
        <cylinderGeometry args={[0.035, 0.035, 0.38, 8]} />
        <meshStandardMaterial color={palette["model-metal"] ?? ""} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshBasicMaterial color={palette["crit"] ?? ""} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshBasicMaterial
          ref={halo}
          color={palette["crit"] ?? ""}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
      <pointLight color={palette["crit"] ?? ""} intensity={0.35} distance={2} />
    </group>
  );
}
