import type { CanonicalResponse } from "@/data/types";
import { surfaceY } from "../presentationLayout";
import type { NodeLayout } from "../types";

export function HealthRiskMarkers({ data, positions }: { data: CanonicalResponse; positions: NodeLayout }) {
  return (
    <>
      {data.risks.map((risk) => {
        const sensorNode = data.sensors.find((sensor) => sensor.id === risk.target_id)?.node_id;
        const target = positions[risk.target_id] ?? (sensorNode ? positions[sensorNode] : undefined);
        if (!target) return null;
        const color = risk.severity === "critical" || risk.severity === "high" ? "#c86254" : "#c7a55f";
        return (
          <mesh
            key={risk.id}
            position={[target[0], surfaceY(target[0], target[2]) + 0.18, target[2]]}
            rotation-x={-Math.PI / 2}
          >
            <ringGeometry args={[4, 4.14, 48]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </>
  );
}
