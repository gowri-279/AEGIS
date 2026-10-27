import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CanonicalResponse, NetworkNode } from "@/data/types";
import { Button } from "@/components/ui/button";
import { edgeCandidates, feasibilityLabel, nodeCandidate, nodeRisks, nodeSensors, sensorTone, severityTone, strongestTone } from "@/lib/aegis";
import { cn } from "@/lib/utils";
import { routeMembership, spatialEdgeTone, spatialLayout, spatialNodeTone, structureRole, type DisplayPosition } from "./spatialPresentation";
import { ProjectedLabel } from "./ProjectedLabel";
import type { WorkspaceMode } from "./types";
import { DISPLAY_CONDUIT_Y, DISPLAY_CONDUIT_RADIUS, inspectionFraming, type ModelRepresentation } from "./inspectionPresentation";
import { CatchmentSurface } from "./CatchmentSurface";
import { DiagnosticSweep } from "./DiagnosticSweep";
import { HealthProblemMarkers } from "./HealthProblemMarkers";
import { flowPulseProgress, simulationFlowPlan } from "./simulationFlowPresentation";
import { BobSignal } from "../bob/BobSignal";
import type { BobVisualScenario, HydraulicVisualState } from "@/data/bobInterventions";
import type { Severity } from "@/data/types";
import type { Tone } from "@/lib/aegis";
import { NETWORK_FLOW_HOP_SECONDS, networkFlowPlan } from "./networkFlowPresentation";

function hydraulicTone(state?: HydraulicVisualState): Tone | null {
  if (!state) return null;
  if (state === "green") return "ok";
  if (state === "amber") return "warn";
  if (state === "red" || state === "blinking_red") return "crit";
  if (state === "grey") return "unknown";
  return null;
}

export interface SceneProps {
  bobVisual?: BobVisualScenario | null;
  bobSignal?: { title: string; severity: Severity; onOpen: () => void } | null;
  data: CanonicalResponse;
  mode: WorkspaceMode;
  selectedId: string | null;
  selectionRevision: number;
  onSelect: (id: string | null) => void;
  healthPhase: "idle" | "scanning" | "done";
  scanStartedAt: number | null;
  simPhase: "idle" | "running" | "done";
  resetKey: number;
  representation: ModelRepresentation;
  selectedFindingId?: string | null;
  onSelectHealthFinding?: (findingId: string) => void;
}

type Palette = Record<string, string>;

export function useModelPalette() {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const colors: Palette = {};
    for (const key of ["canvas", "model-ground", "model-grain", "model-concrete", "model-side", "model-metal", "model-inset", "model-water", "model-gravel", "model-grid", "primary", "ok", "info", "warn", "crit", "unknown", "foreground"]) {
      context.fillStyle = styles.getPropertyValue(`--${key}`).trim();
      context.fillRect(0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      colors[key] = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    }
    setPalette(colors);
  }, []);
  return palette;
}

export function useSurfaceTexture(palette: Palette, gravel = false) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = palette[gravel ? "model-gravel" : "model-ground"] ?? "";
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = palette["model-grain"] ?? "";
    // Deterministic visual grain, unrelated to geographic/engineering data.
    for (let i = 0; i < 2400; i++) {
      context.globalAlpha = .12 + (i % 5) * .035;
      context.fillRect((i * 47) % 256, (i * 83 + Math.floor(i / 256) * 17) % 256, gravel ? 2 : 1, gravel ? 2 : 1);
    }
    context.globalAlpha = .4;
    context.strokeStyle = palette["model-grid"] ?? "";
    context.lineWidth = .5;
    for (let p = 0; p <= 256; p += gravel ? 32 : 64) {
      context.beginPath(); context.moveTo(p, 0); context.lineTo(p, 256); context.stroke();
      context.beginPath(); context.moveTo(0, p); context.lineTo(256, p); context.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(gravel ? 1 : 5, gravel ? 1 : 4);
    setTexture(map);
    return () => map.dispose();
  }, [palette, gravel]);
  return texture;
}

