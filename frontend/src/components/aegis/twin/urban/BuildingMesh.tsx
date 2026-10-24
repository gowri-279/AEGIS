import { useMemo } from "react";
import * as THREE from "three";
import { catchmentHeight, type CatchmentModel } from "../catchment/catchmentModel";
import type { BuildingLot } from "./urbanLayout";

export function BuildingMesh({
  building,
  model,
  blueprint,
  facadeTexture,
  subdue = false,
}: {
  building: BuildingLot;
  model: CatchmentModel;
  blueprint: boolean;
  facadeTexture: THREE.CanvasTexture;
  subdue?: boolean;
}) {
  const fade = subdue ? 0.58 : 1;
  const { x, z, w, d, h, variant } = building;
  const colors = ["#a7a397", "#aaa99e", "#b2a99c", "#969e99", "#a39d91"];
  const color = colors[variant % colors.length]!;
  const footprint = useMemo(() => {
    const shape = new THREE.Shape();
    const inset = variant % 3 === 0 ? 0.34 : variant % 3 === 1 ? 0.14 : 0;
    shape.moveTo(-w / 2, -d / 2);
    shape.lineTo(w / 2 - inset, -d / 2);
    shape.lineTo(w / 2, -d / 2 + inset);
    shape.lineTo(w / 2, d / 2);
    shape.lineTo(-w / 2 + inset, d / 2);
    shape.lineTo(-w / 2, d / 2 - inset);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.05,
      bevelThickness: 0.04,
      steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [d, h, variant, w]);
  const outline = useMemo(() => new THREE.EdgesGeometry(footprint, 24), [footprint]);
  const groundY = catchmentHeight(model, x, z);

  return (
    <group position={[x, groundY, z]} rotation-y={variant * 0.27}>
      <mesh geometry={footprint} castShadow receiveShadow>
        <meshStandardMaterial color={blueprint ? "#2a4046" : color} roughness={0.92} metalness={blueprint ? 0.06 : 0.02} transparent={subdue} opacity={fade} />
      </mesh>
      {blueprint && (
        <lineSegments geometry={outline}>
          <lineBasicMaterial color="#7a949c" transparent opacity={0.55} />
        </lineSegments>
      )}
      <mesh position={[0, h + 0.03, 0]} castShadow>
        <boxGeometry args={[w * 1.01, 0.06, d * 1.01]} />
        <meshStandardMaterial color={blueprint ? "#344a50" : "#8e8b80"} roughness={0.92} />
      </mesh>
      {!blueprint && (
        <>
          <mesh position={[0, h * 0.52, d / 2 + 0.01]}>
            <planeGeometry args={[w * 0.86, h * 0.8]} />
            <meshStandardMaterial map={facadeTexture} color={color} roughness={0.76} />
          </mesh>
          <mesh position={[w / 2 + 0.01, h * 0.52, 0]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[d * 0.86, h * 0.8]} />
            <meshStandardMaterial map={facadeTexture} color={color} roughness={0.76} />
          </mesh>
        </>
      )}
    </group>
  );
}
