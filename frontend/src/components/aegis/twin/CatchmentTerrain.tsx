import { useMemo, useRef } from "react";
import * as THREE from "three";
import { catchmentHeight, type CatchmentModel } from "./catchment/catchmentModel";
import { createTerrainBlueprintTexture, createTerrainGroundTexture } from "./catchment/catchmentTextures";
import { CATCHMENT, NETWORK } from "./visualConfig";

type Props = {
  blueprint: boolean;
  model: CatchmentModel;
};

export function CatchmentTerrain({ blueprint, model }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const groundTexture = useMemo(() => createTerrainGroundTexture(), []);
  const blueprintTexture = useMemo(() => createTerrainBlueprintTexture(), []);

  const geometry = useMemo(() => {
    const size = model.halfSize * 2;
    const steps = CATCHMENT.meshSteps;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const [cx, , cz] = model.bounds.center;
    for (let z = 0; z <= steps; z++) {
      for (let x = 0; x <= steps; x++) {
        const px = (x / steps - 0.5) * size + cx;
        const pz = (z / steps - 0.5) * size + cz;
        vertices.push(px, catchmentHeight(model, px, pz), pz);
        uvs.push(x / steps, z / steps);
      }
    }
    for (let z = 0; z < steps; z++) {
      for (let x = 0; x < steps; x++) {
        const i = z * (steps + 1) + x;
        indices.push(i, i + steps + 1, i + 1, i + 1, i + steps + 1, i + steps + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [model]);

  return (
    <group renderOrder={NETWORK.presentation.terrainRenderOrder}>
      <mesh ref={mesh} geometry={geometry} receiveShadow>
        <meshStandardMaterial
          map={blueprint ? blueprintTexture : groundTexture}
          color="#ffffff"
          roughness={0.96}
          metalness={0}
          side={THREE.DoubleSide}
          transparent={blueprint}
          opacity={blueprint ? 0.94 : 1}
        />
      </mesh>
      {!blueprint &&
        model.storageDepressions.map((basin, i) => (
          <mesh
            key={i}
            rotation-x={-Math.PI / 2}
            position={[basin.x, catchmentHeight(model, basin.x, basin.z) + 0.015, basin.z]}
          >
            <ringGeometry args={[basin.radiusX * 0.98, basin.radiusX * 1.08, 48]} />
            <meshStandardMaterial color="#8a8578" roughness={0.94} transparent opacity={0.55} />
          </mesh>
        ))}
    </group>
  );
}
