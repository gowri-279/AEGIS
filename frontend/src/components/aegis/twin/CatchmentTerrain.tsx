import { useMemo, useRef } from "react";
import * as THREE from "three";
import { twinPalette } from "./materials";
import { surfaceY } from "./presentationLayout";
import { NETWORK } from "./visualConfig";

type Props = {
  blueprint: boolean;
  storageBasins: unknown[];
};

/** Subdued catchment plane — network layer remains the visual hero. */
export function CatchmentTerrain({ blueprint }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const size = NETWORK.terrainFootprint;
    const steps = 48;
    const vertices: number[] = [];
    const indices: number[] = [];
    const half = size / 2;
    for (let z = 0; z <= steps; z++) {
      for (let x = 0; x <= steps; x++) {
        const px = (x / steps) * size - half;
        const pz = (z / steps) * size - half;
        vertices.push(px, surfaceY(px, pz) * 0.35, pz);
      }
    }
    for (let z = 0; z < steps; z++) {
      for (let x = 0; x < steps; x++) {
        const a = x + z * (steps + 1);
        const b = a + 1;
        const c = a + steps + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group renderOrder={NETWORK.presentation.terrainRenderOrder}>
      <mesh ref={mesh} geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={blueprint ? twinPalette.terrain.blueprint : twinPalette.terrain.terrain}
          wireframe={false}
          roughness={0.98}
          metalness={0}
          transparent
          opacity={blueprint ? 0.92 : 0.88}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
