import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DisplayPosition } from "./spatialPresentation";
import { DIAGNOSTIC_SWEEP_MS } from "./useDiagnosticScan";

/** Diagnostic presentation only: passes through surface and subsurface, evaluates nothing. */
export function DiagnosticSweep({
  width,
  depth,
  points,
  startedAt,
  color,
  reduced,
}: {
  width: number;
  depth: number;
  points: DisplayPosition[];
  startedAt: number;
  color: string;
  reduced: boolean;
}) {
  const plane = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const materials = useMemo(
    () =>
      points.map(
        () =>
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }),
      ),
    [points, color],
  );
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  useFrame(() => {
    const elapsed = Math.max(0, performance.now() - startedAt);
    const progress = Math.min(1, elapsed / DIAGNOSTIC_SWEEP_MS);
    const x = -(width + 3) / 2 + progress * (width + 3);
    if (plane.current) {
      plane.current.position.x = x;
      plane.current.visible = progress < 1;
    }
    materials.forEach((material, index) => {
      const point = points[index];
      material.opacity =
        point && !reduced ? Math.max(0, 1 - Math.abs(point.x - x) / 1.2) * 0.65 : 0.15;
    });
  });
  return (
    <>
      <group ref={plane} name="diagnostic-sweep" position-y={-0.2}>
        <mesh rotation-y={Math.PI / 2}>
          <planeGeometry args={[depth + 3, 3.4]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={reduced ? 0.05 : 0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position-y={0.5}>
          <boxGeometry args={[0.025, 0.035, depth + 3]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
      <group ref={rings}>
        {points.map((point, index) => {
          const material = materials[index];
          return material ? (
            <mesh
              key={index}
              position={[point.x, 0.035, point.z]}
              rotation-x={-Math.PI / 2}
              material={material}
            >
              <ringGeometry args={[1.1, 1.23, 48]} />
            </mesh>
          ) : null;
        })}
      </group>
    </>
  );
}
