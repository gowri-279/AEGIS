import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CanonicalResponse, NetworkNode, SensorStatus } from "@/data/types";
import { layoutCanonicalNetwork, type Vec3 } from "@/data/networkLayout";

export type EngineeringView = "terrain" | "blueprint";
type ControlsRef = { current: { target: THREE.Vector3; update: () => void } | null };
type DepthRef = { current: number };
type Layout = Record<string, Vec3>;
const SENSOR_COLORS: Record<SensorStatus, string> = { fresh: "#75a879", degraded: "#c9a25c", stale: "#849090", missing: "#849090", invalid: "#bd5f51", conflicting: "#c9a25c" };
const SURFACE_Y = (x: number, z: number) => 0.12 * Math.sin(x * 0.17) + 0.16 * Math.cos(z * 0.14) + 0.08 * Math.sin((x + z) * 0.11) + 0.28 * Math.sin(x * 0.055 + 0.8) + 0.22 * Math.cos(z * 0.07 - 0.5);
/** Presentation-only dimensions — not pipe diameter, capacity, or survey geometry. */
const BASIN_RX = 5.6;
const BASIN_RZ = 4.2;
const PIPE_RADIUS = { base: 0.32, selected: 0.38, flowHint: 0.09 };
const SUBSURFACE_DEPTH = 0.22;
const URBAN_BASE_OPACITY = 0.52;
const URBAN_FOCUSED_OPACITY = 0.3;
const ORBIT_MAX_POLAR = Math.PI / 2 + 0.34;
const SAMPLE_IDS = ["V5", "V6", "V7", "V8"];

function catchmentHeight(x: number, z: number, basins: Vec3[] = []) {
  let y = SURFACE_Y(x, z);
  basins.forEach(([bx, , bz]) => {
    const d = Math.hypot(x - bx, z - bz);
    y -= THREE.MathUtils.smoothstep(26, 7, d) * 0.14;
  });
  y += 0.04 * Math.sin(x * 0.11 + 0.6) * Math.cos(z * 0.09 - 0.3);
  return y;
}

function terrainExtent(layout: Layout) {
  const points = Object.values(layout);
  if (!points.length) return { size: 58, center: new THREE.Vector3(0, 0, 0) };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  points.forEach(([x, , z]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  });
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const span = Math.max(maxX - minX, maxZ - minZ, 16);
  return { size: THREE.MathUtils.clamp(span + 26, 48, 68), center };
}

