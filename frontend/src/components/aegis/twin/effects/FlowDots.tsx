import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { CatmullRomCurve3 } from "three";

export function FlowDots({ curve, dimmed }: { curve: CatmullRomCurve3; dimmed: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((child, i) => {
      child.position.copy(curve.getPoint((i / 12 + clock.elapsedTime * 0.06) % 1));
    });
  });
  return (
    <group ref={ref} visible={!dimmed}>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} scale={0.09}>
          <sphereGeometry args={[1, 7, 6]} />
          <meshBasicMaterial color="#5ce0ff" />
        </mesh>
      ))}
    </group>
  );
}
