import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/data/networkLayout";
import { twinPalette } from "./materials";
import { surfaceY } from "./presentationLayout";
import { GREYBOX } from "./visualConfig";

type Props = {
  blueprint: boolean;
  storageBasins: Vec3[];
};

/** Phase 1 greybox terrain — replace with heightfield art in a later pass. */
export function CatchmentTerrain({ blueprint, storageBasins }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const size = GREYBOX.terrainSize;
    const steps = 64;
    const vertices: number[] = [];
    const indices: number[] = [];
    const half = size / 2;
    for (let z = 0; z <= steps; z++) {
      for (let x = 0; x <= steps; x++) {
        const px = (x / steps) * size - half;
        const pz = (z / steps) * size - half;
        vertices.push(px, surfaceY(px, pz), pz);
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
    <group>
      <mesh ref={mesh} geometry={geometry} receiveShadow rotation={[0, 0, 0]}>
        <meshStandardMaterial
          color={blueprint ? twinPalette.terrain.blueprint : twinPalette.terrain.terrain}
          wireframe={blueprint}
          roughness={0.92}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
      {!blueprint &&
        storageBasins.map((basin, i) => (
          <mesh
            key={i}
            rotation-x={-Math.PI / 2}
            position={[basin[0], surfaceY(basin[0], basin[2]) - 0.02, basin[2]]}
          >
            <circleGeometry args={[4.8, 28]} />
            <meshStandardMaterial color="#5a8a96" transparent opacity={0.35} />
          </mesh>
        ))}
    </group>
  );
}
