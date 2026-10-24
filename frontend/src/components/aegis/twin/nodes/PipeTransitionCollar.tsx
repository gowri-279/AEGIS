import { twinPalette } from "../materials";
import { NETWORK } from "../visualConfig";

type Props = {
  blueprint: boolean;
  dimmed: boolean;
  x: number;
  z: number;
  rotationY: number;
};

/** Surface-to-subsurface pipe entry (presentation only). */
export function PipeTransitionCollar({ blueprint, dimmed, x, z, rotationY }: Props) {
  const cfg = NETWORK.transition;
  const color = blueprint ? twinPalette.network.transitionBlueprint : twinPalette.network.transition;
  return (
    <group position={[x, cfg.surfaceLift, z]} rotation-y={rotationY}>
      <mesh position={[0, -cfg.collarDepth / 2, 0]}>
        <cylinderGeometry args={[cfg.collarRadius, cfg.collarRadius * 1.08, cfg.collarDepth, 16]} />
        <meshStandardMaterial color={color} roughness={0.86} metalness={0.12} transparent={dimmed} opacity={dimmed ? 0.55 : 1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[cfg.collarRadius * 0.55, cfg.collarRadius * 0.95, 20]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
    </group>
  );
}