function layoutBounds(layout: Layout) {
  const points = Object.values(layout);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  points.forEach(([x, , z]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  });
  const pad = 8;
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

function networkFrame(layout: Layout) {
  const points = Object.values(layout);
  if (!points.length) return { target: new THREE.Vector3(0, 0, 0), position: new THREE.Vector3(8, 18, 26) };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  points.forEach(([x, , z]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  });
  const target = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const span = Math.max(maxX - minX, maxZ - minZ, 14);
  const distance = THREE.MathUtils.clamp(span * 1.28, 16, 36);
  const position = target.clone().add(new THREE.Vector3(distance * 0.38, distance * 0.68, distance * 0.82));
  return { target, position };
}

function subsurfaceInspection(depthRef: DepthRef) {
  return depthRef.current > SUBSURFACE_DEPTH;
}

function samplePositions(canonical: Layout, ids = SAMPLE_IDS.filter((id) => !(id in canonical))): Layout {
  const points = Object.values(canonical);
  const max = points.reduce((acc, p) => Math.max(acc, Math.abs(p[0]), Math.abs(p[2])), 0);
  const radius = Math.max(19, max + 9);
  return Object.fromEntries(ids.map((id, index) => {
    const angle = index * Math.PI / 2 + Math.PI / 4;
    return [id, [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as Vec3];
  }));
}

function buryDepth(type: string | undefined) {
  if (type === "storage") return 2.05;
  if (type === "junction") return 1.25;
  if (type === "recharge") return 1.45;
  return 1.6;
}

/** Presentation-only plan depth for blueprint conduit alignment (not survey elevation). */
const BLUEPRINT_CONDUIT_DEPTH = 1.28;

function pipeCurve(edge: { from: string; to: string }, positions: Layout, typeById: Map<string, string>, basins: Vec3[], blueprint = false) {
  const from = positions[edge.from], to = positions[edge.to];
  if (blueprint) {
    const y = -BLUEPRINT_CONDUIT_DEPTH;
    const a = new THREE.Vector3(from[0], y, from[2]);
    const b = new THREE.Vector3(to[0], y, to[2]);
    const elbow = a.clone().lerp(b, 0.5);
    const lateral = ((edge.from.length + edge.to.length) % 2 ? 1 : -1) * Math.min(0.65, a.distanceTo(b) * 0.035);
    elbow.x += lateral;
    elbow.y = y;
    return new THREE.CatmullRomCurve3([a, elbow, b], false, "catmullrom", 0.08);
  }
  const a = new THREE.Vector3(from[0], catchmentHeight(from[0], from[2], basins) - buryDepth(typeById.get(edge.from)), from[2]);
  const b = new THREE.Vector3(to[0], catchmentHeight(to[0], to[2], basins) - buryDepth(typeById.get(edge.to)), to[2]);
  const mid = a.clone().lerp(b, 0.5);
  const bend = ((edge.from.length + edge.to.length) % 2 ? 1 : -1) * Math.min(1.4, a.distanceTo(b) * 0.06);
  mid.x += bend;
  mid.y -= Math.min(0.55, a.distanceTo(b) * 0.02);
  return new THREE.CatmullRomCurve3([a, mid, b], false, "catmullrom", 0.22);
}

type ClearanceZone = { x: number; z: number; r: number };

function pointInClearance(x: number, z: number, zones: ClearanceZone[]) {
  return zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r);
}

function insideTerrainPatch(x: number, z: number, center: THREE.Vector3, size: number, margin = 1.35) {
  const half = size / 2 - margin;
  return Math.abs(x - center.x) <= half && Math.abs(z - center.z) <= half;
}

function buildNeighborhoodLayout(center: THREE.Vector3, size: number, zones: ClearanceZone[], basins: Vec3[]) {
  const buildings: { x: number; z: number; w: number; d: number; h: number; variant: number }[] = [];
  const trees: { p: Vec3; s: number; variant: number }[] = [];
  const roads: { x: number; z: number; width: number; length: number; rotation: number; primary: boolean }[] = [];
  const parks: { x: number; z: number; w: number; d: number; variant: number }[] = [];
  const half = size / 2 - 1.35;
  const minX = center.x - half, maxX = center.x + half;
  const minZ = center.z - half, maxZ = center.z + half;
  const cell = 3.4;
  const cols = Math.max(5, Math.floor((maxX - minX) / cell));
  const rows = Math.max(5, Math.floor((maxZ - minZ) / cell));

  for (let col = 0; col <= cols; col++) {
    const x = minX + col * cell;
    if (col % 3 !== 0) continue;
    if (pointInClearance(x, center.z, zones)) continue;
    roads.push({ x, z: center.z, width: col % 6 === 0 ? 0.62 : 0.46, length: maxZ - minZ - 0.6, rotation: Math.PI / 2, primary: col % 6 === 0 });
  }
  for (let row = 0; row <= rows; row++) {
    const z = minZ + row * cell;
    if (row % 3 !== 0) continue;
    if (pointInClearance(center.x, z, zones)) continue;
    roads.push({ x: center.x, z, width: row % 6 === 0 ? 0.62 : 0.46, length: maxX - minX - 0.6, rotation: 0, primary: row % 6 === 0 });
  }

  for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) {
    const x = minX + col * cell + cell * 0.5;
    const z = minZ + row * cell + cell * 0.5;
    if (!insideTerrainPatch(x, z, center, size)) continue;
    if (pointInClearance(x, z, zones)) continue;
    const onStreet = col % 3 === 0 || row % 3 === 0 || (col + 1) % 3 === 0 || (row + 1) % 3 === 0;
    if (onStreet) {
      if ((col + row) % 5 === 0) trees.push({ p: [x, catchmentHeight(x, z, basins), z], s: 0.75 + (col % 3) * 0.08, variant: col + row });
      continue;
    }
    const lot = (col * 17 + row * 31) % 100;
    if (lot < 14) {
      parks.push({ x, z, w: cell * 0.82, d: cell * 0.78, variant: col + row });
      continue;
    }
    if (lot < 24) {
      for (let t = 0; t < 3; t++) {
        const tx = x + (t - 1) * 0.85, tz = z + ((col + t) % 2 ? 0.55 : -0.45);
        if (!insideTerrainPatch(tx, tz, center, size) || pointInClearance(tx, tz, zones)) continue;
        trees.push({ p: [tx, catchmentHeight(tx, tz, basins), tz], s: 0.7 + (t % 2) * 0.12, variant: col + row + t });
      }
      continue;
    }
    const variant = (col * 3 + row) % 5;
    const w = 1.85 + (lot % 5) * 0.22;
    const d = 1.7 + (lot % 4) * 0.2;
    const h = 1.05 + (lot % 7) * 0.18 + (col % 4 === 0 ? 0.45 : 0);
    buildings.push({ x, z, w, d, h, variant });
    if (lot % 3 === 0) {
      const tx = x + w * 0.35, tz = z - d * 0.38;
      if (insideTerrainPatch(tx, tz, center, size) && !pointInClearance(tx, tz, zones)) {
        trees.push({ p: [tx, catchmentHeight(tx, tz, basins), tz], s: 0.65, variant: variant + 2 });
      }
    }
  }
  return { buildings, trees, roads, parks };
}

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
  const terrainBackground = useMemo(() => new THREE.Color("#b5b0a4"), []);
  const subsurfaceBackground = useMemo(() => new THREE.Color("#6a645c"), []);
  const blueprintBackground = useMemo(() => new THREE.Color("#142126"), []);
  useFrame(() => {
    const inspect = !blueprint && subsurfaceInspection(depthRef);
    const background = blueprint ? blueprintBackground : color.copy(inspect ? subsurfaceBackground : terrainBackground);
    gl.setClearColor(background);
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color();
    scene.background.copy(background);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(background);
  });
  return null;
}

function CameraHome({ controlsRef, frame }: { controlsRef: ControlsRef; frame: { target: THREE.Vector3; position: THREE.Vector3 } }) {
  const { camera } = useThree();
  const positioned = useRef(false);
  useFrame(() => {
    if (positioned.current || !controlsRef.current) return;
    controlsRef.current.target.copy(frame.target);
    camera.position.copy(frame.position);
    controlsRef.current.update();
    positioned.current = true;
  });
  return null;
}

function CameraFocus({ selected, data, positions, controlsRef }: { selected: string | null; data: CanonicalResponse; positions: Layout; controlsRef: ControlsRef }) {
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
      if (edge && positions[edge.from] && positions[edge.to]) point = new THREE.Vector3(...positions[edge.from]!).lerp(new THREE.Vector3(...positions[edge.to]!), 0.5);
      if (point && controlsRef.current) {
        const target = controlsRef.current.target.clone();
        const offset = camera.position.clone().sub(target);
        const node = data.network.nodes.find((item) => item.id === nodeId);
        const focusDistance = node?.type === "storage" ? 24 : node?.type === "recharge" ? 20 : 17;
        const distance = THREE.MathUtils.clamp(Math.min(offset.length() * 0.62, focusDistance), 13, 30);
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

function SubsurfaceCutaway({ layout, depthRef, blueprint }: { layout: Layout; depthRef: DepthRef; blueprint: boolean }) {
  const bounds = useMemo(() => layoutBounds(layout), [layout]);
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = !blueprint && subsurfaceInspection(depthRef);
  });
  return <group ref={ref} visible={false}>
    <mesh position={[bounds.cx, -1.15, bounds.cz]} receiveShadow><boxGeometry args={[w, 2.35, d]} /><meshStandardMaterial color="#5a534b" roughness={0.98} metalness={0} /></mesh>
    <mesh position={[bounds.cx, 0.06, bounds.cz]} rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial color="#8a8276" roughness={0.94} transparent opacity={0.42} /></mesh>
    <mesh position={[bounds.cx, -0.02, bounds.cz]} rotation-x={-Math.PI / 2}><planeGeometry args={[w * 0.98, d * 0.98]} /><meshStandardMaterial color="#6e675c" roughness={1} transparent opacity={0.28} /></mesh>
    {Object.values(layout).map(([x, , z], i) => <mesh key={i} position={[x, catchmentHeight(x, z) + 0.04, z]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.55, 0.72, 24]} /><meshBasicMaterial color="#9a9082" transparent opacity={0.55} /></mesh>)}
  </group>;
}

