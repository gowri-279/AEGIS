import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { getLandingDemoModel } from "@/services/api";
import {
  BlueprintStructure,
  FlowMarkers,
  displayConduitCurve,
  useModelPalette,
} from "../workspace/CatchmentScene";
import { FloatingBlueprintBase } from "./FloatingBlueprintBase";
import { CompartmentHighlight, JunctionSensor } from "./LandingIndicators";
import { ProjectedLabel } from "../workspace/ProjectedLabel";
import { spatialLayout, structureRole } from "../workspace/spatialPresentation";
import { DISPLAY_CONDUIT_Y } from "../workspace/inspectionPresentation";

const model = getLandingDemoModel();
const layout = spatialLayout(model.network);
const lastFlowStage = Math.max(0, ...Object.values(model.flowStages));

function PreviewCamera({ resetKey, reduced }: { resetKey: number; reduced: boolean }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const interacting = useRef(false);
  const resumeAt = useRef(0);
  const idleGain = useRef(0);
  const phase = useRef(0);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const spherical = useMemo(() => new THREE.Spherical(), []);
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan((Math.tan(vertical) * size.width) / size.height);
    const distance =
      Math.max(
        (layout.width + 2) / (2 * Math.tan(horizontal)),
        (layout.depth + 3) / (2 * Math.tan(vertical)),
      ) * 1.07;
    camera.position.setFromSphericalCoords(distance, 1.05, -0.28);
    camera.lookAt(0, -0.6, 0);
    controls.current?.target.set(0, -0.6, 0);
    controls.current?.update();
    phase.current = 0;
    idleGain.current = 0;
  }, [camera, size, resetKey]);
  useFrame((_, rawDelta) => {
    const orbit = controls.current;
    if (!orbit) return;
    const delta = Math.min(rawDelta, 0.05);
    const idle = !reduced && !interacting.current && performance.now() >= resumeAt.current;
    idleGain.current += ((idle ? 1 : 0) - idleGain.current) * (1 - Math.exp(-2 * delta));
    if (!idle) return;
    const step = delta * idleGain.current;
    phase.current += step * 0.045;
    offset.copy(camera.position).sub(orbit.target);
    spherical.setFromVector3(offset);
    spherical.theta += step * 0.045;
    // Slow elevation drift occasionally reveals the underside, without a tumble.
    spherical.phi += Math.cos(phase.current) * step * 0.025;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.35, 2.15);
    camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
    camera.lookAt(orbit.target);
    orbit.update();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      enableRotate
      enableZoom
      enableDamping={!reduced}
      dampingFactor={0.12}
      rotateSpeed={0.65}
      zoomSpeed={0.7}
      minPolarAngle={0.08}
      maxPolarAngle={2.6}
      minDistance={9}
      maxDistance={100}
      screenSpacePanning
      onStart={() => {
        interacting.current = true;
        idleGain.current = 0;
      }}
      onEnd={() => {
        interacting.current = false;
        resumeAt.current = performance.now() + 1800;
      }}
    />
  );
}

function PreviewContents({
  palette,
  resetKey,
  reduced,
  selected,
  onSelect,
}: {
  palette: Record<string, string>;
  resetKey: number;
  reduced: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);
  const connections = useMemo(
    () =>
      model.network.edges.flatMap((edge) => {
        const a = layout.nodes[edge.from],
          b = layout.nodes[edge.to];
        return a && b ? [{ ...edge, curve: displayConduitCurve(a, b) }] : [];
      }),
    [],
  );
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[-5, 12, 8]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <Environment resolution={64}>
        <Lightformer
          intensity={1.2}
          position={[0, 8, 0]}
          rotation-x={-Math.PI / 2}
          scale={[20, 12, 1]}
        />
        <Lightformer intensity={0.6} position={[0, -5, 8]} scale={[18, 5, 1]} />
      </Environment>
      <PreviewCamera resetKey={resetKey} reduced={reduced} />
      <FloatingBlueprintBase width={layout.width + 1} depth={layout.depth + 1} palette={palette} />
      {connections.map((edge) => (
        <group
          key={edge.id}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(edge.id);
          }}
        >
          <mesh name={`conduit-${edge.id}`}>
            <tubeGeometry args={[edge.curve, 40, 0.15, 12, false]} />
            <meshStandardMaterial
              color={palette[selected === edge.id ? "primary" : "model-metal"] ?? ""}
              roughness={0.55}
              emissive={palette["model-metal"] ?? ""}
              emissiveIntensity={0.18}
              wireframe
            />
          </mesh>
          <mesh>
            <tubeGeometry args={[edge.curve, 20, 0.32, 6, false]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {model.flowStages[edge.id] !== undefined && (
            <FlowMarkers
              id={edge.id}
              curve={edge.curve}
              color={palette["info"] ?? ""}
              reduced={reduced}
              stage={model.flowStages[edge.id] ?? 0}
              lastStage={lastFlowStage}
              startedAt={startedAt}
              network
            />
          )}
        </group>
      ))}
      {model.network.nodes.map((node) => {
        const point = layout.nodes[node.id];
        if (!point) return null;
        const role = structureRole(node, model.network);
        return (
          <group key={node.id}>
            <group
              position={[point.x, 0, point.z]}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(node.id);
              }}
            >
              <BlueprintStructure role={role} palette={palette} />
              {node.id === model.highlights.compartmentId && (
                <CompartmentHighlight palette={palette} />
              )}
              {node.id === model.highlights.sensorNodeId && (
                <JunctionSensor palette={palette} reduced={reduced} />
              )}
              <mesh position-y={DISPLAY_CONDUIT_Y / 2}>
                <cylinderGeometry args={[0.22, 0.22, -DISPLAY_CONDUIT_Y, 24]} />
                <meshStandardMaterial
                  color={palette["model-concrete"] ?? ""}
                  roughness={0.9}
                  wireframe
                />
              </mesh>
              {selected === node.id && (
                <mesh rotation-x={-Math.PI / 2} position-y={0.025}>
                  <ringGeometry args={[1.2, 1.25, 64]} />
                  <meshBasicMaterial color={palette["primary"] ?? ""} transparent opacity={0.8} />
                </mesh>
              )}
            </group>
            <ProjectedLabel position={[point.x, 0.65, point.z + 1]}>
              <Button
                variant="ghost"
                className={`landing-component-label${selected === node.id ? " is-selected" : ""}`}
                title={`${node.id} · ${node.label}`}
                aria-label={`Inspect ${node.id} ${node.label}`}
                aria-pressed={selected === node.id}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node.id);
                }}
              >
                {node.id}
              </Button>
            </ProjectedLabel>
          </group>
        );
      })}
    </>
  );
}

export function LandingNetworkScene({ resetKey }: { resetKey: number }) {
  const palette = useModelPalette();
  const [selected, setSelected] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => setSelected(null), [resetKey]);
  if (!palette) return null;
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [-8, 16, 28], fov: 35, near: 0.1, far: 150 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) =>
        gl.domElement.setAttribute("aria-label", "Interactive AEGIS demo network: 9 components")
      }
      onPointerMissed={() => setSelected(null)}
    >
      <PreviewContents
        palette={palette}
        resetKey={resetKey}
        reduced={reduced}
        selected={selected}
        onSelect={setSelected}
      />
    </Canvas>
  );
}
