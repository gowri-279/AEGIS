import type { CanonicalResponse } from "@/data/types";
import { ConduitVisual } from "./edges/ConduitVisual";
import { FloodEffect } from "./effects/FloodEffect";
import { HealthRiskMarkers } from "./effects/HealthRiskMarkers";
import { RainEffect } from "./effects/RainEffect";
import { NetworkNodeVisual, sampleNodesFromIds, storageVariantByNodeId } from "./nodes/NetworkNodeVisual";
import { useMemo } from "react";
import type { NodeLayout } from "./types";

type Props = {
  data: CanonicalResponse;
  blueprint: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  healthMode: boolean;
  simulationActive: boolean;
  rainActive: boolean;
  floodActive: boolean;
  positions: NodeLayout;
  allPositions: NodeLayout;
  typeById: Map<string, string>;
  sampleIds: string[];
  samplesVisible: boolean;
};

export function NetworkLayer({
  data,
  blueprint,
  selected,
  onSelect,
  healthMode,
  simulationActive,
  rainActive,
  floodActive,
  positions,
  allPositions,
  typeById,
  sampleIds,
  samplesVisible,
}: Props) {
  const selectedSensor = data.sensors.find((sensor) => sensor.id === selected);
  const selectedNodeId =
    selectedSensor?.node_id ?? (data.network.nodes.some((node) => node.id === selected) ? selected : null);
  const connectedIds = new Set(
    selectedNodeId
      ? data.network.edges
          .filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId)
          .map((edge) => edge.id)
      : [],
  );
  const selectedCandidate = data.candidates.find((candidate) => candidate.node_id === selectedNodeId);
  const activeRoute = new Set(simulationActive && selectedCandidate ? selectedCandidate.route_edge_ids : []);
  const emphasis = Boolean(selected || activeRoute.size);
  const sampleNodes = sampleNodesFromIds(sampleIds);
  const storageVariants = useMemo(() => storageVariantByNodeId(data.network.nodes), [data.network.nodes]);

  return (
    <group name="network-layer">
      {data.network.edges.map((edge) => {
        if (!allPositions[edge.from] || !allPositions[edge.to]) return null;
        const isConnected = connectedIds.has(edge.id);
        const dimmed = emphasis && !isConnected && selected !== edge.id && !activeRoute.has(edge.id);
        return (
          <ConduitVisual
            key={edge.id}
            edge={edge}
            positions={allPositions}
            typeById={typeById}
            selected={selected === edge.id}
            connected={isConnected || activeRoute.has(edge.id)}
            dimmed={dimmed}
            blueprint={blueprint}
            onSelect={onSelect}
            simulationActive={simulationActive}
          />
        );
      })}
      {data.network.nodes.map((node) => {
        const pos = allPositions[node.id];
        if (!pos) return null;
        const nodeSensors = data.sensors.filter((sensor) => sensor.node_id === node.id);
        const dimmed =
          emphasis &&
          selectedNodeId !== node.id &&
          !data.network.edges.some(
            (edge) => connectedIds.has(edge.id) && (edge.from === node.id || edge.to === node.id),
          );
        return (
          <NetworkNodeVisual
            key={node.id}
            node={node}
            position={pos}
            selected={selected === node.id || nodeSensors.some((sensor) => sensor.id === selected)}
            dimmed={dimmed}
            blueprint={blueprint}
            onSelect={onSelect}
            sensors={data.sensors}
            edges={data.network.edges}
            allPositions={allPositions}
            storageVariantIndex={storageVariants.get(node.id) ?? 0}
          />
        );
      })}
      {samplesVisible &&
        sampleNodes.map((node) => {
          const pos = allPositions[node.id];
          if (!pos) return null;
          return (
            <NetworkNodeVisual
              key={node.id}
              node={node}
              position={pos}
              selected={selected === node.id}
              dimmed={false}
              blueprint={blueprint}
              onSelect={onSelect}
              sensors={[]}
              edges={[]}
              allPositions={allPositions}
              storageVariantIndex={0}
              sample
            />
          );
        })}
      {healthMode && <HealthRiskMarkers data={data} positions={allPositions} />}
      {rainActive && <RainEffect />}
      {floodActive && !blueprint && <FloodEffect />}
    </group>
  );
}

export function collectStorageBasins(data: CanonicalResponse, allPositions: NodeLayout) {
  return data.network.nodes
    .filter((node) => node.type === "storage")
    .map((node) => allPositions[node.id])
    .filter((p): p is [number, number, number] => Boolean(p));
}
