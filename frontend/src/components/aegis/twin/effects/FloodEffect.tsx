import { surfaceY } from "../presentationLayout";

export function FloodEffect() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[26, surfaceY(26, 20) + 0.08, 20]}>
      <circleGeometry args={[2.2, 28]} />
      <meshStandardMaterial color="#21bce1" transparent opacity={0.55} />
    </mesh>
  );
}