function ModelCamera({ width, depth, props, reduced }: { width: number; depth: number; props: SceneProps; reduced: boolean }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const destination = useRef(new THREE.Vector3());
  const shift = useMemo(() => new THREE.Vector3(), []);
  const focus = useRef(false);
  const focusedAt = useRef(0);
  const baseZoom = useRef(40);
  const targetZoom = useRef(40);
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.position.set(-3, 16, 19);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    destination.current.set(0, 0, 0);
    focus.current = false;
    camera.far = Math.max(100, width + depth + 50);
    camera.updateProjectionMatrix();
  }, [camera, width, depth, props.resetKey, props.mode]);
  useEffect(() => {
    baseZoom.current = Math.min(size.width / (width + depth * .25 + 5), size.height / (depth * .76 + 5)) * .78;
    const framing = inspectionFraming(props.data.network, props.selectedId);
    destination.current.set(framing.target.x, 0, framing.target.z);
    if (props.mode === "simulate" && !props.selectedId) {
      const points = Object.values(spatialLayout(props.data.network).nodes);
      if (points.length) destination.current.set(
        (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2,
        0,
        (Math.min(...points.map((point) => point.z)) + Math.max(...points.map((point) => point.z))) / 2,
      );
    }
    targetZoom.current = baseZoom.current * framing.zoomMultiplier * (props.mode === "simulate" && !props.selectedId ? 1.12 : 1);
    if (props.mode === "simulate" && !props.selectedId && camera instanceof THREE.OrthographicCamera) {
      // Fit actual display bounds in camera space; retain margin for symbols/IDs.
      const points = Object.values(spatialLayout(props.data.network).nodes);
      camera.updateMatrixWorld();
      const projected = points.map((point) => new THREE.Vector3(point.x, 0, point.z).applyMatrix4(camera.matrixWorldInverse));
      if (projected.length) {
        const spanX = Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x)) + 4;
        const spanY = Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y)) + 4;
        targetZoom.current = Math.min(targetZoom.current, size.width / spanX * .9, size.height / spanY * .9);
      }
    }
    focus.current = true;
    focusedAt.current = performance.now();
  }, [props.selectedId, props.selectionRevision, props.data.network, props.mode, size, props.resetKey]);
  useFrame((_, rawDelta) => {
    const orbit = controls.current;
    if (!orbit || !focus.current || !(camera instanceof THREE.OrthographicCamera)) return;
    const blend = reduced ? 1 : 1 - Math.exp(-4 * Math.min(rawDelta, .05));
    shift.copy(destination.current).sub(orbit.target).multiplyScalar(blend);
    orbit.target.add(shift);
    camera.position.add(shift);
    camera.zoom += (targetZoom.current - camera.zoom) * blend;
    camera.updateProjectionMatrix();
    orbit.update();
    if (orbit.target.distanceTo(destination.current) < .01 && Math.abs(camera.zoom - targetZoom.current) < .05) focus.current = false;
  });
  return <OrbitControls ref={controls} makeDefault enablePan enableZoom enableRotate enableDamping={!reduced} dampingFactor={.12} minPolarAngle={.08} maxPolarAngle={2.05} minZoom={8} maxZoom={220} screenSpacePanning onStart={() => { if (performance.now() - focusedAt.current > 250) focus.current = false; }} />;
}

function Block({ position, size, color, metal = false }: { position: [number, number, number]; size: [number, number, number]; color: string; metal?: boolean }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={metal ? .48 : .92} metalness={metal ? .5 : 0} /></mesh>;
}

