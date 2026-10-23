import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Environment, Grid, Html, Lightformer, OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CanonicalResponse, NetworkNode } from "@/data/types";
import { edgeLayout, nl, nodeLayout, sensorLayout, type Vec3 } from "@/data/networkLayout";
import { P, sensorColor, severityColor } from "./palette";

export type ViewMode = "blueprint" | "terrain" | "underground";

interface SceneProps {
  data: CanonicalResponse;
  selected: string | null;
  onSelect: (id: string | null) => void;
  viewMode: ViewMode;
  healthMode: boolean;
  simActive: boolean;
}

function edgeCurve(edgeId: string, from: string, to: string) {
  const pts: Vec3[] = [nl(from).position, ...(edgeLayout[edgeId]?.via ?? []), nl(to).position];
  return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.3);
}

function focusPoint(id: string, data: CanonicalResponse): THREE.Vector3 | null {
  if (nodeLayout[id]) return new THREE.Vector3(...nl(id).position);
  const s = data.sensors.find((x) => x.id === id);
  if (s) return new THREE.Vector3(...nl(s.node_id).position);
  const e = data.network.edges.find((x) => x.id === id);
  if (e) return edgeCurve(e.id, e.from, e.to).getPoint(0.5);
  const r = data.risks.find((x) => x.id === id);
  if (r) return focusPoint(r.target_id, data);
  const c = data.candidates.find((x) => x.id === id);
  if (c) return focusPoint(c.node_id, data);
  return null;
}

function CameraRig({ target }: { target: THREE.Vector3 | null }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<{ t: THREE.Vector3; c: THREE.Vector3 } | null>(null);
  const last = useRef<string>("");
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const key = target ? target.toArray().join(",") : "home";
    if (key !== last.current) {
      last.current = key;
      goal.current = target
        ? { t: target.clone(), c: target.clone().add(new THREE.Vector3(6, 6, 9)) }
        : { t: new THREE.Vector3(1, -0.5, 2.5), c: new THREE.Vector3(22, 20, 28) };
    }
    if (!controls || !goal.current) return;
    const k = 1 - Math.exp(-3 * dt);
    controls.target.lerp(goal.current.t, k);
    camera.position.lerp(goal.current.c, k);
    controls.update();
    if (camera.position.distanceTo(goal.current.c) < 0.05) goal.current = null; // release to user
  });
  return null;
}