function TerrainSurface({ blueprint, basins, depthRef, layout }: { blueprint: boolean; basins: Vec3[]; depthRef: DepthRef; layout: Layout }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { size, center } = useMemo(() => terrainExtent(layout), [layout]);
  const geometry = useMemo(() => {
    const steps = 112, vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let z = 0; z <= steps; z++) for (let x = 0; x <= steps; x++) {
      const px = (x / steps - 0.5) * size + center.x, pz = (z / steps - 0.5) * size + center.z;
      let depression = 0;
      basins.forEach(([bx, , bz]) => {
        const radius = Math.hypot((px - bx) / (BASIN_RX * 1.05), (pz - bz) / (BASIN_RZ * 1.05));
        const blend = THREE.MathUtils.smoothstep(radius, 0.72, 1.22);
        depression = Math.max(depression, 1.05 * (1 - blend));
      });
      vertices.push(px, catchmentHeight(px, pz, basins) - depression, pz);
      uvs.push(x / steps, z / steps);
    }
    for (let z = 0; z < steps; z++) for (let x = 0; x < steps; x++) {
      const i = z * (steps + 1) + x;
      indices.push(i, i + steps + 1, i + 1, i + 1, i + steps + 1, i + steps + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  }, [basins, center.x, center.z, size]);
  const groundTexture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#8a8578"; ctx.fillRect(0, 0, 512, 512);
    let seed = 3917; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 48; i++) { const x = random() * 512, y = random() * 512; ctx.fillStyle = ["rgba(72,88,62,.06)", "rgba(142,128,102,.05)", "rgba(118,110,94,.04)", "rgba(94,102,88,.05)"][i % 4]!; ctx.beginPath(); ctx.ellipse(x, y, 8 + random() * 28, 6 + random() * 22, random() * Math.PI, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = "rgba(72,68,58,.04)"; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(256, 256, 80 + i * 38, 60 + i * 30, 0.2, 0, Math.PI * 2); ctx.stroke(); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 8; return texture;
  }, []);
  const blueprintTexture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#17272b"; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(93,142,148,.11)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke(); }
    ctx.strokeStyle = "rgba(117,161,151,.09)"; ctx.lineWidth = 2;
    for (let r = 70; r < 280; r += 52) { ctx.beginPath(); ctx.ellipse(265, 260, r * 1.12, r * 0.8, -0.25, 0, Math.PI * 2); ctx.stroke(); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2); texture.anisotropy = 8; return texture;
  }, []);
  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.visible = blueprint || !subsurfaceInspection(depthRef);
  });
  return <mesh ref={mesh} geometry={geometry} receiveShadow>
    <meshStandardMaterial map={blueprint ? blueprintTexture : groundTexture} color={blueprint ? "#ffffff" : "#c4beb2"} roughness={0.94} metalness={0} />
  </mesh>;
}

