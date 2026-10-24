import type { BasinPort } from "./nodePorts";
import { twinPalette } from "../materials";
import { NETWORK } from "../visualConfig";
import { PipeTransitionCollar } from "./PipeTransitionCollar";

type Props = {
  blueprint: boolean;
  dimmed: boolean;
  ports: BasinPort[];
};

export function JunctionChamber({ blueprint, dimmed, ports }: Props) {
  const palette = blueprint ? twinPalette.network.junction.blueprint : twinPalette.network.junction;
  const opacity = dimmed ? 0.5 : 1;
  const cfg = NETWORK.junction;

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, cfg.transitionDepth * 0.04, 0]}>
        <circleGeometry args={[cfg.apronRadius, 40]} />
        <meshStandardMaterial color={palette.apron} roughness={0.94} transparent={dimmed} opacity={opacity} />
      </mesh>
      <mesh position={[0, -cfg.chamberDepth / 2 + 0.02, 0]}>
        <cylinderGeometry args={[cfg.chamberRadius, cfg.chamberRadius * 1.06, cfg.chamberDepth, 28]} />
        <meshStandardMaterial color={palette.chamber} metalness={0.16} roughness={0.82} transparent={dimmed} opacity={opacity} />
      </mesh>
      <mesh position={[0, cfg.collarHeight / 2, 0]}>
        <cylinderGeometry args={[cfg.collarRadius, cfg.collarRadius, cfg.collarHeight, 28]} />
        <meshStandardMaterial color={palette.collar} metalness={0.34} roughness={0.7} transparent={dimmed} opacity={opacity} />
      </mesh>
      <mesh position={[0, cfg.collarHeight + cfg.grateHeight / 2, 0]}>
        <cylinderGeometry args={[cfg.grateRadius, cfg.grateRadius, cfg.grateHeight, 28]} />
        <meshStandardMaterial color={palette.grate} metalness={0.22} roughness={0.78} />
      </mesh>
      {Array.from({ length: cfg.boltCount }, (_, i) => {
        const a = (i / cfg.boltCount) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * cfg.collarRadius * 0.86, cfg.collarHeight + 0.01, Math.sin(a) * cfg.collarRadius * 0.86]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color={palette.bolt} metalness={0.25} />
          </mesh>
        );
      })}
      {ports.map((port, i) => (
        <PipeTransitionCollar
          key={`${port.direction}-${i}`}
          blueprint={blueprint}
          dimmed={dimmed}
          x={port.x * cfg.apronRadius * 0.92}
          z={port.z * cfg.apronRadius * 0.92}
          rotationY={Math.atan2(port.x, port.z)}
        />
      ))}
    </group>
  );
}
