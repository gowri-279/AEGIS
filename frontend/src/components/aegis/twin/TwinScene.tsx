import { useRef } from "react";
import { CatchmentTerrain } from "./CatchmentTerrain";
import { collectStorageBasins, NetworkLayer } from "./NetworkLayer";
import { SceneController } from "./SceneController";
import { SceneShell } from "./SceneShell";
import { UrbanContext } from "./UrbanContext";
import type { ControlsRef, DepthRef } from "./sceneRefs";
import type { TwinSceneProps } from "./types";
import { useSceneLayout } from "./useSceneLayout";
import { SAMPLE_NODE_IDS } from "./visualConfig";

export type { EngineeringView } from "./types";

export function TwinScene({
  data,
  view,
  selected,
  onSelect,
  healthMode,
  simulationActive,
  rainActive,
  floodActive,
  samplesVisible = false,
}: TwinSceneProps) {
  const controlsRef = useRef(null) as ControlsRef;
  const depthRef = useRef(0) as DepthRef;
  const showSamples =
    samplesVisible || Boolean(selected && (SAMPLE_NODE_IDS as readonly string[]).includes(selected));
  const { positions, allPositions, typeById, sampleIds } = useSceneLayout(data, showSamples);
  const blueprint = view === "blueprint";
  const storageBasins = collectStorageBasins(data, allPositions);

  return (
    <SceneShell view={view} onPointerMissed={() => onSelect(null)}>
      <SceneController
        view={view}
        data={data}
        selected={selected}
        canonicalPositions={positions}
        controlsRef={controlsRef}
        depthRef={depthRef}
      />
      <CatchmentTerrain blueprint={blueprint} storageBasins={storageBasins} />
      <UrbanContext positions={positions} blueprint={blueprint} />
      <NetworkLayer
        data={data}
        blueprint={blueprint}
        selected={selected}
        onSelect={(id) => onSelect(id)}
        healthMode={healthMode}
        simulationActive={simulationActive}
        rainActive={rainActive}
        floodActive={floodActive}
        positions={positions}
        allPositions={allPositions}
        typeById={typeById}
        sampleIds={sampleIds}
        samplesVisible={showSamples}
      />
    </SceneShell>
  );
}