function roadGeometry(x: number, z: number, width: number, length: number, rotation: number, basins: Vec3[], lift = 0) {
  const vertices: number[] = [], indices: number[] = [], steps = Math.max(2, Math.ceil(length / 2)), base = catchmentHeight(x, z, basins);
  for (let i = 0; i <= steps; i++) {
    const localZ = (i / steps - 0.5) * length;
    for (const side of [-1, 1]) {
      const localX = side * width / 2;
      const worldX = x + localX * Math.cos(rotation) + localZ * Math.sin(rotation);
      const worldZ = z - localX * Math.sin(rotation) + localZ * Math.cos(rotation);
      vertices.push(localX, catchmentHeight(worldX, worldZ, basins) - base + lift, localZ);
    }
    if (i < steps) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function Road({ x, z, width, length, rotation = 0, primary = false, blueprint = false, basins }: { x: number; z: number; width: number; length: number; rotation?: number; primary?: boolean; blueprint?: boolean; basins: Vec3[] }) {
  const shoulder = useMemo(() => roadGeometry(x, z, width + 0.32, length, rotation, basins), [basins, x, z, width, length, rotation]);
  const asphalt = useMemo(() => roadGeometry(x, z, width, length, rotation, basins, 0.028), [basins, x, z, width, length, rotation]);
  return <group position={[x, catchmentHeight(x, z, basins) + 0.045, z]} rotation-y={rotation}>
    <mesh geometry={shoulder} receiveShadow><meshStandardMaterial color={blueprint ? "#1b3035" : "#8a8780"} roughness={1} /></mesh>
    <mesh geometry={asphalt} receiveShadow><meshStandardMaterial color={blueprint ? "#20343a" : primary ? "#6a6c66" : "#72746e"} roughness={0.9} /></mesh>
  </group>;
}

function Building({ x, z, w, d, h, variant, blueprint = false, facadeTexture, basins }: { x: number; z: number; w: number; d: number; h: number; variant: number; blueprint?: boolean; facadeTexture: THREE.CanvasTexture; basins: Vec3[] }) {
  const color = ["#8a8680", "#908c86", "#868882", "#8e8a84", "#848780"][variant % 5]!;
  const footprint = useMemo(() => {
    const shape = new THREE.Shape();
    const inset = variant % 3 === 0 ? 0.22 : variant % 3 === 1 ? 0.1 : 0;
    shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2 - inset, -d / 2); shape.lineTo(w / 2, -d / 2 + inset);
    shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2 + inset, d / 2); shape.lineTo(-w / 2, d / 2 - inset); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: variant % 4 === 0, bevelSegments: 1, bevelSize: 0.03, bevelThickness: 0.03, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [d, h, variant, w]);
  const outline = useMemo(() => new THREE.EdgesGeometry(footprint, 24), [footprint]);
  return <group position={[x, catchmentHeight(x, z, basins), z]} rotation-y={variant * 0.29}>
    <mesh geometry={footprint} castShadow receiveShadow><meshStandardMaterial color={blueprint ? "#20383d" : color} roughness={0.9} metalness={blueprint ? 0.1 : 0.02} /></mesh>
    {blueprint && <lineSegments geometry={outline}><lineBasicMaterial color="#609aa1" transparent opacity={0.76} /></lineSegments>}
    <mesh position={[0, h + 0.035, 0]} castShadow><boxGeometry args={[w * 1.015, 0.07, d * 1.015]} /><meshStandardMaterial color={blueprint ? "#29464a" : "#8e8b80"} roughness={0.9} /></mesh>
    {!blueprint && <>
      <mesh position={[0, h * 0.51, d / 2 + 0.012]}><planeGeometry args={[w * 0.88, h * 0.82]} /><meshStandardMaterial map={facadeTexture} color={color} roughness={0.72} /></mesh>
      <mesh position={[w / 2 + 0.012, h * 0.51, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[d * 0.88, h * 0.82]} /><meshStandardMaterial map={facadeTexture} color={color} roughness={0.72} /></mesh>
    </>}
    {variant % 2 === 0 && <mesh position={[0, h * 0.45, d / 2 + 0.008]}><planeGeometry args={[w * 0.46, Math.min(0.52, h * 0.3)]} /><meshStandardMaterial color={blueprint ? "#58a5ac" : "#71817b"} roughness={0.58} /></mesh>}
  </group>;
}

function ParkPatch({ x, z, w, d, variant, blueprint, basins }: { x: number; z: number; w: number; d: number; variant: number; blueprint: boolean; basins: Vec3[] }) {
  const y = catchmentHeight(x, z, basins);
  const treeSpots = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const angle = (i / 5) * Math.PI * 2 + variant * 0.4;
    const radius = (w * 0.22) + (i % 2) * 0.35;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number];
  }), [variant, w]);
  return <group position={[x, y + 0.02, z]}>
    <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial color={blueprint ? "#1a3338" : "#6d7a5c"} roughness={0.94} /></mesh>
    {!blueprint && treeSpots.map(([ox, oz], i) => <Tree key={i} position={[ox, 0, oz]} scale={0.55 + (i % 2) * 0.1} variant={variant + i} blueprint={blueprint} />)}
  </group>;
}

function Tree({ position, scale = 1, variant = 0, blueprint = false }: { position: Vec3; scale?: number; variant?: number; blueprint?: boolean }) {
  const greens = ["#5a6f52", "#647955", "#6b7658", "#566a58"];
  const trunk = 0.55 + (variant % 3) * 0.08;
  return <group position={position} scale={scale * 0.62}>
    <mesh position={[0, trunk * 0.45, 0]} castShadow><cylinderGeometry args={[0.04, 0.07, trunk, 6]} /><meshStandardMaterial color={blueprint ? "#406c72" : "#5c5044"} roughness={1} /></mesh>
    <mesh position={[0, trunk + 0.28, 0]} castShadow><coneGeometry args={[0.38 + (variant % 2) * 0.06, 0.72, 7]} /><meshStandardMaterial color={blueprint ? "#3c6870" : greens[variant % greens.length]} roughness={0.96} /></mesh>
  </group>;
}

function distanceToSegment(point: Vec3, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((point[0] - a[0]) * dx + (point[2] - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(point[0] - (a[0] + dx * t), point[2] - (a[1] + dz * t));
}

function UrbanEnvironment({ positions, blueprint, clearanceZones, depthRef, focused, basins }: { positions: Layout; blueprint: boolean; clearanceZones: ClearanceZone[]; depthRef: DepthRef; focused: boolean; basins: Vec3[] }) {
  const environmentRef = useRef<THREE.Group>(null);
  const facadeTexture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 256;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#aaa69b"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cellW = 40, cellH = 42;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
      const hue = (row * 11 + col * 7) % 3;
      ctx.fillStyle = ["#647a78", "#78877e", "#536e70"][hue]!;
      ctx.fillRect(col * cellW + 7, row * cellH + 8, cellW - 14, cellH - 15);
      ctx.fillStyle = "rgba(235,229,211,.32)"; ctx.fillRect(col * cellW + 7, row * cellH + 8, cellW - 14, 2);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
  }, []);
  const city = useMemo(() => {
    const { center, size } = terrainExtent(positions);
    return buildNeighborhoodLayout(center, size, clearanceZones, basins);
  }, [basins, clearanceZones, positions]);
  useFrame(() => {
    if (!environmentRef.current) return;
    if (subsurfaceInspection(depthRef)) {
      environmentRef.current.visible = false;
      return;
    }
    environmentRef.current.visible = true;
    const visibility = (focused ? URBAN_FOCUSED_OPACITY : URBAN_BASE_OPACITY);
    environmentRef.current.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      materials.forEach((material) => {
        material.userData.networkBaseOpacity ??= material.opacity ?? 1;
        material.transparent = true;
        material.opacity = material.userData.networkBaseOpacity * visibility;
        material.depthWrite = visibility > 0.28;
      });
    });
  });
  return <group>
    <group ref={environmentRef}>
      {city.parks.map((park, i) => <ParkPatch key={`park-${i}`} {...park} blueprint={blueprint} basins={basins} />)}
      {city.roads.map((road, i) => <Road key={`road-${i}`} {...road} blueprint={blueprint} basins={basins} />)}
      {city.buildings.map((building, i) => <Building key={i} {...building} blueprint={blueprint} facadeTexture={facadeTexture} basins={basins} />)}
      {city.trees.map((tree, i) => <Tree key={`infill-${i}`} position={tree.p} scale={tree.s} variant={tree.variant} blueprint={blueprint} />)}
    </group>
  </group>;
}

