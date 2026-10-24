import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { CanonicalResponse } from "@/data/types";
import { samplePositions } from "./presentationLayout";
import type { ControlsRef, DepthRef } from "./sceneRefs";
import type { EngineeringView, NodeLayout } from "./types";
import { twinPalette } from "./materials";

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
  const undergroundBackground = useMemo(() => new THREE.Color("#343a36"), []);
  const blueprintBackground = useMemo(() => new THREE.Color(twinPalette.background.blueprint), []);
  useFrame(() => {
    const background = blueprint
      ? blueprintBackground
      : color.copy(terrainBackground).lerp(undergroundBackground, depthRef.current);
    const belowSurface = !blueprint && depthRef.current > 0.08;
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

function CameraHome({ controlsRef }: { controlsRef: ControlsRef }) {
  const { camera } = useThree();
  const positioned = useRef(false);
  useFrame(() => {
    if (positioned.current || !controlsRef.current) return;
    const target = new THREE.Vector3(-2.5, 0, 0);
    const offset = camera.position.clone().sub(controlsRef.current.target);
    controlsRef.current.target.copy(target);
    camera.position.copy(target.add(offset));
    controlsRef.current.update();
    positioned.current = true;
  });
  return null;
}

function CameraFocus({
  selected,
  data,
  positions,
  controlsRef,
}: {
  selected: string | null;
  data: CanonicalResponse;
  positions: NodeLayout;
  controlsRef: ControlsRef;
}) {
  const { camera } = useThree();
  const previous = useRef<string | null>(null);
  const goal = useRef<{ target: THREE.Vector3; camera: THREE.Vector3 } | null>(null);
  useFrame((_, delta) => {
    if (selected !== previous.current) {
      previous.current = selected;
      const sensor = selected ? data.sensors.find((item) => item.id === selected) : undefined;
      const nodeId = sensor?.node_id ?? selected;
      let point = nodeId && positions[nodeId] ? new THREE.Vector3(...positions[nodeId]!) : null;
      const edge = selected ? data.network.edges.find((item) => item.id === selected) : undefined;
      if (edge && positions[edge.from] && positions[edge.to]) {
        point = new THREE.Vector3(...positions[edge.from]!).lerp(new THREE.Vector3(...positions[edge.to]!), 0.5);
      }
      if (point && controlsRef.current) {
        const target = controlsRef.current.target.clone();
        const offset = camera.position.clone().sub(target);
        const node = data.network.nodes.find((item) => item.id === nodeId);
        const focusDistance = node?.type === "storage" ? 20 : node?.type === "recharge" ? 16 : 14;
        const distance = THREE.MathUtils.clamp(Math.min(offset.length() * 0.62, focusDistance), 11, 25);
        if (offset.lengthSq() < 0.01) offset.set(1, 0.8, 1);
        offset.setLength(distance);
        goal.current = { target: point, camera: point.clone().add(offset) };
      } else goal.current = null;
    }
    if (!goal.current || !controlsRef.current) return;
    const easing = 1 - Math.exp(-2.8 * Math.min(delta, 0.05));
    controlsRef.current.target.lerp(goal.current.target, easing);
    camera.position.lerp(goal.current.camera, easing);
    controlsRef.current.update();
    if (camera.position.distanceTo(goal.current.camera) < 0.06) goal.current = null;
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

  return (
    <>
      <CameraHome controlsRef={controlsRef} />
      <CameraDepth depthRef={depthRef} />
      <SceneAtmosphere blueprint={blueprint} depthRef={depthRef} />
      <CameraFocus selected={selected} data={data} positions={focusPositions} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.09}
        minDistance={4.5}
        maxDistance={96}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </>
  );
}
