import type { NodeLayout } from "./types";
import { twinPalette } from "./materials";
import { surfaceY } from "./presentationLayout";
import { buildNeighbourhoodPlan } from "./neighbourhoodPlan";

type Props = {
  positions: NodeLayout;
  blueprint: boolean;
};

/**
 * Phase 1 placeholder urban layer — deterministic neighbourhood geometry lands here later.
 */
export function UrbanContext({ positions, blueprint }: Props) {
  const plan = buildNeighbourhoodPlan();
  if (!plan.ready) {
    const anchors = Object.values(positions).slice(0, 4);
    return (
      <group name="urban-context-placeholder">
        {anchors.map(([x, , z], i) => (
          <mesh
            key={i}
            position={[x + 6 * (i % 2 ? 1 : -1), surfaceY(x, z) + 0.4, z + 5 * (i < 2 ? 1 : -1)]}
          >
            <boxGeometry args={[2.4, 0.8 + (i % 3) * 0.4, 2.1]} />
            <meshStandardMaterial
              color={blueprint ? twinPalette.urban.blueprint : twinPalette.urban.fill}
              wireframe={blueprint}
              transparent
              opacity={0.35}
            />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}
