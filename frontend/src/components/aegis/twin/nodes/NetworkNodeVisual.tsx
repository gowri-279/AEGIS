import { Html } from "@react-three/drei";
import { useMemo, useState } from "react";
import type { CanonicalResponse, NetworkEdge, NetworkNode } from "@/data/types";
import { surfaceY } from "../presentationLayout";
import { twinPalette } from "../materials";
import { NETWORK } from "../visualConfig";
import { JunctionChamber } from "./JunctionChamber";
import { RechargeStructureVisual } from "./RechargeStructureVisual";
import { StorageBasinVisual } from "./StorageBasinVisual";
import { nodePresentationSeed } from "./nodeSeed";
import { portsForNode } from "./nodePorts";
import { SensorMarker } from "./SensorMarker";

type Props = {
  node: NetworkNode;
  position: [number, number, number];
  selected: boolean;
  dimmed: boolean;
  blueprint: boolean;
  onSelect: (id: string) => void;
  sensors: CanonicalResponse["sensors"];
  edges: NetworkEdge[];
  allPositions: Record<string, [number, number, number]>;
  storageVariantIndex: number;
  sample?: boolean;
};

function selectionRadiusForType(kind: string) {
  const rings = NETWORK.selectionRing;
  if (kind === "storage") return rings.storage;
  if (kind === "recharge") return rings.recharge;
  if (kind === "junction") return rings.junction;
  return rings.default;
}

export function NetworkNodeVisual({
  node,
  position,
  selected,
  dimmed,
  blueprint,
  onSelect,
  sensors,
  edges,
  allPositions,
  storageVariantIndex,
  sample = false,
}: Props) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;
  const kind = String(node.type);
  const sensor = sensors.find((item) => item.node_id === node.id);
  const seed = nodePresentationSeed(node.id);
  const ports = useMemo(() => portsForNode(node.id, edges, allPositions), [allPositions, edges, node.id]);
  const selectionRadius = selectionRadiusForType(kind);
  const y = surfaceY(position[0], position[2]);
  const labelY = kind === "storage" ? NETWORK.labelHeight.storage : NETWORK.labelHeight.default;

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
      {kind === "junction" && <JunctionChamber blueprint={blueprint} dimmed={dimmed} ports={ports} />}
      {kind === "storage" && (
        <StorageBasinVisual
          blueprint={blueprint}
          selected={selected}
          dimmed={dimmed}
          seed={seed}
          variantIndex={storageVariantIndex}
          ports={ports}
        />
      )}
      {kind === "recharge" && (
        <RechargeStructureVisual blueprint={blueprint} dimmed={dimmed} seed={seed} ports={ports} />
      )}
      {kind !== "junction" && kind !== "storage" && kind !== "recharge" && (
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.72, 0.9, 1.1, 12]} />
          <meshStandardMaterial color={blueprint ? "#6bdff6" : "#a6ada3"} wireframe={blueprint} />
        </mesh>
      )}
      {sensor && <SensorMarker status={sensor.status} label={sensor.id} />}
      {active && (
        <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[selectionRadius, selectionRadius + NETWORK.selectionRing.width, 48]} />
          <meshBasicMaterial color={twinPalette.attention.amberSoft} toneMapped={false} transparent opacity={0.92} />
        </mesh>
      )}
      <Html position={[0, labelY, 0]} center distanceFactor={NETWORK.presentation.labelDistanceFactor} style={{ pointerEvents: "none" }}>
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

export function storageVariantByNodeId(nodes: NetworkNode[]) {
  const storageIds = nodes.filter((node) => node.type === "storage").map((node) => node.id).sort();
  return new Map(storageIds.map((id, index) => [id, index]));
}
