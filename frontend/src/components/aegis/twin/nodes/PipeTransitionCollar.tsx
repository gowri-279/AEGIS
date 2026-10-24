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
        <cylinderGeometry args={[cfg.collarRadius, cfg.collarRadius * 1.12, cfg.collarDepth, 16]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} transparent={dimmed} opacity={dimmed ? 0.55 : 1} />
      </mesh>
      <mesh position={[0, -cfg.collarDepth * 0.15, 0]}>
        <cylinderGeometry args={[cfg.collarRadius * 0.72, cfg.collarRadius * 0.72, cfg.collarDepth * 0.55, 12]} />
        <meshStandardMaterial color={color} roughness={0.94} metalness={0.04} transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[cfg.collarRadius * 0.55, cfg.collarRadius * 0.95, 20]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
    </group>
  );
}
