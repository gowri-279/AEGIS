import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CatchmentTerrain } from "./CatchmentTerrain";
import { collectStorageBasins, NetworkLayer } from "./NetworkLayer";
import { NetworkPresentationLighting } from "./NetworkPresentationLighting";
import { SceneController } from "./SceneController";
import { SceneShell } from "./SceneShell";
import { UrbanContext } from "./UrbanContext";
import { networkFrame } from "./presentationLayout";
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
  const frame = useMemo(() => networkFrame(positions), [positions]);
  const lightCenter = useMemo(() => new THREE.Vector3(...frame.bounds.center), [frame.bounds.center]);

  return (
    <SceneShell
      view={view}
      initialCamera={frame.camera}
      onPointerMissed={() => onSelect(null)}
    >
      <NetworkPresentationLighting center={lightCenter} span={frame.bounds.span} blueprint={blueprint} />
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