export function Structure({ role, palette }: { role: ReturnType<typeof structureRole>; palette: Palette }) {
  const gravel = useSurfaceTexture(palette, true);
  if (role === "storage") return <>
    <mesh rotation-x={-Math.PI / 2} position-y={.07} scale={[1.45, 1, 1]} receiveShadow><ringGeometry args={[.83, 1.08, 64]} /><meshStandardMaterial color={palette["model-concrete"] ?? ""} roughness={.94} /></mesh>
    <mesh position-y={-.12} scale={[1.45, 1, 1]}><cylinderGeometry args={[.89, .68, .38, 64, 1, true]} /><meshStandardMaterial color={palette["model-side"] ?? ""} side={THREE.DoubleSide} roughness={.9} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={.025} scale={[1.45, 1, 1]}><circleGeometry args={[.84, 64]} /><meshPhysicalMaterial color={palette["model-water"] ?? ""} roughness={.26} metalness={.18} clearcoat={.65} /></mesh>
    <Block position={[-1.37, .13, 0]} size={[.35, .16, .3]} color={palette["model-concrete"] ?? ""} />
  </>;
  if (role === "recharge") return <>
    <Block position={[0, .08, 0]} size={[2.15, .16, 1.6]} color={(palette["model-side"] ?? "")} />
    <mesh rotation-x={-Math.PI / 2} position-y={.17} receiveShadow><planeGeometry args={[1.95, 1.4]} /><meshStandardMaterial color={(palette["model-gravel"] ?? "")} map={gravel} roughness={1} /></mesh>
    {[-.45, 0, .45].map((z) => <Block key={z} position={[0, .2, z]} size={[1.7, .07, .07]} color={(palette["model-concrete"] ?? "")} />)}
  </>;
  if (role === "inlet") return <>
    <Block position={[0, .17, 0]} size={[1.15, .34, .95]} color={(palette["model-concrete"] ?? "")} />
    <Block position={[0, .36, 0]} size={[.95, .04, .75]} color={(palette["model-inset"] ?? "")} />
    {[-.32, -.16, 0, .16, .32].map((x) => <Block key={x} position={[x, .4, 0]} size={[.065, .05, .72]} color={(palette["model-metal"] ?? "")} metal />)}
  </>;
  if (role === "outlet") return <>
    <Block position={[0, .12, 0]} size={[1.6, .24, 1.35]} color={(palette["model-concrete"] ?? "")} />
    <mesh position={[.12, .58, 0]} rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[.43, .43, .95, 40, 1, true]} /><meshStandardMaterial color={(palette["model-concrete"] ?? "")} side={THREE.DoubleSide} roughness={.9} /></mesh>
    <mesh position={[.61, .58, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[.42, .09, 12, 40]} /><meshStandardMaterial color={(palette["model-metal"] ?? "")} roughness={.55} /></mesh>
    <Block position={[.62, .14, 0]} size={[1.3, .08, .95]} color={(palette["model-inset"] ?? "")} />
  </>;
  if (role === "other") return <Block position={[0, .3, 0]} size={[1, .6, 1]} color={(palette["model-concrete"] ?? "")} />;
  const r = role === "downstream" ? .8 : .65;
  return <>
    <mesh position-y={.3} castShadow receiveShadow><cylinderGeometry args={[r, r, .6, 48]} /><meshStandardMaterial color={(palette["model-side"] ?? "")} roughness={.95} /></mesh>
    <mesh position-y={.61} rotation-x={-Math.PI / 2}><ringGeometry args={[r * .69, r, 48]} /><meshStandardMaterial color={(palette["model-concrete"] ?? "")} roughness={.85} /></mesh>
    <mesh position-y={.615} rotation-x={-Math.PI / 2}><circleGeometry args={[r * .69, 48]} /><meshStandardMaterial color={(palette["model-inset"] ?? "")} /></mesh>
    {[-.3, -.15, 0, .15, .3].map((z) => <Block key={z} position={[0, .65, z]} size={[r * 1.3, .035, .04]} color={(palette["model-metal"] ?? "")} metal />)}
  </>;
}