function Pipe({ id, from, to, dim, highlight, hot, onSelect, selected }: {
  id: string; from: string; to: string; dim: boolean; highlight: boolean; hot: boolean; selected: boolean; onSelect: (id: string) => void;
}) {
  const curve = useMemo(() => edgeCurve(id, from, to), [id, from, to]);
  const r = edgeLayout[id]?.radius ?? 0.3;
  const [hover, setHover] = useState(false);
  const particles = useRef<THREE.InstancedMesh>(null);
  const N = 46;
  const offsets = useMemo(() => Array.from({ length: N }, (_, i) => ({ t: i / N, j: new THREE.Vector3((Math.sin(i * 12.9) * 0.5) * r * 0.9, (Math.cos(i * 7.3) * 0.5) * r * 0.9, 0) })), [r]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const speed = highlight ? 0.22 : 0.08;
    const m = particles.current;
    if (!m) return;
    offsets.forEach((o, i) => {
      o.t = (o.t + dt * speed) % 1;
      const p = curve.getPoint(o.t);
      const wobble = Math.sin(state.clock.elapsedTime * 3 + i) * 0.04;
      dummy.position.set(p.x + o.j.x * 0.6, p.y + o.j.y * 0.6 + wobble, p.z + o.j.x * 0.6);
      const s = (highlight ? 0.11 : 0.075) * (0.7 + 0.3 * Math.sin(i));
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  const shellColor = selected || hover ? P.structureEdge : hot ? P.warn : "#2a4a57";
  return (
    <group>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto"; }}
      >
        <tubeGeometry args={[curve, 80, r, 20, false]} />
        <meshPhysicalMaterial color={shellColor} transparent opacity={dim ? 0.08 : 0.22} roughness={0.15} metalness={0.2} transmission={0.4} depthWrite={false} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 80, r * 0.45, 10, false]} />
        <meshStandardMaterial color={P.waterDeep} emissive={highlight ? P.water : P.waterDeep} emissiveIntensity={dim ? 0.1 : highlight ? 1.4 : 0.5} transparent opacity={dim ? 0.15 : 0.7} />
      </mesh>
      <instancedMesh ref={particles} args={[undefined, undefined, N]} visible={!dim}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={highlight ? "#bff6ff" : P.water} toneMapped={false} />
      </instancedMesh>
      {/* flanges */}
      {[0.2, 0.5, 0.8].map((t) => {
        const p = curve.getPoint(t); const tan = curve.getTangent(t);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
        return (
          <mesh key={t} position={p} quaternion={q}>
            <cylinderGeometry args={[r * 1.18, r * 1.18, 0.08, 20]} />
            <meshStandardMaterial color={P.structure} metalness={0.6} roughness={0.4} transparent opacity={dim ? 0.2 : 1} />
          </mesh>
        );
      })}
    </group>
  );
}

function NodeLabel({ node, sub, tone }: { node: NetworkNode; sub?: string | undefined; tone?: string | undefined }) {
  return (
    <Html center distanceFactor={30} zIndexRange={[5, 0]} position={[0, 2.8, 0]} style={{ pointerEvents: "none" }}>
      <div className="node-tag">
        <span className="font-mono">{node.id}</span>
        {sub && <span className="node-tag-sub" style={{ color: tone }}>{sub}</span>}
      </div>
    </Html>
  );
}

function NodeStructure({ node, selected, dim, accent, onSelect, ring }: {
  node: NetworkNode; selected: boolean; dim: boolean; accent?: string | undefined; ring?: string | undefined; onSelect: (id: string) => void;
}) {
  const { position, scale } = nl(node.id);
  const [hover, setHover] = useState(false);
  const ringRef = useRef<THREE.Mesh>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ringRef.current) {
      const s = 1 + ((state.clock.elapsedTime * 0.6) % 1) * 1.2;
      ringRef.current.scale.set(s, s, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ((state.clock.elapsedTime * 0.6) % 1));
    }
    if (waterRef.current) waterRef.current.position.y = -0.2 + Math.sin(state.clock.elapsedTime * 1.2) * 0.03;
  });
  const edge = selected || hover ? P.structureEdge : accent ?? "#2c6576";
  const op = dim ? 0.25 : 1;
  const handlers = {
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(node.id); },
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { setHover(false); document.body.style.cursor = "auto"; },
  };
  return (
    <group position={position} scale={scale}>
      {node.type === "junction" && (
        <group {...handlers}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[1, 1, 2.2, 32, 1, true]} />
            <meshStandardMaterial color={P.structure} metalness={0.5} roughness={0.5} transparent opacity={0.55 * op} side={THREE.DoubleSide} />
            <Edges color={edge} threshold={20} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[1.15, 1.15, 0.12, 32]} />
            <meshStandardMaterial color="#2b3640" metalness={0.8} roughness={0.3} transparent opacity={op} />
          </mesh>
          <mesh ref={waterRef} position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.95, 0.95, 1.2, 32]} />
            <meshStandardMaterial color={P.waterDeep} emissive={P.water} emissiveIntensity={0.4} transparent opacity={0.6 * op} />
          </mesh>
        </group>
      )}
      {node.type === "storage" && (
        <group {...handlers}>
          <mesh>
            <boxGeometry args={[3.4, 1.6, 2.6]} />
            <meshStandardMaterial color={P.structure} transparent opacity={0.35 * op} metalness={0.3} roughness={0.6} depthWrite={false} />
            <Edges color={edge} />
          </mesh>
          <mesh position={[0, -0.35, 0]}>
            <boxGeometry args={[3.2, 0.8, 2.4]} />
            <meshStandardMaterial color={P.waterDeep} emissive={P.water} emissiveIntensity={0.35} transparent opacity={0.55 * op} />
          </mesh>
          {[-1.3, 0, 1.3].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.05, 1.6, 2.6]} />
              <meshStandardMaterial color="#33424d" transparent opacity={0.6 * op} />
            </mesh>
          ))}
        </group>
      )}
      {node.type === "recharge" && (
        <group {...handlers}>
          <mesh>
            <cylinderGeometry args={[1.3, 1.1, 1.4, 6]} />
            <meshStandardMaterial color={P.structure} transparent opacity={0.45 * op} metalness={0.4} roughness={0.5} />
            <Edges color={edge} />
          </mesh>
          {[0.2, -0.3, -0.8].map((y, i) => (
            <mesh key={y} position={[0, y - 0.6, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.7 - i * 0.15, 0.04, 8, 32]} />
              <meshStandardMaterial color={P.water} emissive={P.water} emissiveIntensity={0.6} transparent opacity={0.6 * op} />
            </mesh>
          ))}
        </group>
      )}
      {ring && (
        <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
          <ringGeometry args={[1.6, 1.75, 48]} />
          <meshBasicMaterial color={ring} transparent toneMapped={false} />
        </mesh>
      )}
      {(selected || hover) && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -1.05, 0]}>
          <ringGeometry args={[2.1, 2.2, 64]} />
          <meshBasicMaterial color={P.structureEdge} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function SensorMarker({ id, data, selected, onSelect, pulse }: { id: string; data: CanonicalResponse; selected: boolean; onSelect: (id: string) => void; pulse: boolean }) {
  const s = data.sensors.find((x) => x.id === id)!;
  const base = nl(s.node_id).position;
  const off = sensorLayout[id]?.offset ?? [0, 2, 0];
  const pos: Vec3 = [base[0] + off[0], base[1] + off[1], base[2] + off[2]];
  const col = sensorColor[s.status];
  const hollow = s.status === "missing";
  const ref = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (ref.current && (pulse || s.status !== "fresh")) {
      const k = 1 + Math.sin(st.clock.elapsedTime * 4) * 0.12;
      ref.current.scale.setScalar(k);
    }
  });
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "auto")}>
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
        <meshStandardMaterial color="#556570" metalness={0.8} />
      </mesh>
      <mesh ref={ref}>
        {s.status === "invalid" ? <octahedronGeometry args={[0.32]} /> : <sphereGeometry args={[0.28, 24, 24]} />}
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={s.status === "stale" ? 0.1 : 1.2} wireframe={hollow} toneMapped={false} />
      </mesh>
      {s.status === "conflicting" && (
        <mesh position={[0.35, 0.35, 0]}><sphereGeometry args={[0.12, 12, 12]} /><meshBasicMaterial color={P.crit} toneMapped={false} /></mesh>
      )}
      <Html center distanceFactor={26} zIndexRange={[5, 0]} position={[0, 0.7, 0]} style={{ pointerEvents: "none" }}>
        <div className="sensor-tag" data-status={s.status}>
          <span className="font-mono">{s.id}</span> · {s.status}
        </div>
      </Html>
      {selected && <mesh><sphereGeometry args={[0.5, 24, 24]} /><meshBasicMaterial color={P.structureEdge} wireframe transparent opacity={0.5} /></mesh>}
    </group>
  );
}

