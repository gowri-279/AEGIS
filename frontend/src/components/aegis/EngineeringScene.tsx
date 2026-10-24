import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CanonicalResponse, NetworkNode } from "@/data/types";

export type EngineeringView = "terrain" | "blueprint" | "underground";

type Vec3 = [number, number, number];

const visualNodes: Record<string, { p: Vec3; type: "junction" | "storage" | "recharge" | "sample"; scale?: number }> = {
  J3: { p: [0, 0.35, 0], type: "junction", scale: 1.1 },
  L1: { p: [-7, 0.2, -5], type: "storage", scale: 1 },
  R1: { p: [7, 0.15, -5], type: "recharge", scale: 1 },
  L2: { p: [2.5, 0.2, 8], type: "storage", scale: 1.25 },
  V5: { p: [-12, 0.2, 6], type: "storage", scale: 0.85 },
  V6: { p: [12, 0.2, 7], type: "recharge", scale: 0.9 },
  V7: { p: [-10, 0.2, -11], type: "junction", scale: 0.85 },
  V8: { p: [11, 0.2, -11], type: "storage", scale: 0.9 },
};

const visualEdges: { id: string; a: string; b: string; canonical?: boolean }[] = [
  { id: "E-J3-L1", a: "J3", b: "L1", canonical: true },
  { id: "E-J3-R1", a: "J3", b: "R1", canonical: true },
  { id: "E-J3-L2", a: "J3", b: "L2", canonical: true },
  { id: "E-L1-V5", a: "L1", b: "V5" },
  { id: "E-V5-V7", a: "V5", b: "V7" },
  { id: "E-R1-V6", a: "R1", b: "V6" },
  { id: "E-V6-V8", a: "V6", b: "V8" },
  { id: "E-V7-L2", a: "V7", b: "L2" },
  { id: "E-V8-L2", a: "V8", b: "L2" },
];

function curveFor(edge: { a: string; b: string }) {
  const a = new THREE.Vector3(...visualNodes[edge.a].p);
  const b = new THREE.Vector3(...visualNodes[edge.b].p);
  const mid = a.clone().lerp(b, 0.5);
  mid.y += 0.3;
  return new THREE.CatmullRomCurve3([a, mid, b], false, "catmullrom", 0.2);
}

function Pipe({ edge, selected, highlighted, underground, onSelect, water }: { edge: typeof visualEdges[number]; selected: boolean; highlighted: boolean; underground: boolean; onSelect: (id: string) => void; water: boolean }) {
  const curve = useMemo(() => curveFor(edge), [edge]);
  const particles = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 32;
  const offset = useMemo(() => Array.from({ length: count }, (_, i) => i / count), []);
  useFrame((state, dtRaw) => {
    if (!particles.current) return;
    const dt = Math.min(dtRaw, 0.05);
    offset.forEach((value, i) => {
      const t = (value + state.clock.elapsedTime * (highlighted ? 0.13 : 0.045)) % 1;
      const p = curve.getPoint(t);
      dummy.position.copy(p);
      dummy.scale.setScalar(highlighted ? 0.09 : 0.055);
      dummy.updateMatrix();
      particles.current!.setMatrixAt(i, dummy.matrix);
    });
    particles.current.instanceMatrix.needsUpdate = true;
  });
  const y = underground ? -1.3 : 0.12;
  const materialColor = selected ? "#f4f1e8" : highlighted ? "#f0b54a" : "#6f7a7e";
  return <group position={[0, y, 0]}>
    <mesh onClick={(e) => { e.stopPropagation(); onSelect(edge.id); }}>
      <tubeGeometry args={[curve, 48, edge.canonical ? 0.28 : 0.2, 10, false]} />
      <meshStandardMaterial color={materialColor} metalness={0.75} roughness={0.42} transparent opacity={underground ? 0.6 : 0.78} />
    </mesh>
    <mesh position={[0, 0, 0]}>
      <tubeGeometry args={[curve, 48, edge.canonical ? 0.11 : 0.075, 8, false]} />
      <meshStandardMaterial color={water ? "#267bb1" : "#183d5b"} emissive={highlighted ? "#2d9de0" : "#0c2d45"} emissiveIntensity={highlighted ? 0.7 : 0.18} transparent opacity={0.92} />
    </mesh>
    <instancedMesh ref={particles} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={highlighted ? "#d8f2ff" : "#69b6dc"} />
    </instancedMesh>
  </group>;
}

