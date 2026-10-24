import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";

export function RainEffect() {
  const drops = useMemo(
    () => Array.from({ length: 200 }, (_, i) => ({
      x: ((i * 17) % 820) / 10 - 41,
      z: ((i * 23) % 760) / 10 - 38,
      y: 5 + (i % 8),
    })),
    [],
  );
  useFrame(({ clock }) => {
    drops.forEach((drop) => {
      drop.y = 8 - ((clock.elapsedTime * 5 + drop.x + drop.z) % 8);
    });
  });
  return (
    <group>
      {drops.map((drop, i) => (
        <mesh key={i} position={[drop.x, drop.y, drop.z]}>
          <boxGeometry args={[0.018, 0.42, 0.018]} />
          <meshBasicMaterial color="#abd9ea" transparent opacity={0.38} />
        </mesh>
      ))}
    </group>
  );
}
