import { Html } from "@react-three/drei";
import { useState } from "react";
import type { CanonicalResponse, NetworkNode } from "@/data/types";
import { twinPalette } from "../materials";
import { surfaceY } from "../presentationLayout";
import type { NodeLayout } from "../types";
import { SensorMarker } from "./SensorMarker";

type Props = {
  node: NetworkNode;
  position: [number, number, number];
  selected: boolean;
  dimmed: boolean;
  blueprint: boolean;
  onSelect: (id: string) => void;
  sensors: CanonicalResponse["sensors"];
  sample?: boolean;
};

function GreyboxBody({ kind, blueprint, dimmed }: { kind: string; blueprint: boolean; dimmed: boolean }) {
  const opacity = dimmed ? 0.55 : 1;
  if (kind === "storage") {
    return (
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]}>
        <circleGeometry args={[5.2, 32]} />
        <meshStandardMaterial
          color={blueprint ? twinPalette.network.storage : "#6a8a94"}
          wireframe={blueprint}
          transparent={dimmed}
          opacity={opacity}
        />
      </mesh>
    );
  }
  if (kind === "recharge") {
    return (
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <circleGeometry args={[2.8, 24]} />
        <meshStandardMaterial
          color={blueprint ? twinPalette.network.recharge : "#7a8578"}
          wireframe={blueprint}
          transparent={dimmed}
          opacity={opacity}
        />
      </mesh>
    );
  }
  if (kind === "junction") {
    return (
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.4, 24]} />
        <meshStandardMaterial
          color={blueprint ? twinPalette.network.junction : "#8a8d88"}
          wireframe={blueprint}
          transparent={dimmed}
          opacity={opacity}
        />
      </mesh>
    );
  }
  return (
    <group>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.72, 0.9, 1.1, 12]} />
        <meshStandardMaterial color={blueprint ? "#6bdff6" : "#a6ada3"} wireframe={blueprint} />
      </mesh>
    </group>
  );
}

export function NetworkNodeVisual({ node, position, selected, dimmed, blueprint, onSelect, sensors, sample = false }: Props) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;
  const kind = String(node.type);
  const sensor = sensors.find((item) => item.node_id === node.id);
  const selectionRadius = kind === "storage" ? 6.1 : kind === "recharge" ? 3.05 : kind === "junction" ? 1.45 : 2;
  const y = surfaceY(position[0], position[2]);

  return (
    <group
      position={[position[0], y, position[2]]}
      scale={dimmed ? 0.96 : 1}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <GreyboxBody kind={kind} blueprint={blueprint} dimmed={dimmed} />
      {sensor && <SensorMarker status={sensor.status} label={sensor.id} />}
      {active && (
        <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[selectionRadius, selectionRadius + 0.1, 48]} />
          <meshBasicMaterial color="#d3b477" toneMapped={false} />
        </mesh>
      )}
      <Html
        position={[0, kind === "storage" ? 0.6 : 2.05, 0]}
        center
        distanceFactor={34}
        style={{ pointerEvents: "none" }}
      >
        <div
          className={`scene-label ${active ? "active" : ""} ${blueprint ? "blueprint-label" : ""} ${sample ? "sample-label" : ""}`}
        >
          <strong>{sample ? `SAMPLE · ${node.id}` : node.id}</strong>
          <span>{sample ? "NON-CANONICAL" : kind}</span>
        </div>
      </Html>
    </group>
  );
}

export function sampleNodesFromIds(sampleIds: string[]): NetworkNode[] {
  return sampleIds.map((id, i) => ({
    id,
    type: i === 1 ? "recharge" : "storage",
    label: `${id} visualization sample`,
    sensor_ids: [],
    attributes: {},
  }));
}