/** Wireframe drawing shapes: each structural role reads as its own symbol. */
export function BlueprintStructure({ role, palette }: { role: ReturnType<typeof structureRole>; palette: Palette }) {
  const metal = palette["model-metal"] ?? "";
  if (role === "storage") return <group>
    {/* Rectangular reservoir symbol: tall wireframe basin, clearly not the circular junction. */}
    <mesh position-y={.3}><boxGeometry args={[1.7, .6, 1.7]} /><meshStandardMaterial color={metal} wireframe /></mesh>
    <mesh position-y={.62} rotation-x={-Math.PI / 2}><planeGeometry args={[1.7, 1.7]} /><meshBasicMaterial color={metal} wireframe /></mesh>
    <mesh position-y={.34} rotation-x={-Math.PI / 2}><planeGeometry args={[1.4, 1.4]} /><meshBasicMaterial color={metal} wireframe /></mesh>
  </group>;
  if (role === "recharge") return <group>
    <mesh position-y={.12}><boxGeometry args={[1.7, .24, 1.25]} /><meshStandardMaterial color={metal} wireframe /></mesh>
    <mesh position-y={.25} rotation-x={-Math.PI / 2}><planeGeometry args={[1.7, 1.25]} /><meshBasicMaterial color={metal} wireframe /></mesh>
  </group>;
  if (role === "inlet") return <group>
    <mesh position-y={.14}><boxGeometry args={[1, .28, .8]} /><meshStandardMaterial color={metal} wireframe /></mesh>
    {[-.28, 0, .28].map((x) => <Block key={x} position={[x, .3, 0]} size={[.05, .03, .7]} color={metal} />)}
  </group>;
  if (role === "outlet") return <group>
    <mesh position={[.1, .3, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[.34, .34, .8, 20, 1, true]} /><meshStandardMaterial color={metal} wireframe side={THREE.DoubleSide} /></mesh>
    <mesh position={[.52, .3, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[.34, .05, 8, 24]} /><meshBasicMaterial color={metal} wireframe /></mesh>
    <mesh position-y={.02} rotation-x={-Math.PI / 2}><ringGeometry args={[.5, .58, 32]} /><meshBasicMaterial color={metal} /></mesh>
  </group>;
  if (role === "other") return <mesh position-y={.2}><boxGeometry args={[.8, .4, .8]} /><meshStandardMaterial color={metal} wireframe /></mesh>;
  const r = role === "downstream" ? .8 : .6;
  return <group>
    <mesh position-y={.2} rotation-x={-Math.PI / 2}><ringGeometry args={[r - .1, r + .04, 48]} /><meshBasicMaterial color={metal} /></mesh>
    <mesh position-y={.03}><cylinderGeometry args={[r, r, .35, 32]} /><meshStandardMaterial color={metal} wireframe /></mesh>
    <Block position={[0, .2, 0]} size={[r * 1.4, .025, .03]} color={metal} />
  </group>;
}

function NodeStructure({ node, point, props, palette }: { node: NetworkNode; point: DisplayPosition; props: SceneProps; palette: Palette }) {
  const { data, mode, selectedId, onSelect, healthPhase } = props;
  const selected = selectedId === node.id;
  const tone = spatialNodeTone(data, node, mode, healthPhase === "done");
  const color = selected ? (palette["primary"] ?? "") : (palette[tone === "neutral" ? "model-metal" : tone] ?? "");
  const candidate = nodeCandidate(data, node);
  const sensors = nodeSensors(data, node);
  const risks = nodeRisks(data, node);
  const role = structureRole(node, data.network);
  // In Health after a scan, the ring belongs to the supplied problem severity and
  // must win over selection/default colours in every representation.
  const demoState = mode === "health" || mode === "simulate" ? props.bobVisual?.nodeStates?.[node.id] : undefined;
  const hydraulic = hydraulicTone(demoState?.hydraulicState);
  const demoSeverity = demoState?.severity && demoState.severity in severityTone ? severityTone[demoState.severity] : null;
  const problemTone = hydraulic ?? (demoSeverity ?? (mode === "health" && healthPhase === "done" && risks.length ? strongestTone(risks.map((risk) => severityTone[risk.severity] ?? "neutral")) : null));
  const ringColor = problemTone ? (palette[problemTone] ?? "") : color;
  const blinking = demoState?.hydraulicState === "blinking_red";
  return <group position={[point.x, 0, point.z]} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }}>
    {props.representation === "terrain" ? <Structure role={role} palette={palette} /> : <BlueprintStructure role={role} palette={palette} />}
    {role === "storage" && demoState?.storageLevel && <mesh name={`bob-level-${node.id}`} rotation-x={-Math.PI / 2} position-y={demoState.storageLevel === "raised" ? .22 : .04} scale={[1.45, 1, 1]}><circleGeometry args={[.84, 48]} /><meshBasicMaterial color={palette[demoSeverity ?? "warn"] ?? ""} transparent opacity={.6} /></mesh>}
    <ProjectedLabel position={[point.x, .8, point.z]} above>{selected && mode === "health" && props.bobSignal ? <BobSignal {...props.bobSignal} /> : null}</ProjectedLabel>
    <mesh name={`access-${node.id}`} position-y={DISPLAY_CONDUIT_Y / 2}><cylinderGeometry args={[.22, .22, -DISPLAY_CONDUIT_Y, 24]} /><meshStandardMaterial color={palette["model-concrete"] ?? ""} roughness={.9} wireframe={props.representation === "blueprint"} /></mesh>
    {(problemTone || selected || tone !== "neutral") && <mesh position-y={.025} rotation-x={-Math.PI / 2}><ringGeometry args={[1.2, 1.25, 64]} /><meshBasicMaterial color={ringColor} transparent opacity={blinking ? .45 : .8} /></mesh>}
    <ProjectedLabel position={[point.x, .6, point.z + 1.15]}>
      <div className={cn("model-label", `tone-${hydraulic ?? tone}`, selected && "is-selected", blinking && "is-blinking-red", demoState?.hydraulicState === "grey" && "is-sim-failed")}>
        {props.representation === "blueprint" && candidate && (mode === "simulate" || mode === "review") && <small className="model-candidate">{candidate.id}{mode === "simulate" ? ` · ${feasibilityLabel(candidate.feasible)}` : ""}</small>}
        <Button variant="ghost" className="model-node-button" aria-label={`${node.id} ${node.label}`} aria-pressed={selected} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }}><strong>{node.id}</strong>{props.representation === "blueprint" && <span>{node.label}</span>}</Button>
        {props.representation === "blueprint" && sensors.length > 0 && <div className="model-sensors">{sensors.map((s) => <span key={s.id} className={`tone-${sensorTone[s.status]}`} title={`${s.id} · ${s.status}`}><i />{s.id} · {s.status}</span>)}</div>}
      </div>
    </ProjectedLabel>
    <ProjectedLabel position={[point.x, 1.9, point.z - .65]}>
      {mode === "health" && healthPhase === "done" && risks.length > 0 && !(selected && props.selectedFindingId) ? <HealthProblemMarkers nodeId={node.id} findings={risks} selectedFindingId={selected ? props.selectedFindingId ?? null : null} onSelect={(findingId) => props.onSelectHealthFinding?.(findingId)} /> : null}
    </ProjectedLabel>
  </group>;
}