function lakeGeometries(seed: number) {
  const points = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const wave = 1 + 0.1 * Math.sin(angle * 3 + seed) + 0.055 * Math.cos(angle * 5 + seed * 2) + 0.025 * Math.sin(angle * 7 + seed * 0.4);
    return new THREE.Vector3(Math.cos(angle) * BASIN_RX * wave, 0, Math.sin(angle) * BASIN_RZ * wave);
  });
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
  const boundary = curve.getPoints(96).map((point) => [point.x, point.z] as [number, number]);
  const makeShape = (scale: number) => {
    const shape = new THREE.Shape();
    boundary.forEach(([x, z], index) => { const p: [number, number] = [x * scale, z * scale]; if (!index) shape.moveTo(...p); else shape.lineTo(...p); }); shape.closePath();
    return shape;
  };
  const makeBank = (outerScale: number, outerY: number, innerScale: number, innerY: number) => {
    const vertices: number[] = [], indices: number[] = [];
    boundary.forEach(([x, z], index) => {
      vertices.push(x * outerScale, outerY, z * outerScale, x * innerScale, innerY, z * innerScale);
      const next = (index + 1) % boundary.length, a = index * 2, b = next * 2;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  };
  const waterPoints = boundary.map(([x, z]) => new THREE.Vector3(x * 0.68, 0, z * 0.68));
  return {
    outerBank: makeBank(1.18, -0.06, 1.02, -0.42), innerBank: makeBank(1.02, -0.42, 0.9, -0.68), shallowShelf: makeBank(0.9, -0.68, 0.74, -0.55),
    water: new THREE.ShapeGeometry(makeShape(0.68), 1),
    outline: new THREE.BufferGeometry().setFromPoints([...waterPoints, waterPoints[0]!]),
  };
}

type BasinPort = { x: number; z: number; direction: "inlet" | "outlet" };
function Lake({ blueprint, selected, dimmed, seed, ports }: { blueprint: boolean; selected: boolean; dimmed: boolean; seed: number; ports: BasinPort[] }) {
  const geometries = useMemo(() => lakeGeometries(seed), [seed]);
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (water.current) water.current.position.y = -0.52 + Math.sin(clock.elapsedTime * 0.28 + seed) * 0.006; });
  return <group>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} scale={[1, BASIN_RZ / BASIN_RX, 1]} receiveShadow><ringGeometry args={[BASIN_RX * 0.98, BASIN_RX * 1.14, 56]} /><meshStandardMaterial color={blueprint ? "#3a5558" : "#8a8472"} roughness={0.94} transparent={dimmed} opacity={dimmed ? 0.58 : 1} /></mesh>
    <mesh geometry={geometries.outerBank} receiveShadow><meshStandardMaterial color={blueprint ? "#294047" : "#6f6756"} roughness={0.97} transparent={dimmed} opacity={dimmed ? 0.58 : 1} /></mesh>
    <mesh geometry={geometries.innerBank} receiveShadow><meshStandardMaterial color={blueprint ? "#31525a" : "#7a735f"} roughness={0.94} transparent={dimmed} opacity={dimmed ? 0.6 : 1} /></mesh>
    <mesh geometry={geometries.shallowShelf} receiveShadow><meshStandardMaterial color={blueprint ? "#185467" : "#7d8068"} roughness={0.88} transparent={dimmed} opacity={dimmed ? 0.62 : 1} /></mesh>
    <mesh ref={water} geometry={geometries.water} rotation-x={-Math.PI / 2} position={[0, 0, 0]}><meshStandardMaterial color={blueprint ? "#3d8a96" : "#2f7082"} roughness={0.58} metalness={0.06} transparent={dimmed} opacity={dimmed ? 0.75 : 0.92} /></mesh>
    <lineLoop geometry={geometries.outline} position={[0, -0.5, 0]}><lineBasicMaterial color={blueprint ? "#6aaeb8" : selected ? "#c9a96a" : "#7a8578"} transparent opacity={blueprint ? 0.75 : 0.5} /></lineLoop>
    {ports.map((port, i) => <group key={`${port.direction}-${i}`} position={[port.x * BASIN_RX * 0.96, -0.12, port.z * BASIN_RZ * 0.96]} rotation-y={Math.atan2(port.x, port.z)}>
      <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.92, 0.38, 0.52]} /><meshStandardMaterial color={blueprint ? "#7caab2" : "#8a8780"} roughness={0.82} wireframe={blueprint} /></mesh>
      <mesh position={[0, 0.02, 0.28]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.14, 0.14, 0.55, 10]} /><meshStandardMaterial color={blueprint ? "#5a8a92" : "#5f6662"} roughness={0.86} /></mesh>
    </group>)}
  </group>;
}

