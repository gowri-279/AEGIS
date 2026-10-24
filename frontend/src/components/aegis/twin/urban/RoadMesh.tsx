import { useMemo } from "react";
import * as THREE from "three";
import { catchmentHeight, type CatchmentModel } from "../catchment/catchmentModel";
import { twinPalette } from "../materials";
import type { RoadSegment } from "./urbanLayout";

function roadGeometry(
  model: CatchmentModel,
  x: number,
  z: number,
  width: number,
  length: number,
  rotation: number,
  lift = 0,
) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const steps = Math.max(2, Math.ceil(length / 2));
  const base = catchmentHeight(model, x, z);
  for (let i = 0; i <= steps; i++) {
    const localZ = (i / steps - 0.5) * length;
    for (const side of [-1, 1]) {
      const localX = (side * width) / 2;
      const worldX = x + localX * Math.cos(rotation) + localZ * Math.sin(rotation);
      const worldZ = z - localX * Math.sin(rotation) + localZ * Math.cos(rotation);
      vertices.push(localX, catchmentHeight(model, worldX, worldZ) - base + lift, localZ);
    }
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function RoadMesh({
  road,
  model,
  blueprint,
  subdue = false,
}: {
  road: RoadSegment;
  model: CatchmentModel;
  blueprint: boolean;
  subdue?: boolean;
}) {
  const fade = subdue ? 0.58 : 1;
  const shoulder = useMemo(
    () => roadGeometry(model, road.x, road.z, road.width + 0.42, road.length, road.rotation),
    [model, road],
  );
  const asphalt = useMemo(
    () => roadGeometry(model, road.x, road.z, road.width, road.length, road.rotation, 0.032),
    [model, road],
  );
  const y = catchmentHeight(model, road.x, road.z);
  return (
    <group position={[road.x, y + 0.05, road.z]} rotation-y={road.rotation}>
      <mesh geometry={shoulder} receiveShadow>
        <meshStandardMaterial color={blueprint ? twinPalette.urban.blueprint : "#77796e"} roughness={1} side={THREE.DoubleSide} transparent={subdue} opacity={fade} />
      </mesh>
      <mesh geometry={asphalt} receiveShadow>
        <meshStandardMaterial
          color={blueprint ? "#24363a" : road.primary ? "#5d605a" : "#666960"}
          roughness={0.88}
          side={THREE.DoubleSide}
          transparent={subdue}
          opacity={fade}
        />
      </mesh>
    </group>
  );
}