function DirectionArrow({ curve, color, active, offset, reduced }: { curve: THREE.CubicBezierCurve3; color: string; active: boolean; offset: number; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const phase = useRef(offset);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (active && !reduced) phase.current = (phase.current + Math.min(rawDelta, .05) * .18) % 1;
    const t = .15 + phase.current * .7;
    mesh.position.copy(curve.getPoint(t));
    mesh.position.y += .24;
    mesh.quaternion.setFromUnitVectors(up, curve.getTangent(t).normalize());
  });
  return <mesh ref={ref}><coneGeometry args={[.1, .27, 3]} /><meshBasicMaterial color={color} /></mesh>;
}

/** Fixed visual cadence, not a measured velocity, discharge or pipe capacity. */
export function FlowMarkers({ id, curve, color, reduced, stage, lastStage, startedAt, network = false }: { id: string; curve: THREE.CubicBezierCurve3; color: string; reduced: boolean; stage: number; lastStage: number; startedAt: React.RefObject<number>; network?: boolean }) {
  const markers = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!markers.current) return;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const head = flowPulseProgress(elapsed, stage, lastStage, network ? NETWORK_FLOW_HOP_SECONDS : undefined);
    for (let index = 0; index < 9; index++) {
      const progress = reduced ? (index + 1) / 10 : head === null ? -1 : head - index * .025;
      const visible = progress >= 0 && progress <= 1;
      dummy.position.copy(curve.getPoint(Math.max(0, Math.min(1, progress))));
      dummy.scale.setScalar(visible ? 1 - index * .055 : 0);
      dummy.updateMatrix();
      markers.current.setMatrixAt(index, dummy.matrix);
    }
    markers.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={markers} name={`flow-${id}`} args={[undefined, undefined, 9]} renderOrder={2} raycast={() => {}}>
    <sphereGeometry args={[network ? .085 : .115, 12, 8]} /><meshBasicMaterial color={color} transparent opacity={network ? .7 : .9} depthWrite={false} depthTest={false} />
  </instancedMesh>;
}