function Recharge({ blueprint, seed, dimmed }: { blueprint: boolean; seed: number; dimmed: boolean }) {
  const basin = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const r = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.035 * Math.cos(a * 5);
      const p: [number, number] = [Math.cos(a) * 3.35 * r, Math.sin(a) * 2.55 * r];
      if (!i) shape.moveTo(...p); else shape.lineTo(...p);
    }
    shape.closePath(); return new THREE.ShapeGeometry(shape, 1);
  }, [seed]);
  return <group>
    <mesh geometry={basin} rotation-x={-Math.PI / 2} position={[0, -0.06, 0]}><meshStandardMaterial color={blueprint ? "#18333a" : "#65715f"} side={THREE.DoubleSide} roughness={1} transparent={dimmed} opacity={dimmed ? 0.58 : 1} /></mesh>
    {[2.55, 1.85].map((r, i) => <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.025 + i * 0.018, 0]}><ringGeometry args={[r, r + (i ? 0.04 : 0.14), 56]} /><meshStandardMaterial color={blueprint ? "#347985" : i ? "#8c9274" : "#707665"} roughness={0.96} /></mesh>)}
    <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.42, 0.48, 0.22, 18]} /><meshStandardMaterial color={blueprint ? "#347f8b" : "#74786f"} metalness={0.16} roughness={0.78} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}><circleGeometry args={[0.34, 14]} /><meshStandardMaterial color={blueprint ? "#4a8a94" : "#3a4542"} roughness={0.82} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.205, 0]}><ringGeometry args={[0.36, 0.52, 24]} /><meshStandardMaterial color={blueprint ? "#5a9aa3" : "#6a7568"} roughness={0.9} /></mesh>
  </group>;
}

function Junction({ blueprint, dimmed }: { blueprint: boolean; dimmed: boolean }) {
  return <group>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><circleGeometry args={[2.05, 40]} /><meshStandardMaterial color={blueprint ? "#1b3036" : "#7f8178"} roughness={0.94} transparent={dimmed} opacity={dimmed ? 0.5 : 1} /></mesh>
    <mesh position={[0, -0.22, 0]}><cylinderGeometry args={[1.15, 1.28, 0.78, 28]} /><meshStandardMaterial color={blueprint ? "#24434a" : "#989b92"} metalness={0.16} roughness={0.82} transparent={dimmed} opacity={dimmed ? 0.5 : 1} /></mesh>
    <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[1.32, 1.32, 0.16, 28]} /><meshStandardMaterial color={blueprint ? "#356d77" : "#71766f"} metalness={0.34} roughness={0.7} transparent={dimmed} opacity={dimmed ? 0.5 : 1} /></mesh>
    <mesh position={[0, 0.29, 0]}><cylinderGeometry args={[0.92, 0.92, 0.05, 28]} /><meshStandardMaterial color={blueprint ? "#4a8a94" : "#424a47"} metalness={0.22} roughness={0.78} /></mesh>
    {Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return <mesh key={i} position={[Math.cos(a) * 1.12, 0.29, Math.sin(a) * 1.12]}><sphereGeometry args={[0.045, 8, 6]} /><meshStandardMaterial color={blueprint ? "#67c4cf" : "#b8b9ad"} metalness={0.25} /></mesh>; })}
  </group>;
}

function SensorMarker({ status, label }: { status: SensorStatus; label: string }) {
  const tone = SENSOR_COLORS[status];
  return <group position={[1.15, 1.85, 0.55]}><mesh position={[0, -0.38, 0]}><cylinderGeometry args={[0.065, 0.085, 0.82, 8]} /><meshStandardMaterial color="#64706e" metalness={0.7} /></mesh><mesh><sphereGeometry args={[0.19, 12, 10]} /><meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.08} /></mesh><Html position={[0, 0.52, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}><div className="scene-sensor-label" style={{ color: tone }}>{label} · {status.toUpperCase()}</div></Html></group>;
}

function Structure({ node, position, selected, dimmed, blueprint, onSelect, sensors, edges, positions, basins, sample = false }: { node: NetworkNode; position: Vec3; selected: boolean; dimmed: boolean; blueprint: boolean; onSelect: (id: string) => void; sensors: CanonicalResponse["sensors"]; edges: CanonicalResponse["network"]["edges"]; positions: Layout; basins: Vec3[]; sample?: boolean }) {
  const [hover, setHover] = useState(false);
  const kind = String(node.type);
  const active = selected || hover;
  const scale = 1;
  const sensor = sensors.find((item) => item.node_id === node.id);
  const seed = [...node.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const ports = edges.flatMap((edge) => {
    const isIncoming = edge.to === node.id, isOutgoing = edge.from === node.id;
    if (!isIncoming && !isOutgoing) return [];
    const other = positions[isIncoming ? edge.from : edge.to];
    if (!other) return [];
    const dx = other[0] - position[0], dz = other[2] - position[2], length = Math.hypot(dx, dz) || 1;
    return [{ x: dx / length, z: dz / length, direction: isIncoming ? "inlet" as const : "outlet" as const }];
  });
  const selectionRadius = kind === "storage" ? 6.4 : kind === "recharge" ? 3.65 : kind === "junction" ? 2.15 : 2;
  const ground = catchmentHeight(position[0], position[2], basins);
  const sink = kind === "storage" ? 0.38 : kind === "recharge" ? 0.1 : 0;
  return <group position={[position[0], ground - sink, position[2]]} scale={dimmed ? scale * 0.96 : scale} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
    {kind !== "storage" && !blueprint && <mesh position={[0, -buryDepth(kind) + sink + 0.2, 0]}><cylinderGeometry args={[kind === "junction" ? 0.22 : 0.16, 0.28, buryDepth(kind) - 0.15, 8]} /><meshStandardMaterial color="#6a6660" roughness={0.92} transparent opacity={0.35} /></mesh>}
    {kind === "storage" ? <Lake blueprint={blueprint} selected={active} dimmed={dimmed} seed={seed} ports={ports} />
      : kind === "recharge" ? <Recharge blueprint={blueprint} seed={seed} dimmed={dimmed} />
      : kind === "junction" ? <Junction blueprint={blueprint} dimmed={dimmed} />
      : <group><mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.72, 0.9, 1.1, 12]} /><meshStandardMaterial color={blueprint ? "#6bdff6" : "#a6ada3"} wireframe={blueprint} /></mesh><mesh position={[0, 1.13, 0]}><torusGeometry args={[0.9, 0.08, 8, 20]} /><meshStandardMaterial color={blueprint ? "#5de7ff" : "#7d8878"} /></mesh></group>}
    {sensor && <SensorMarker status={sensor.status} label={sensor.id} />}
    {active && <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[selectionRadius, selectionRadius + 0.1, 48]} /><meshBasicMaterial color="#d3b477" toneMapped={false} /></mesh>}
    <Html position={[0, kind === "storage" ? 0.6 : 2.05, 0]} center distanceFactor={34} style={{ pointerEvents: "none" }}><div className={`scene-label ${active ? "active" : ""} ${blueprint ? "blueprint-label" : ""} ${sample ? "sample-label" : ""}`}><strong>{sample ? `SAMPLE · ${node.id}` : node.id}</strong><span>{sample ? "NON-CANONICAL" : kind}</span></div></Html>
  </group>;
}