function Structure({ node, selected, health, onSelect, underground }: { node: { id: string; type: string }; selected: boolean; health: boolean; onSelect: (id: string) => void; underground: boolean }) {
  const visual = visualNodes[node.id] ?? visualNodes.V5;
  const [hover, setHover] = useState(false);
  const active = selected || hover;
  const tone = health ? (node.id === "J3" ? "#d86b53" : "#d6a64d") : "#8d9698";
  return <group position={visual.p} scale={visual.scale ?? 1} onClick={(e) => { e.stopPropagation(); onSelect(node.id); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
    {visual.type === "junction" && <>
      <mesh><cylinderGeometry args={[1, 1, 1.8, 20]} /><meshStandardMaterial color="#667174" metalness={0.75} roughness={0.38} transparent opacity={underground ? 0.5 : 0.82} /></mesh>
      <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[1.08, 1.08, 0.12, 20]} /><meshStandardMaterial color="#3b4547" metalness={0.85} roughness={0.28} /></mesh>
      <mesh position={[0, -0.2, 0]}><cylinderGeometry args={[0.78, 0.78, 0.8, 20]} /><meshStandardMaterial color="#195c82" transparent opacity={0.85} /></mesh>
    </>}
    {visual.type === "storage" && <>
      <mesh><boxGeometry args={[3, 1.35, 2.2]} /><meshStandardMaterial color="#70797a" metalness={0.55} roughness={0.48} transparent opacity={underground ? 0.45 : 0.86} /></mesh>
      <mesh position={[0, -0.28, 0]}><boxGeometry args={[2.8, 0.6, 2]} /><meshStandardMaterial color="#1d6690" transparent opacity={0.9} /></mesh>
      <mesh position={[0, 0.65, 0]}><boxGeometry args={[3.1, 0.08, 2.3]} /><meshStandardMaterial color="#404849" metalness={0.8} /></mesh>
    </>}
    {visual.type === "recharge" && <>
      <mesh><cylinderGeometry args={[1.25, 1.05, 1.1, 8]} /><meshStandardMaterial color="#747d7d" metalness={0.5} roughness={0.55} /></mesh>
      {[0.28, 0, -0.28].map((y) => <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.72 - Math.abs(y), 0.035, 8, 28]} /><meshStandardMaterial color="#367ca1" /></mesh>)}
    </>}
    {active && <mesh position={[0, -0.85, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[1.45, 1.58, 48]} /><meshBasicMaterial color={health ? tone : "#dce5e6"} toneMapped={false} /></mesh>}
    <Html position={[0, 1.7, 0]} center distanceFactor={24} style={{ pointerEvents: "none" }}>
      <div className={`scene-label ${active ? "active" : ""}`}><strong>{node.id}</strong><span>{node.type}</span></div>
    </Html>
  </group>;
}

function Terrain({ rain, flood }: { rain: boolean; flood: boolean }) {
  const buildings = useMemo(() => {
    const result: { x: number; z: number; w: number; h: number; d: number }[] = [];
    for (let x = -18; x <= 18; x += 4) {
      for (let z = -16; z <= 16; z += 4) {
        const nearNetwork = Math.abs(x) < 4 && Math.abs(z) < 5;
        if (nearNetwork || (x + z) % 7 === 0) continue;
        const h = 0.8 + ((Math.abs(x * 13 + z * 7) % 10) / 10) * 2.8;
        result.push({ x: x + ((z % 3) * 0.35), z: z + ((x % 2) * 0.25), w: 2.4, h, d: 2.3 });
      }
    }
    return result;
  }, []);
  return <group>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.08, 0]}><planeGeometry args={[44, 38]} /><meshStandardMaterial color="#77746b" roughness={0.98} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}><planeGeometry args={[44, 3.4]} /><meshStandardMaterial color="#3c4140" /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.015, -8]}><planeGeometry args={[44, 2.8]} /><meshStandardMaterial color="#3c4140" /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[8, -0.01, 0]}><planeGeometry args={[2.8, 38]} /><meshStandardMaterial color="#3c4140" /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[-9, -0.01, 0]}><planeGeometry args={[2.4, 38]} /><meshStandardMaterial color="#3c4140" /></mesh>
    {buildings.map((b, i) => <group key={i} position={[b.x, b.h / 2, b.z]}><mesh><boxGeometry args={[b.w, b.h, b.d]} /><meshStandardMaterial color={i % 4 === 0 ? "#c5c1b6" : "#aaa9a0"} roughness={0.9} /></mesh><mesh position={[0, b.h / 2 + 0.02, 0]}><boxGeometry args={[b.w * 0.88, 0.06, b.d * 0.88]} /><meshStandardMaterial color="#85857e" /></mesh></group>)}
    <Waterway points={[[-20, 0.06, -14], [-12, 0.06, -11], [-4, 0.06, -8], [4, 0.06, -7], [12, 0.06, -3], [20, 0.06, 2]]} />
    <Waterway points={[[18, 0.07, 16], [12, 0.07, 11], [8, 0.07, 7], [4, 0.07, 4], [0, 0.07, 0]]} />
    {flood && <FloodPools />}
    {rain && <Rain />}
  </group>;
}