function Terrain({ mode }: { mode: ViewMode }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(60, 60, 90, 90);
    const pos = g.attributes['position']!;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.18) * 0.6 + Math.cos(y * 0.22) * 0.5 + Math.sin((x + y) * 0.09) * 0.8);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  if (mode === "blueprint") return null;
  const under = mode === "underground";
  return (
    <group position={[0, 2.4, 2]} rotation-x={-Math.PI / 2}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={P.terrain} roughness={0.95} transparent opacity={under ? 0.07 : 0.85} depthWrite={!under} flatShading />
      </mesh>
      <mesh geometry={geo} position={[0, 0, 0.01]}>
        <meshBasicMaterial color={under ? P.structureEdge : "#2c3a33"} wireframe transparent opacity={under ? 0.12 : 0.25} />
      </mesh>
    </group>
  );
}

function SceneContents(p: SceneProps) {
  const { data, selected, onSelect, healthMode, simActive, viewMode } = p;
  const rec = data.recommendation;
  const selCand = data.candidates.find((c) => c.id === rec.selected_candidate_id);
  const routeEdges = new Set(simActive && selCand ? selCand.route_edge_ids : []);
  const routeNode = simActive ? selCand?.node_id : undefined;
  const riskTargets = new Map(data.risks.map((r) => [r.target_id, r]));
  const target = selected ? focusPoint(selected, data) : null;
  const sensorCritical = data.sensors.some((s) => s.critical && s.effective_value == null);

  return (
    <>
      <CameraRig target={target} />
      <Grid position={[0, -2.6, 0]} args={[80, 80]} cellSize={1} cellThickness={0.5} cellColor={P.grid} sectionSize={5} sectionThickness={1} sectionColor={P.gridSection} fadeDistance={70} fadeStrength={1.5} infiniteGrid />
      <Terrain mode={viewMode} />
      {data.network.edges.map((e) => {
        const onRoute = routeEdges.has(e.id);
        return (
          <Pipe key={e.id} id={e.id} from={e.from} to={e.to} selected={selected === e.id}
            dim={simActive && !onRoute && routeEdges.size > 0}
            highlight={onRoute} hot={healthMode && riskTargets.has(e.id)} onSelect={onSelect} />
        );
      })}
      {data.network.nodes.map((n) => {
        const risk = riskTargets.get(n.id);
        const cand = data.candidates.find((c) => c.node_id === n.id);
        let ring: string | undefined;
        if (healthMode && risk) ring = severityColor[risk.severity];
        if (simActive && routeNode === n.id) ring = P.ok;
        if (healthMode && n.id === "J3" && sensorCritical) ring = P.crit;
        let sub: string | undefined; let tone: string | undefined;
        if (simActive && cand) {
          sub = cand.feasible ? `${cand.id} · feasible` : cand.feasible === false ? `${cand.id} · infeasible` : `${cand.id} · not evaluated`;
          tone = cand.feasible ? P.ok : cand.feasible === false ? P.crit : P.muted;
        } else if (cand) { sub = cand.id; }
        else if (n.type === "junction") { sub = "junction"; }
        return (
          <group key={n.id}>
            <NodeStructure node={n} selected={selected === n.id} onSelect={onSelect} ring={ring}
              dim={simActive && routeEdges.size > 0 && n.id !== routeNode && n.id !== "J3"}
              accent={simActive && cand ? (cand.feasible ? P.ok : cand.feasible === false ? P.crit : P.muted) : undefined} />
            <group position={nl(n.id).position}><NodeLabel node={n} sub={sub} tone={tone} /></group>
          </group>
        );
      })}
      {data.sensors.map((s) => <SensorMarker key={s.id} id={s.id} data={data} selected={selected === s.id} onSelect={onSelect} pulse={healthMode} />)}
    </>
  );
}

export function NetworkScene(props: SceneProps) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [26, 22, 30], fov: 42 }} onPointerMissed={() => props.onSelect(null)} gl={{ antialias: true }}>
      <color attach="background" args={[P.bg]} />
      <fog attach="fog" args={[P.bg, 30, 85]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 18, 8]} intensity={1.1} color="#cfe9ff" />
      <pointLight position={[0, 6, 0]} intensity={30} color={P.water} distance={30} />
      <Environment resolution={64}>
        <Lightformer intensity={1.5} position={[0, 8, 0]} scale={[20, 20, 1]} rotation-x={Math.PI / 2} color="#9fdfff" />
        <Lightformer intensity={0.8} position={[-10, 2, -4]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} color="#5a7cff" />
      </Environment>
      <SceneContents {...props} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={4} maxDistance={70} maxPolarAngle={Math.PI * 0.49} />
    </Canvas>
  );
}