function Conduit({ edge, positions, selected, connected, dimmed, blueprint, onSelect, simulationActive, typeById, basins }: { edge: CanonicalResponse["network"]["edges"][number]; positions: Layout; selected: boolean; connected: boolean; dimmed: boolean; blueprint: boolean; onSelect: (id: string) => void; simulationActive: boolean; typeById: Map<string, string>; basins: Vec3[] }) {
  const curve = useMemo(() => pipeCurve(edge, positions, typeById, basins, blueprint), [basins, blueprint, edge, positions, typeById]);
  const from = positions[edge.from]!, to = positions[edge.to]!;
  const opacity = dimmed ? 0.18 : 0.9;
  const arrowPoint = curve.getPoint(0.72), arrowTangent = curve.getTangent(0.72);
  const arrowRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowTangent);
  return <group onClick={(event) => { event.stopPropagation(); onSelect(edge.id); }}>
    <mesh><tubeGeometry args={[curve, 64, selected ? PIPE_RADIUS.selected : PIPE_RADIUS.base, 16, false]} /><meshStandardMaterial color={selected ? "#c6a96d" : connected ? "#8a9994" : blueprint ? "#4a7a84" : "#5f6a66"} roughness={0.86} metalness={0.08} transparent opacity={opacity} /></mesh>
    <mesh><tubeGeometry args={[curve, 64, PIPE_RADIUS.flowHint, 10, false]} /><meshStandardMaterial color={blueprint ? "#6a9aa3" : "#3d5558"} roughness={0.78} transparent opacity={dimmed ? 0.1 : 0.55} /></mesh>
    <mesh position={arrowPoint} quaternion={arrowRotation}><coneGeometry args={[0.28, 0.62, 8]} /><meshStandardMaterial color={blueprint ? "#6a9aa3" : "#51676a"} metalness={0.2} roughness={0.58} transparent opacity={dimmed ? 0.15 : 0.88} /></mesh>
    {simulationActive && <FlowDots curve={curve} dimmed={dimmed} />}
  </group>;
}

function FlowDots({ curve, dimmed }: { curve: THREE.CatmullRomCurve3; dimmed: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (!ref.current) return; ref.current.children.forEach((child, i) => child.position.copy(curve.getPoint((i / 12 + clock.elapsedTime * 0.06) % 1))); });
  return <group ref={ref} visible={!dimmed}>{Array.from({ length: 12 }, (_, i) => <mesh key={i} scale={0.09}><sphereGeometry args={[1, 7, 6]} /><meshBasicMaterial color="#7aa8b0" /></mesh>)}</group>;
}

function Rain() {
  const drops = useMemo(() => Array.from({ length: 200 }, (_, i) => ({ x: ((i * 17) % 820) / 10 - 41, z: ((i * 23) % 760) / 10 - 38, y: 5 + (i % 8) })), []);
  useFrame(({ clock }) => drops.forEach((drop) => { drop.y = 8 - ((clock.elapsedTime * 5 + drop.x + drop.z) % 8); }));
  return <group>{drops.map((drop, i) => <mesh key={i} position={[drop.x, drop.y, drop.z]}><boxGeometry args={[0.018, 0.42, 0.018]} /><meshBasicMaterial color="#abd9ea" transparent opacity={0.38} /></mesh>)}</group>;
}

