import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { displayRelief, terrainOpacity, type ModelRepresentation } from "./inspectionPresentation";
import type { DisplayPosition } from "./spatialPresentation";

export function CatchmentSurface({ width, depth, points, palette, texture, representation }: {
  width: number; depth: number; points: DisplayPosition[]; palette: Record<string, string>;
  texture: THREE.Texture | null; representation: ModelRepresentation;
}) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width + 3, depth + 3, 80, 64);
    const positions = geo.getAttribute("position");
    for (let i = 0; i < positions.count; i++) positions.setZ(i, displayRelief(positions.getX(i), -positions.getY(i), points));
    geo.computeVertexNormals();
    return geo;
  }, [width, depth, points]);
  const contours = useMemo(() => {
    const positions: number[] = [];
    const w = width + 3, d = depth + 3;
    // Undimensioned surface traces communicate relief, not surveyed contour levels.
    for (let row = 0; row < 23; row++) {
      const z = -d / 2 + row * d / 22;
      for (let i = 0; i < 70; i++) {
        for (const x of [-w / 2 + i * w / 70, -w / 2 + (i + 1) * w / 70]) {
          const zz = z + .18 * Math.sin(x * .7 + row * .25);
          positions.push(x, displayRelief(x, zz, points) + .018, zz);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [width, depth, points]);
  useEffect(() => () => { geometry.dispose(); contours.dispose(); }, [geometry, contours]);
  useFrame(({ camera }, delta) => {
    if (!material.current) return;
    camera.getWorldDirection(direction);
    const polar = Math.acos(THREE.MathUtils.clamp(-direction.y, -1, 1));
    const target = terrainOpacity(polar);
    material.current.opacity += (target - material.current.opacity) * (1 - Math.exp(-5 * Math.min(delta, .05)));
  });
  if (representation === "blueprint") return <gridHelper args={[Math.max(width, depth) + 12, 40, palette["model-grid"], palette["model-grid"]]} position-y={-.1} material-transparent material-opacity={.22} />;
  return <>
    <mesh name="catchment-surface" geometry={geometry} rotation-x={-Math.PI / 2} receiveShadow>
      <meshStandardMaterial ref={material} color={palette["model-ground"] ?? ""} map={texture} roughness={1} transparent opacity={1} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    <lineSegments geometry={contours}><lineBasicMaterial color={palette["model-grid"] ?? ""} transparent opacity={.4} /></lineSegments>
    <gridHelper args={[Math.max(width, depth) + 16, 40, palette["model-grid"], palette["model-grid"]]} position-y={-1.65} material-transparent material-opacity={.16} />
  </>;
}