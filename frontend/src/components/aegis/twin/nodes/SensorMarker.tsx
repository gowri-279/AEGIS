import { Html } from "@react-three/drei";
import type { SensorStatus } from "@/data/types";

const SENSOR_COLORS: Record<SensorStatus, string> = {
  fresh: "#75a879",
  degraded: "#c9a25c",
  stale: "#849090",
  missing: "#849090",
  invalid: "#bd5f51",
  conflicting: "#c9a25c",
};

export function SensorMarker({ status, label }: { status: SensorStatus; label: string }) {
  const tone = SENSOR_COLORS[status];
  return (
    <group position={[0.9, 1.48, 0.45]}>
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 0.7, 8]} />
        <meshStandardMaterial color="#64706e" metalness={0.7} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.17, 12, 10]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.22} />
      </mesh>
      <Html position={[0, 0.52, 0]} center distanceFactor={24} style={{ pointerEvents: "none" }}>
        <div className="scene-sensor-label" style={{ color: tone }}>
          {label} · {status.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}
