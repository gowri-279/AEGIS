import { VEGETATION } from "../visualConfig";
import type { TreePlacement } from "./urbanLayout";

const GREENS = ["#526b4d", "#647955", "#71815a", "#536f5b"];

export function TreeMass({ tree, blueprint, subdue = false }: { tree: TreePlacement; blueprint: boolean; subdue?: boolean }) {
  const fade = subdue ? 0.55 : 1;
  const [x, y, z] = tree.position;
  const scale = tree.scale;
  const variant = tree.variant;
  return (
    <group position={[x, y, z]} scale={scale}>
      <mesh position={[0, VEGETATION.trunkHeight * 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, VEGETATION.trunkHeight, 10]} />
        <meshStandardMaterial color={blueprint ? "#4a6468" : "#665943"} roughness={1} transparent={subdue} opacity={fade} />
      </mesh>
      <mesh position={[0.22, VEGETATION.trunkHeight * 0.92, -0.08]} scale={[0.9, 0.85, 0.88]} castShadow>
        <sphereGeometry args={[VEGETATION.canopySecondary, 14, 12]} />
        <meshStandardMaterial color={blueprint ? "#4a666a" : GREENS[(variant + 1) % GREENS.length]} roughness={0.98} transparent={subdue} opacity={fade} />
      </mesh>
      <mesh position={[-0.12, VEGETATION.trunkHeight * 1.02, 0.14]} scale={[1, 1.05, 0.95]} castShadow>
        <sphereGeometry args={[VEGETATION.canopyPrimary, 16, 14]} />
        <meshStandardMaterial color={blueprint ? "#456266" : GREENS[variant % GREENS.length]} roughness={0.98} transparent={subdue} opacity={fade} />
      </mesh>
    </group>
  );
}