export function displayConduitCurve(a: DisplayPosition, b: DisplayPosition) {
  const mid = (a.x + b.x) / 2;
  return new THREE.CubicBezierCurve3(new THREE.Vector3(a.x, DISPLAY_CONDUIT_Y, a.z), new THREE.Vector3(mid, DISPLAY_CONDUIT_Y, a.z), new THREE.Vector3(mid, DISPLAY_CONDUIT_Y, b.z), new THREE.Vector3(b.x, DISPLAY_CONDUIT_Y, b.z));
}

function Conduit({ id, a, b, props, palette, reduced, flowStage, lastStage, flowStartedAt }: { id: string; a: DisplayPosition; b: DisplayPosition; props: SceneProps; palette: Palette; reduced: boolean; flowStage: number | undefined; lastStage: number; flowStartedAt: React.RefObject<number> }) {
  const { data, mode, selectedId, onSelect } = props;
  const curve = useMemo(() => displayConduitCurve(a, b), [a, b]);
  const edge = data.network.edges.find((item) => item.id === id);
  const edgeHydraulic = (mode === "health" || mode === "simulate") ? props.bobVisual?.edgeStates?.[id] : undefined;
  const demoState = (mode === "health" || mode === "simulate") && edge ? props.bobVisual?.nodeStates?.[edge.to] ?? props.bobVisual?.nodeStates?.[edge.from] : undefined;
  const hydraulic = hydraulicTone(edgeHydraulic?.hydraulicState);
  const demoSeverity = demoState?.severity && demoState.severity in severityTone ? severityTone[demoState.severity] : null;
  const tone = hydraulic ?? demoSeverity ?? spatialEdgeTone(data, id, mode);
  const selected = selectedId === id || (mode === "simulate" && candidatesForSelection(data, id, selectedId));
  const color = selected ? (palette["primary"] ?? "") : (palette[tone === "neutral" ? "model-metal" : tone] ?? "");
  const waterVisible = (mode === "network" || mode === "simulate" || (mode === "health" && !!props.bobVisual)) && flowStage !== undefined && edgeHydraulic?.hydraulicState !== "grey";
  const flowing = waterVisible || (mode === "review" && routeMembership(data).edges.has(id));
  const midpoint = curve.getPoint(.5);
  const blinking = edgeHydraulic?.hydraulicState === "blinking_red";
  return <group onClick={(event) => { event.stopPropagation(); onSelect(id); }}>
    {/* One visible conduit per canonical edge; the wider transparent tube is hit area only. */}
    <mesh name={`conduit-${id}`} receiveShadow><tubeGeometry args={[curve, 40, props.representation === "blueprint" ? .13 : DISPLAY_CONDUIT_RADIUS, 12, false]} /><meshStandardMaterial color={selected || tone !== "neutral" ? color : (palette["model-concrete"] ?? "")} roughness={.85} wireframe={props.representation === "blueprint"} opacity={edgeHydraulic?.hydraulicState === "grey" ? .35 : 1} transparent={edgeHydraulic?.hydraulicState === "grey" || blinking} /></mesh>
    <mesh><tubeGeometry args={[curve, 20, .32, 6, false]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    {waterVisible && flowStage !== undefined && <FlowMarkers id={id} curve={curve} color={palette[hydraulic ?? demoSeverity ?? "info"] ?? ""} reduced={reduced} stage={flowStage} lastStage={lastStage} startedAt={flowStartedAt} network={mode === "network"} />}
    {tone === "unknown" ? [.3, .5, .7].map((t) => { const p = curve.getPoint(t); return <mesh key={t} position={[p.x, DISPLAY_CONDUIT_Y + .24, p.z]}><sphereGeometry args={[.055, 8, 8]} /><meshBasicMaterial color={color} /></mesh>; }) : !waterVisible && <>
      <DirectionArrow curve={curve} color={color} active={flowing && mode !== "simulate"} offset={.05} reduced={reduced} />
      {flowing && mode !== "simulate" && <DirectionArrow curve={curve} color={color} active offset={.85} reduced={reduced} />}
    </>}
    <ProjectedLabel position={[midpoint.x, DISPLAY_CONDUIT_Y + .3, midpoint.z]}><Button variant="ghost" className={cn("model-edge-button", `tone-${tone}`, selected && "is-selected", blinking && "is-blinking-red", edgeHydraulic?.hydraulicState === "grey" && "is-sim-failed")} aria-label={`Connection ${id}`} aria-pressed={selected} onClick={(event) => { event.stopPropagation(); onSelect(id); }}>{id}</Button></ProjectedLabel>
  </group>;
}

function candidatesForSelection(data: CanonicalResponse, edgeId: string, selectedId: string | null) {
  return edgeCandidates(data, edgeId).some((candidate) => candidate.node_id === selectedId);
}

function SceneContents({ props, palette, reduced }: { props: SceneProps; palette: Palette; reduced: boolean }) {
  const layout = useMemo(() => spatialLayout(props.data.network), [props.data.network]);
  const flowStartedAt = useRef(0);
  useEffect(() => { if (props.mode === "network" || props.simPhase === "running" || props.bobVisual) flowStartedAt.current = performance.now(); }, [props.mode, props.simPhase, props.data, props.bobVisual?.revision]);
  const flowPlan = useMemo(() => {
    try {
      if ((props.mode === "health" || props.mode === "simulate") && props.bobVisual) {
        const stages = props.bobVisual.edgeStages;
        return new Map(stages && typeof stages === "object" ? Object.entries(stages) : []);
      }
      if (props.mode === "network") return networkFlowPlan(props.data);
      return simulationFlowPlan(props.data, props.simPhase);
    } catch (error) {
      console.warn("[aegis] flow plan failed; using empty stages", error);
      return new Map<string, number>();
    }
  }, [props.data, props.simPhase, props.mode, props.bobVisual]);
  const lastStage = flowPlan.size ? Math.max(0, ...flowPlan.values()) : 0;
  const texture = useSurfaceTexture(palette);
  const points = useMemo(() => Object.values(layout.nodes), [layout]);
  return <>
    <color attach="background" args={[palette["canvas"] ?? ""]} />
    <ambientLight intensity={.65} />
    <directionalLight position={[-5, 12, 8]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-bias={-.001} />
    <Environment resolution={64}><Lightformer intensity={1.1} position={[0, 7, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} /><Lightformer intensity={.5} position={[-8, 3, 2]} rotation-y={Math.PI / 2} scale={[12, 6, 1]} /></Environment>
    <ModelCamera width={layout.width} depth={layout.depth} props={props} reduced={reduced} />
    <CatchmentSurface width={layout.width} depth={layout.depth} points={points} palette={palette} texture={texture} representation={props.representation} />
    {layout.edges.map((e) => { const a = layout.nodes[e.from]; const b = layout.nodes[e.to]; return a && b ? <Conduit key={e.id} id={e.id} a={a} b={b} props={props} palette={palette} reduced={reduced} flowStage={flowPlan.get(e.id)} lastStage={lastStage} flowStartedAt={flowStartedAt} /> : null; })}
    {props.data.network.nodes.map((node) => { const p = layout.nodes[node.id]; return p ? <NodeStructure key={node.id} node={node} point={p} props={props} palette={palette} /> : null; })}
    {props.mode === "health" && props.healthPhase === "scanning" && props.scanStartedAt !== null && <DiagnosticSweep width={layout.width} depth={layout.depth} points={points} startedAt={props.scanStartedAt} color={palette["primary"] ?? ""} reduced={reduced} />}
  </>;
}

export function CatchmentScene(props: SceneProps) {
  const palette = useModelPalette();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (!palette) return null;
  return <Canvas orthographic shadows="percentage" dpr={[1, 1.5]} camera={{ position: [-3, 14, 18], near: .1, far: 100 }} gl={{ antialias: true }} onCreated={({ gl }) => { gl.domElement.setAttribute("aria-label", `Stormwater catchment model: ${props.data.network.nodes.length} components`); }} onPointerMissed={() => props.onSelect(null)} aria-label={`Stormwater catchment model: ${props.data.network.nodes.length} components`}>
    <SceneContents props={props} palette={palette} reduced={reduced} />
  </Canvas>;
}