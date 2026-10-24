import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CanonicalResponse } from "@/data/types";
import { focusCameraOffset, focusDistanceForSelection, resolveFocusPoint } from "./camera/focusTarget";
import { twinPalette } from "./materials";
import { networkFrame, samplePositions } from "./presentationLayout";
import type { ControlsRef, DepthRef } from "./sceneRefs";
import type { EngineeringView, NodeLayout } from "./types";
import { NETWORK } from "./visualConfig";

function CameraDepth({ depthRef }: { depthRef: DepthRef }) {
  const { camera } = useThree();
  useFrame(() => {
    depthRef.current = THREE.MathUtils.smoothstep(-camera.position.y, 0.4, 5.5);
  });
  return null;
}

function SceneAtmosphere({ blueprint, depthRef }: { blueprint: boolean; depthRef: DepthRef }) {
  const { scene, gl } = useThree();
  const color = useMemo(() => new THREE.Color(), []);
  const underground = useRef(false);
  const terrainBackground = useMemo(() => new THREE.Color(twinPalette.background.terrain), []);
  const undergroundBackground = useMemo(() => new THREE.Color("#3a403c"), []);
  const blueprintBackground = useMemo(() => new THREE.Color(twinPalette.background.blueprint), []);
  useFrame(() => {
    const background = blueprint
      ? blueprintBackground
      : color.copy(terrainBackground).lerp(undergroundBackground, depthRef.current * 0.85);
    const belowSurface = !blueprint && depthRef.current > 0.12;
    if (belowSurface !== underground.current) {
      scene.background = belowSurface ? null : new THREE.Color();
      underground.current = belowSurface;
    }
    gl.setClearColor(background);
    if (scene.background instanceof THREE.Color) scene.background.copy(background);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(background);
  });
  return null;
}

function CameraHome({
  controlsRef,
  homeTarget,
  homeCamera,
  layoutKey,
}: {
  controlsRef: ControlsRef;
  homeTarget: THREE.Vector3;
  homeCamera: THREE.Vector3;
  layoutKey: string;
}) {
  const { camera } = useThree();
  const appliedKey = useRef<string | null>(null);
  useFrame(() => {
    if (appliedKey.current === layoutKey || !controlsRef.current) return;
    controlsRef.current.target.copy(homeTarget);
    camera.position.copy(homeCamera);
    controlsRef.current.update();
    appliedKey.current = layoutKey;
  });
  return null;
}

function CameraFocus({
  selected,
  data,
  positions,
  controlsRef,
  span,
  blueprint,
  homeTarget,
  homeCamera,
}: {
  selected: string | null;
  data: CanonicalResponse;
  positions: NodeLayout;
  controlsRef: ControlsRef;
  span: number;
  blueprint: boolean;
  homeTarget: THREE.Vector3;
  homeCamera: THREE.Vector3;
}) {
  const { camera } = useThree();
  const previous = useRef<string | null>(null);
  const goal = useRef<{ target: THREE.Vector3; camera: THREE.Vector3 } | null>(null);

  useFrame((_, delta) => {
    if (selected !== previous.current) {
      previous.current = selected;
      const point = resolveFocusPoint(selected, data, positions);
      if (point && controlsRef.current) {
        const target = controlsRef.current.target.clone();
        const offset = camera.position.clone().sub(target);
        const distance = focusDistanceForSelection(selected, data, span, offset);
        const viewOffset = focusCameraOffset(distance, blueprint);
        goal.current = { target: point, camera: point.clone().add(viewOffset) };
      } else if (!selected && NETWORK.camera.returnHomeOnClear && controlsRef.current) {
        goal.current = { target: homeTarget.clone(), camera: homeCamera.clone() };
      } else {
        goal.current = null;
      }
    }
    if (!goal.current || !controlsRef.current) return;
    const easing = 1 - Math.exp(-NETWORK.camera.focusEasing * Math.min(delta, 0.05));
    controlsRef.current.target.lerp(goal.current.target, easing);
    camera.position.lerp(goal.current.camera, easing);
    controlsRef.current.update();
    if (camera.position.distanceTo(goal.current.camera) < 0.05 && controlsRef.current.target.distanceTo(goal.current.target) < 0.05) {
      goal.current = null;
    }
  });
  return null;
}

type Props = {
  view: EngineeringView;
  data: CanonicalResponse;
  selected: string | null;
  canonicalPositions: NodeLayout;
  controlsRef: ControlsRef;
  depthRef: DepthRef;
};

export function SceneController({ view, data, selected, canonicalPositions, controlsRef, depthRef }: Props) {
  const blueprint = view === "blueprint";
  const focusPositions = useMemo(
    () => ({ ...canonicalPositions, ...samplePositions(canonicalPositions) }),
    [canonicalPositions],
  );
  const frame = useMemo(() => networkFrame(canonicalPositions), [canonicalPositions]);
  const homeTarget = useMemo(() => new THREE.Vector3(...frame.target), [frame.target]);
  const homeCamera = useMemo(() => new THREE.Vector3(...frame.camera), [frame.camera]);
  const layoutKey = useMemo(
    () => Object.entries(canonicalPositions).sort(([a], [b]) => a.localeCompare(b)).map(([id, p]) => `${id}:${p.join(",")}`).join("|"),
    [canonicalPositions],
  );

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.copy(homeTarget);
  }, [controlsRef, homeTarget, layoutKey]);

  return (
    <>
      <CameraHome controlsRef={controlsRef} homeTarget={homeTarget} homeCamera={homeCamera} layoutKey={layoutKey} />
      <CameraDepth depthRef={depthRef} />
      <SceneAtmosphere blueprint={blueprint} depthRef={depthRef} />
      <CameraFocus
        selected={selected}
        data={data}
        positions={focusPositions}
        controlsRef={controlsRef}
        span={frame.bounds.span}
        blueprint={blueprint}
        homeTarget={homeTarget}
        homeCamera={homeCamera}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.085}
        minDistance={frame.orbit.minDistance}
        maxDistance={frame.orbit.maxDistance}
        minPolarAngle={NETWORK.camera.polarMin}
        maxPolarAngle={NETWORK.camera.polarMax}
        target={homeTarget}
      />
    </>
  );
}
