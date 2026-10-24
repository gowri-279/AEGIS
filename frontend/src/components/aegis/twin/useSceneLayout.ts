import { useMemo } from "react";
import { layoutCanonicalNetwork } from "@/data/networkLayout";
import type { CanonicalResponse } from "@/data/types";
import { samplePositions } from "./presentationLayout";
import { SAMPLE_NODE_IDS } from "./visualConfig";
import type { NodeLayout } from "./types";

export function useSceneLayout(data: CanonicalResponse, samplesVisible: boolean) {
  const positions = useMemo(
    () => layoutCanonicalNetwork(data.network.nodes, data.network.edges) as NodeLayout,
    [data.network.edges, data.network.nodes],
  );
  const sampleIds = useMemo(() => SAMPLE_NODE_IDS.filter((id) => !(id in positions)), [positions]);
  const sampleLayout = useMemo(() => samplePositions(positions, sampleIds), [positions, sampleIds]);
  const allPositions = useMemo(
    () => ({ ...positions, ...(samplesVisible ? sampleLayout : {}) }),
    [positions, sampleLayout, samplesVisible],
  );
  const typeById = useMemo(
    () => new Map(data.network.nodes.map((node) => [node.id, node.type])),
    [data.network.nodes],
  );
  return { positions, allPositions, typeById, sampleIds };
}