function Waterway({ points }: { points: Vec3[] }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.2), [points]);
  return <mesh><tubeGeometry args={[curve, 48, 0.22, 8, false]} /><meshStandardMaterial color="#176aa1" emissive="#0f4770" emissiveIntensity={0.25} /></mesh>;
}

function FloodPools() {
  return <group>{[[-8, -4], [7, -7], [11, 6], [-13, 9], [3, 12]].map(([x, z], i) => <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.025, z]}><circleGeometry args={[1.2 + (i % 2) * 0.6, 24]} /><meshStandardMaterial color="#2c7fa8" transparent opacity={0.62} /></mesh>)}</group>;
}

function Rain() {
  const points = useMemo(() => Array.from({ length: 420 }, (_, i) => ({ x: ((i * 17) % 400) / 10 - 20, y: 4 + ((i * 31) % 35) / 10, z: ((i * 23) % 360) / 10 - 18 })), []);
  return <group>{points.map((p, i) => <mesh key={i} position={[p.x, p.y, p.z]} rotation-x={0.1}><boxGeometry args={[0.012, 0.45, 0.012]} /><meshBasicMaterial color="#9bc7df" transparent opacity={0.42} /></mesh>)}</group>;
}

function BlueprintGrid() {
  return <gridHelper args={[42, 42, "#37454b", "#202a2d"]} position={[0, -0.22, 0]} />;
}

function SceneContents({ data, view, selected, onSelect, healthMode, simulationActive, rainActive, floodActive }: { data: CanonicalResponse; view: EngineeringView; selected: string | null; onSelect: (id: string | null) => void; healthMode: boolean; simulationActive: boolean; rainActive: boolean; floodActive: boolean }) {
  const underground = view === "underground";
  const terrain = view === "terrain";
  const highlightedCandidate = simulationActive ? (data.recommendation.selected_candidate_id ?? "") : "";
  const canonicalIds = new Set(data.network.nodes.map((n) => n.id));
  const nodes: NetworkNode[] = [
    ...data.network.nodes,
    ...Object.keys(visualNodes).filter((id) => !canonicalIds.has(id)).map((id) => ({ id, type: visualNodes[id].type === "sample" ? "junction" : visualNodes[id].type, label: `${id} sample`, sensor_ids: [], candidate_id: null, attributes: {} } as NetworkNode)),
  ];
  const highlightedEdges = new Set<string>();
  if (highlightedCandidate) {
    const candidate = data.candidates.find((c) => c.id === highlightedCandidate);
    candidate?.route_edge_ids.forEach((id) => highlightedEdges.add(id));
  }
  return <>
    {terrain ? <Terrain rain={rainActive} flood={floodActive} /> : <BlueprintGrid />}
    {!terrain && <mesh rotation-x={-Math.PI / 2} position={[0, -0.18, 0]}><planeGeometry args={[44, 38]} /><meshStandardMaterial color="#121719" roughness={1} /></mesh>}
    {visualEdges.map((edge) => <Pipe key={edge.id} edge={edge} selected={selected === edge.id} highlighted={highlightedEdges.has(edge.id) || simulationActive} underground={underground} onSelect={onSelect} water={!terrain || simulationActive} />)}
    {nodes.map((node) => <Structure key={node.id} node={node} selected={selected === node.id} health={healthMode} onSelect={onSelect} underground={underground} />)}
    {terrain && <group position={[0, 0.01, 0]}>{[[-5, 10], [15, -4], [-15, -2], [5, -14]].map(([x, z], i) => <mesh key={i} position={[x, 0.03, z]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.22, 12]} /><meshBasicMaterial color="#d7b15d" /></mesh>)}</group>}
    <ambientLight intensity={terrain ? 1.5 : 1.15} />
    <directionalLight position={[8, 18, 12]} intensity={terrain ? 2.4 : 1.7} />
    <directionalLight position={[-12, 10, -10]} intensity={0.8} />
  </>;
}

export function EngineeringScene(props: { data: CanonicalResponse; view: EngineeringView; selected: string | null; onSelect: (id: string | null) => void; healthMode: boolean; simulationActive: boolean; rainActive: boolean; floodActive: boolean }) {
  return <div className="engineering-scene"><Canvas camera={{ position: [24, 22, 29], fov: 42 }} dpr={[1, 1.6]}>
    <color attach="background" args={[props.view === "terrain" ? "#8a887e" : "#101517"]} />
    <SceneContents {...props} />
    <OrbitControls enableDamping dampingFactor={0.07} minDistance={8} maxDistance={55} maxPolarAngle={Math.PI / 2.03} target={[0, 0, 0]} />
  </Canvas></div>;
}
