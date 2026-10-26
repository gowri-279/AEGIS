import { useEffect, useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { useSurfaceTexture } from "../workspace/CatchmentScene";

/** A unitless display plinth, not surveyed land or an engineering section. */
export function FloatingBlueprintBase({ width, depth, palette }: { width: number; depth: number; palette: Record<string, string> }) {
  const texture = useSurfaceTexture(palette);
  const grid = useMemo(() => {
    const points: number[] = [];
    for (let x = -width / 2; x <= width / 2; x += 1) points.push(x, -.98, -depth / 2, x, -.98, depth / 2);
    for (let z = -depth / 2; z <= depth / 2; z += 1) points.push(-width / 2, -.98, z, width / 2, -.98, z);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return geometry;
  }, [width, depth]);
  useEffect(() => () => grid.dispose(), [grid]);
  return <group name="floating-blueprint-base">
    <mesh position-y={-1.8} receiveShadow>
      <boxGeometry args={[width, 1.5, depth]} />
      <meshStandardMaterial color={palette["model-side"] ?? ""} map={texture} roughness={.78} metalness={.18} transparent opacity={.26} depthWrite={false} />
      <Edges color={palette["model-grid"] ?? ""} transparent opacity={.52} />
    </mesh>
    <lineSegments geometry={grid}><lineBasicMaterial color={palette["model-grid"] ?? ""} transparent opacity={.4} /></lineSegments>
    <mesh position-y={-2.56} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={palette["model-ground"] ?? ""} map={texture} roughness={.9} transparent opacity={.32} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  </group>;
}