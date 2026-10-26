import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

export function CompartmentHighlight({ palette }: { palette: Record<string, string> }) {
  return <group name="demo-amber-compartment" position-y={-.15}>
    <mesh><boxGeometry args={[2.6, 2.3, 2.6]} /><meshBasicMaterial color={palette["warn"] ?? ""} transparent opacity={.045} depthWrite={false} /><Edges color={palette["warn"] ?? ""} transparent opacity={.72} /></mesh>
    <mesh><boxGeometry args={[2.68, 2.38, 2.68]} /><meshBasicMaterial color={palette["warn"] ?? ""} transparent opacity={.018} depthWrite={false} /><Edges color={palette["warn"] ?? ""} transparent opacity={.12} /></mesh>
    <pointLight color={palette["warn"] ?? ""} intensity={.65} distance={4} decay={2} />
  </group>;
}

export function JunctionSensor({ palette, reduced }: { palette: Record<string, string>; reduced: boolean }) {
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useRef(0);
  useFrame((_, rawDelta) => {
    if (!halo.current || reduced) return;
    phase.current += Math.min(rawDelta, .05);
    halo.current.opacity = .1 + .06 * Math.sin(phase.current * 2.2);
  });
  return <group name="demo-j1-sensor" position-y={.78}>
    <mesh position-y={-.22}><cylinderGeometry args={[.035, .035, .38, 8]} /><meshStandardMaterial color={palette["model-metal"] ?? ""} /></mesh>
    <mesh><sphereGeometry args={[.1, 16, 12]} /><meshBasicMaterial color={palette["crit"] ?? ""} /></mesh>
    <mesh><sphereGeometry args={[.24, 16, 12]} /><meshBasicMaterial ref={halo} color={palette["crit"] ?? ""} transparent opacity={.12} depthWrite={false} /></mesh>
    <pointLight color={palette["crit"] ?? ""} intensity={.35} distance={2} />
  </group>;
}