function SceneContents({ data, view, selected, onSelect, healthMode, simulationActive, rainActive, floodActive, positions, samplesVisible, depthRef }: { data: CanonicalResponse; view: EngineeringView; selected: string | null; onSelect: (id: string) => void; healthMode: boolean; simulationActive: boolean; rainActive: boolean; floodActive: boolean; positions: Layout; samplesVisible: boolean; depthRef: DepthRef }) {
  const blueprint = view === "blueprint";
  const selectedSensor = data.sensors.find((sensor) => sensor.id === selected);
  const selectedNodeId = selectedSensor?.node_id ?? (data.network.nodes.some((node) => node.id === selected) ? selected : null);
  const connectedIds = new Set(selectedNodeId ? data.network.edges.filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId).map((edge) => edge.id) : []);
  const selectedCandidate = data.candidates.find((candidate) => candidate.node_id === selectedNodeId);
  const activeRoute = new Set(simulationActive && selectedCandidate ? selectedCandidate.route_edge_ids : []);
  const emphasis = Boolean(selected || activeRoute.size);
  const sampleIds = SAMPLE_IDS.filter((id) => !(id in positions));
  const basins = useMemo(() => data.network.nodes.filter((node) => node.type === "storage").map((node) => positions[node.id]).filter((position): position is Vec3 => Boolean(position)), [data.network.nodes, positions]);
  const typeById = useMemo(() => new Map(data.network.nodes.map((node) => [node.id, node.type])), [data.network.nodes]);
  const sampleNodes: NetworkNode[] = sampleIds.map((id, i) => ({ id, type: i === 1 ? "recharge" : "storage", label: `${id} visualization sample`, sensor_ids: [], attributes: {} }));
  const allPositions = useMemo(() => ({ ...positions, ...samplePositions(positions, sampleIds) }), [positions, sampleIds.join("|")]);
  const clearanceZones = useMemo<ClearanceZone[]>(() => {
    const zones: ClearanceZone[] = [];
    data.network.nodes.forEach((node) => {
      const point = allPositions[node.id];
      if (!point) return;
      const r = node.type === "storage" ? 11.5 : node.type === "junction" ? 7.8 : node.type === "recharge" ? 8.8 : 7;
      zones.push({ x: point[0], z: point[2], r });
    });
    sampleIds.forEach((id) => {
      const point = allPositions[id];
      if (point) zones.push({ x: point[0], z: point[2], r: 8.5 });
    });
    return zones;
  }, [allPositions, data.network.nodes, sampleIds]);
  return <group>
    <TerrainSurface blueprint={blueprint} basins={basins} depthRef={depthRef} layout={positions} />
    <SubsurfaceCutaway layout={positions} depthRef={depthRef} blueprint={blueprint} />
    <UrbanEnvironment positions={positions} blueprint={blueprint} clearanceZones={clearanceZones} depthRef={depthRef} focused={Boolean(selected)} basins={basins} />
    {data.network.edges.map((edge) => {
      const isConnected = connectedIds.has(edge.id);
      const dimmed = emphasis && !isConnected && selected !== edge.id && !activeRoute.has(edge.id);
      if (!allPositions[edge.from] || !allPositions[edge.to]) return null;
      return <Conduit key={edge.id} edge={edge} positions={allPositions} selected={selected === edge.id} connected={isConnected || activeRoute.has(edge.id)} dimmed={dimmed} blueprint={blueprint} onSelect={onSelect} simulationActive={simulationActive} typeById={typeById} basins={basins} />;
    })}
    {data.network.nodes.map((node) => {
      const nodeSensors = data.sensors.filter((sensor) => sensor.node_id === node.id);
      const dimmed = emphasis && selectedNodeId !== node.id && !data.network.edges.some((edge) => connectedIds.has(edge.id) && (edge.from === node.id || edge.to === node.id));
      return <Structure key={node.id} node={node} position={allPositions[node.id]!} selected={selected === node.id || nodeSensors.some((sensor) => sensor.id === selected)} dimmed={dimmed} blueprint={blueprint} onSelect={onSelect} sensors={data.sensors} edges={data.network.edges} positions={allPositions} basins={basins} />;
    })}
    {samplesVisible && sampleNodes.map((node) => <Structure key={node.id} node={node} position={allPositions[node.id]!} selected={selected === node.id} dimmed={false} blueprint={blueprint} onSelect={onSelect} sensors={[]} edges={[]} positions={allPositions} basins={basins} sample />)}
    {healthMode && data.risks.map((risk) => { const target = allPositions[risk.target_id] ?? allPositions[data.sensors.find((sensor) => sensor.id === risk.target_id)?.node_id ?? ""]; return target ? <mesh key={risk.id} position={[target[0], catchmentHeight(target[0], target[2], basins) + 0.18, target[2]]} rotation-x={-Math.PI / 2}><ringGeometry args={[4, 4.14, 48]} /><meshBasicMaterial color={risk.severity === "critical" || risk.severity === "high" ? "#c86254" : "#c7a55f"} /></mesh> : null; })}
    {rainActive && <Rain />}{floodActive && !blueprint && <mesh rotation-x={-Math.PI / 2} position={[26, catchmentHeight(26, 20, basins) + 0.08, 20]}><circleGeometry args={[2.2, 28]} /><meshStandardMaterial color="#3a8a9a" transparent opacity={0.45} /></mesh>}
  </group>;
}

export function EngineeringScene({ data, view, selected, onSelect, healthMode, simulationActive, rainActive, floodActive, samplesVisible = false }: { data: CanonicalResponse; view: EngineeringView; selected: string | null; onSelect: (id: string | null) => void; healthMode: boolean; simulationActive: boolean; rainActive: boolean; floodActive: boolean; samplesVisible?: boolean }) {
  const controlsRef = useRef<any>(null);
  const depthRef = useRef(0);
  const positions = useMemo(() => layoutCanonicalNetwork(data.network.nodes, data.network.edges), [data.network.nodes, data.network.edges]);
  const focusPositions = useMemo(() => ({ ...positions, ...samplePositions(positions) }), [positions]);
  const frame = useMemo(() => networkFrame(positions), [positions]);
  return <div className="engineering-scene"><Canvas shadows dpr={[1, 1.7]} camera={{ position: frame.position.toArray(), fov: 40 }} onPointerMissed={() => onSelect(null)} gl={{ antialias: true }}>
    <color attach="background" args={[view === "blueprint" ? "#142126" : "#b5b0a4"]} />
    <fog attach="fog" args={[view === "blueprint" ? "#142126" : "#b5b0a4", 42, 98]} />
    <hemisphereLight args={[view === "blueprint" ? "#7ebac4" : "#eff3e7", view === "blueprint" ? "#18272b" : "#625b4e", view === "blueprint" ? 0.8 : 1.15]} />
    <ambientLight intensity={view === "blueprint" ? 0.7 : 0.55} />
    <directionalLight castShadow position={[24, 34, 15]} intensity={view === "blueprint" ? 0.75 : 1.65} shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-far={110} shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} shadow-bias={-0.0002} />
    <directionalLight position={[-24, 15, -20]} intensity={view === "blueprint" ? 0.45 : 0.58} color="#d9e4d6" />
    <CameraHome controlsRef={controlsRef} frame={frame} />
    <CameraDepth depthRef={depthRef} />
    <SceneAtmosphere blueprint={view === "blueprint"} depthRef={depthRef} />
    <SceneContents data={data} view={view} selected={selected} onSelect={onSelect} healthMode={healthMode} simulationActive={simulationActive} rainActive={rainActive} floodActive={floodActive} positions={positions} samplesVisible={samplesVisible || Boolean(selected && SAMPLE_IDS.includes(selected))} depthRef={depthRef} />
    <CameraFocus selected={selected} data={data} positions={focusPositions} controlsRef={controlsRef} />
    <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.09} minDistance={6} maxDistance={72} minPolarAngle={0.12} maxPolarAngle={ORBIT_MAX_POLAR} />
  </Canvas></div>;
}
