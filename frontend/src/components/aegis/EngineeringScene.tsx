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
const BASIN_RX = 6.4;
const BASIN_RZ = 4.8;
const PIPE_RADIUS = { base: 0.34, selected: 0.4, flowHint: 0.11 };
const SUBSURFACE_DEPTH = 0.22;
const URBAN_BASE_OPACITY = 0.38;
const URBAN_FOCUSED_OPACITY = 0.18;
const ORBIT_MAX_POLAR = Math.PI / 2 + 0.34;
const SAMPLE_IDS = ["V5", "V6", "V7", "V8"];

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
  const distance = THREE.MathUtils.clamp(span * 1.55, 18, 42);
  const position = target.clone().add(new THREE.Vector3(distance * 0.34, distance * 0.72, distance * 0.92));
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

function pipeCurve(edge: { from: string; to: string }, positions: Layout) {
  const from = positions[edge.from], to = positions[edge.to];
  const a = new THREE.Vector3(from[0], SURFACE_Y(from[0], from[2]) - 1.65, from[2]);
  const b = new THREE.Vector3(to[0], SURFACE_Y(to[0], to[2]) - 1.65, to[2]);
  const mid = a.clone().lerp(b, 0.5);
  const bend = ((edge.from.length + edge.to.length) % 2 ? 1 : -1) * Math.min(1.8, a.distanceTo(b) * 0.08);
  mid.x += bend;
  mid.y -= Math.min(0.8, a.distanceTo(b) * 0.025);
  return new THREE.CatmullRomCurve3([a, mid, b], false, "catmullrom", 0.25);
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
  const terrainBackground = useMemo(() => new THREE.Color("#acb8b1"), []);
  const subsurfaceBackground = useMemo(() => new THREE.Color("#4a524d"), []);
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

function TerrainSurface({ blueprint, basins, depthRef }: { blueprint: boolean; basins: Vec3[]; depthRef: DepthRef }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const size = 90, steps = 128, vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let z = 0; z <= steps; z++) for (let x = 0; x <= steps; x++) {
      const px = (x / steps - 0.5) * size, pz = (z / steps - 0.5) * size;
      let depression = 0;
      basins.forEach(([bx, , bz]) => {
        const radius = Math.hypot((px - bx) / BASIN_RX, (pz - bz) / BASIN_RZ);
        const blend = THREE.MathUtils.smoothstep(radius, 0.84, 1.34);
        depression = Math.max(depression, 0.78 * (1 - blend));
      });
      vertices.push(px, SURFACE_Y(px, pz) - depression, pz);
      uvs.push(x / steps, z / steps);
    }
    for (let z = 0; z < steps; z++) for (let x = 0; x < steps; x++) {
      const i = z * (steps + 1) + x;
      indices.push(i, i + steps + 1, i + 1, i + 1, i + steps + 1, i + steps + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  }, [basins]);
  const groundTexture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#74776e"; ctx.fillRect(0, 0, 512, 512);
    let seed = 3917; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 72; i++) { const x = random() * 512, y = random() * 512; ctx.fillStyle = ["rgba(88,111,74,.045)", "rgba(157,142,113,.04)", "rgba(190,174,139,.03)", "rgba(61,92,68,.04)"][i % 4]!; ctx.beginPath(); ctx.ellipse(x, y, 12 + random() * 48, 9 + random() * 34, random() * Math.PI, 0, Math.PI * 2); ctx.fill(); }
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
    <meshStandardMaterial map={blueprint ? blueprintTexture : groundTexture} color="#ffffff" roughness={0.96} />
  </mesh>;
}

function roadGeometry(x: number, z: number, width: number, length: number, rotation: number, lift = 0) {
  const vertices: number[] = [], indices: number[] = [], steps = Math.max(2, Math.ceil(length / 2)), base = SURFACE_Y(x, z);
  for (let i = 0; i <= steps; i++) {
    const localZ = (i / steps - 0.5) * length;
    for (const side of [-1, 1]) {
      const localX = side * width / 2;
      const worldX = x + localX * Math.cos(rotation) + localZ * Math.sin(rotation);
      const worldZ = z - localX * Math.sin(rotation) + localZ * Math.cos(rotation);
      vertices.push(localX, SURFACE_Y(worldX, worldZ) - base + lift, localZ);
    }
    if (i < steps) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function Road({ x, z, width, length, rotation = 0, primary = false, blueprint = false }: { x: number; z: number; width: number; length: number; rotation?: number; primary?: boolean; blueprint?: boolean }) {
  const shoulder = useMemo(() => roadGeometry(x, z, width + 0.48, length, rotation), [x, z, width, length, rotation]);
  const asphalt = useMemo(() => roadGeometry(x, z, width, length, rotation, 0.035), [x, z, width, length, rotation]);
  return <group position={[x, SURFACE_Y(x, z) + 0.055, z]} rotation-y={rotation}>
    <mesh geometry={shoulder} receiveShadow><meshStandardMaterial color={blueprint ? "#1b3035" : "#77796e"} roughness={1} /></mesh>
    <mesh geometry={asphalt} receiveShadow><meshStandardMaterial color={blueprint ? "#20343a" : primary ? "#5d605a" : "#666960"} roughness={0.88} /></mesh>
  </group>;
}

function Building({ x, z, w, d, h, variant, blueprint = false, facadeTexture }: { x: number; z: number; w: number; d: number; h: number; variant: number; blueprint?: boolean; facadeTexture: THREE.CanvasTexture }) {
  const color = ["#8f9188", "#92948c", "#989890", "#878c88", "#908b84"][variant % 5]!;
  const footprint = useMemo(() => {
    const shape = new THREE.Shape();
    const inset = variant % 3 === 0 ? 0.34 : variant % 3 === 1 ? 0.14 : 0;
    shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2 - inset, -d / 2); shape.lineTo(w / 2, -d / 2 + inset);
    shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2 + inset, d / 2); shape.lineTo(-w / 2, d / 2 - inset); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.055, bevelThickness: 0.045, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [d, h, variant, w]);
  const outline = useMemo(() => new THREE.EdgesGeometry(footprint, 24), [footprint]);
  return <group position={[x, SURFACE_Y(x, z), z]} rotation-y={variant * 0.29}>
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

function Tree({ position, scale = 1, variant = 0, blueprint = false }: { position: Vec3; scale?: number; variant?: number; blueprint?: boolean }) {
  const greens = ["#526b4d", "#647955", "#71815a", "#536f5b"];
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.72, 0]} castShadow><cylinderGeometry args={[0.06, 0.13, 1.42, 9]} /><meshStandardMaterial color={blueprint ? "#406c72" : "#665943"} roughness={1} /></mesh>
    <mesh position={[0, 1.58, 0]} scale={[0.78 + (variant % 3) * 0.06, 1.12 + (variant % 2) * 0.12, 0.74]} castShadow><sphereGeometry args={[0.88, 16, 12]} /><meshStandardMaterial color={blueprint ? "#3c6870" : greens[variant % greens.length]} roughness={0.98} /></mesh>
    <mesh position={[0.34, 1.63, -0.13]} scale={[0.57, 0.78, 0.63]} castShadow><sphereGeometry args={[0.68, 14, 10]} /><meshStandardMaterial color={blueprint ? "#416f75" : greens[(variant + 1) % greens.length]} roughness={0.98} /></mesh>
  </group>;
}

function distanceToSegment(point: Vec3, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((point[0] - a[0]) * dx + (point[2] - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(point[0] - (a[0] + dx * t), point[2] - (a[1] + dz * t));
}

function UrbanEnvironment({ positions, blueprint, storagePositions, depthRef, focused }: { positions: Layout; blueprint: boolean; storagePositions: Vec3[]; depthRef: DepthRef; focused: boolean }) {
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
    const buildings: { x: number; z: number; w: number; d: number; h: number; variant: number }[] = [];
    const trees: { p: Vec3; s: number }[] = [];
    const roads: { x: number; z: number; width: number; length: number; rotation: number; primary: boolean }[] = [];
    const parcels = [
      { x: -36, z: -33 }, { x: -12, z: -39 }, { x: 15, z: -39 }, { x: 38, z: -32 },
      { x: -42, z: -10 }, { x: 43, z: -10 }, { x: -41, z: 18 }, { x: 40, z: 18 },
      { x: -26, z: 37 }, { x: 4, z: 39 }, { x: 32, z: 36 },
    ];
    const roadPaths = [
      { points: [[-48, -29], [-35, -25], [-22, -28], [-8, -31], [8, -29], [25, -25], [43, -28], [51, -23]], width: 1.15, primary: true },
      { points: [[-49, 28], [-35, 23], [-21, 27], [-4, 32], [13, 30], [29, 25], [45, 22], [52, 16]], width: 1.0, primary: true },
      { points: [[-43, -24], [-39, -12], [-41, 1], [-37, 13], [-33, 23]], width: 0.62, primary: false },
      { points: [[40, -24], [37, -12], [39, 1], [43, 12], [48, 20]], width: 0.58, primary: false },
      { points: [[-48, -3], [-39, -1], [-33, 4], [-30, 13]], width: 0.48, primary: false },
      { points: [[31, 13], [34, 4], [31, -5], [30, -17]], width: 0.48, primary: false },
    ];
    roadPaths.forEach(({ points, width, primary }) => {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i] as [number, number], b = points[i + 1] as [number, number];
        if (Object.values(positions).some((p) => distanceToSegment(p, a, b) < 6.2)) continue;
        const dx = b[0] - a[0], dz = b[1] - a[1];
        roads.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, width, length: Math.hypot(dx, dz), rotation: Math.atan2(dx, dz), primary });
      }
    });
    let seed = 8741; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 72; i++) {
      const parcel = parcels[i % parcels.length]!;
      const x = parcel.x + (random() - 0.5) * 12, z = parcel.z + (random() - 0.5) * 9;
      if (Object.values(positions).some((p) => Math.hypot(x - p[0], z - p[2]) < 7.8)) continue;
      if (storagePositions.some((p) => Math.hypot(x - p[0], z - p[2]) < 11.4)) continue;
      if (roads.some((road) => distanceToSegment([x, 0, z], [road.x - Math.sin(road.rotation) * road.length / 2, road.z - Math.cos(road.rotation) * road.length / 2], [road.x + Math.sin(road.rotation) * road.length / 2, road.z + Math.cos(road.rotation) * road.length / 2]) < road.width / 2 + 2.2)) continue;
      if (i % 5 === 0) { trees.push({ p: [x, SURFACE_Y(x, z), z], s: 0.74 + random() * 0.45 }); continue; }
      const variant = Math.floor(random() * 5);
      const edge = Math.max(Math.abs(x), Math.abs(z));
      buildings.push({ x, z, w: 2.7 + random() * 2.1, d: 2.5 + random() * 1.8, h: 0.9 + random() * 1.35 + (edge > 34 && i % 13 === 0 ? 1.5 : 0), variant });
    }
    return { buildings, trees, roads };
  }, [positions, storagePositions]);
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
      {city.roads.map((road, i) => <Road key={`road-${i}`} {...road} blueprint={blueprint} />)}
      {city.buildings.map((building, i) => <Building key={i} {...building} blueprint={blueprint} facadeTexture={facadeTexture} />)}
      {city.trees.map((tree, i) => <Tree key={`infill-${i}`} position={tree.p} scale={tree.s} variant={i} blueprint={blueprint} />)}
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
  const waterPoints = boundary.map(([x, z]) => new THREE.Vector3(x * 0.77, 0, z * 0.77));
  return {
    outerBank: makeBank(1.3, 0.03, 1.08, -0.13), innerBank: makeBank(1.08, -0.13, 0.91, -0.47), shallowShelf: makeBank(0.91, -0.47, 0.77, -0.32),
    water: new THREE.ShapeGeometry(makeShape(0.77), 1),
    outline: new THREE.BufferGeometry().setFromPoints([...waterPoints, waterPoints[0]!]),
  };
}

type BasinPort = { x: number; z: number; direction: "inlet" | "outlet" };
function Lake({ blueprint, selected, dimmed, seed, ports }: { blueprint: boolean; selected: boolean; dimmed: boolean; seed: number; ports: BasinPort[] }) {
  const geometries = useMemo(() => lakeGeometries(seed), [seed]);
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (water.current) water.current.position.y = -0.27 + Math.sin(clock.elapsedTime * 0.36 + seed) * 0.012; });
  return <group>
    <mesh geometry={geometries.outerBank} receiveShadow><meshStandardMaterial color={blueprint ? "#294047" : "#716b58"} side={THREE.DoubleSide} roughness={0.96} transparent={dimmed} opacity={dimmed ? 0.58 : 1} /></mesh>
    <mesh geometry={geometries.innerBank} receiveShadow><meshStandardMaterial color={blueprint ? "#31525a" : "#827d66"} side={THREE.DoubleSide} roughness={0.92} transparent={dimmed} opacity={dimmed ? 0.6 : 1} /></mesh>
    <mesh geometry={geometries.shallowShelf} receiveShadow><meshStandardMaterial color={blueprint ? "#185467" : "#879477"} side={THREE.DoubleSide} roughness={0.75} transparent={dimmed} opacity={dimmed ? 0.62 : 1} /></mesh>
    <mesh ref={water} geometry={geometries.water} rotation-x={-Math.PI / 2}><meshPhysicalMaterial color={blueprint ? "#4eb8c9" : "#167fa3"} emissive={blueprint ? "#000000" : "#000000"} emissiveIntensity={0} roughness={0.28} metalness={0.04} clearcoat={0.75} clearcoatRoughness={0.18} transparent={dimmed} opacity={dimmed ? 0.7 : 1} /></mesh>
    <lineLoop geometry={geometries.outline} position={[0, -0.25, 0]}><lineBasicMaterial color={blueprint ? "#59dff5" : selected ? "#d2ad6f" : "#82917a"} transparent opacity={blueprint ? 0.9 : 0.46} /></lineLoop>
    {blueprint && <lineLoop geometry={geometries.outline} position={[0, -0.24, 0]} scale={0.91}><lineBasicMaterial color="#26c8e8" transparent opacity={0.58} /></lineLoop>}
    {!blueprint && <>
      {Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + seed, radius = 1.08 + ((i * 3) % 5) * 0.045; const x = Math.cos(a) * BASIN_RX * radius, z = Math.sin(a) * BASIN_RZ * radius; return <Tree key={i} position={[x, 0.02, z]} scale={0.48 + (i % 4) * 0.12} variant={i + seed} />; })}
    </>}
    {ports.map((port, i) => <group key={`${port.direction}-${i}`} position={[port.x * BASIN_RX * 1.02, -0.04, port.z * BASIN_RZ * 1.02]} rotation-y={Math.atan2(port.x, port.z)}>
      <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.74, 0.3, 0.46]} /><meshStandardMaterial color={blueprint ? "#7caab2" : "#878b83"} roughness={0.78} wireframe={blueprint} /></mesh>
      <mesh position={[0, 0.07, 0.24]}><boxGeometry args={[0.36, 0.16, 0.025]} /><meshStandardMaterial color={blueprint ? "#05bde7" : "#23393a"} emissive={blueprint ? "#058aaa" : "#0b4454"} emissiveIntensity={blueprint ? 0.12 : 0.02} /></mesh>
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
    {!blueprint && [[-2, -0.85], [1.75, -1.25], [-1.95, 0.95], [2.0, 0.75], [0.1, 1.75]].map(([x, z], i) => <Tree key={i} position={[x!, 0.02, z!]} scale={0.4 + (i % 2) * 0.12} variant={i + 1} />)}
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

function Structure({ node, position, selected, dimmed, blueprint, onSelect, sensors, edges, positions, sample = false }: { node: NetworkNode; position: Vec3; selected: boolean; dimmed: boolean; blueprint: boolean; onSelect: (id: string) => void; sensors: CanonicalResponse["sensors"]; edges: CanonicalResponse["network"]["edges"]; positions: Layout; sample?: boolean }) {
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
  const selectionRadius = kind === "storage" ? 7.2 : kind === "recharge" ? 3.65 : kind === "junction" ? 2.15 : 2;
  return <group position={[position[0], SURFACE_Y(position[0], position[2]), position[2]]} scale={dimmed ? scale * 0.96 : scale} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
    {kind === "storage" ? <Lake blueprint={blueprint} selected={active} dimmed={dimmed} seed={seed} ports={ports} />
      : kind === "recharge" ? <Recharge blueprint={blueprint} seed={seed} dimmed={dimmed} />
      : kind === "junction" ? <Junction blueprint={blueprint} dimmed={dimmed} />
      : <group><mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.72, 0.9, 1.1, 12]} /><meshStandardMaterial color={blueprint ? "#6bdff6" : "#a6ada3"} wireframe={blueprint} /></mesh><mesh position={[0, 1.13, 0]}><torusGeometry args={[0.9, 0.08, 8, 20]} /><meshStandardMaterial color={blueprint ? "#5de7ff" : "#7d8878"} /></mesh></group>}
    {sensor && <SensorMarker status={sensor.status} label={sensor.id} />}
    {active && <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[selectionRadius, selectionRadius + 0.1, 48]} /><meshBasicMaterial color="#d3b477" toneMapped={false} /></mesh>}
    <Html position={[0, kind === "storage" ? 0.6 : 2.05, 0]} center distanceFactor={34} style={{ pointerEvents: "none" }}><div className={`scene-label ${active ? "active" : ""} ${blueprint ? "blueprint-label" : ""} ${sample ? "sample-label" : ""}`}><strong>{sample ? `SAMPLE · ${node.id}` : node.id}</strong><span>{sample ? "NON-CANONICAL" : kind}</span></div></Html>
  </group>;
}

function Conduit({ edge, positions, selected, connected, dimmed, blueprint, onSelect, simulationActive }: { edge: CanonicalResponse["network"]["edges"][number]; positions: Layout; selected: boolean; connected: boolean; dimmed: boolean; blueprint: boolean; onSelect: (id: string) => void; simulationActive: boolean }) {
  const curve = useMemo(() => pipeCurve(edge, positions), [edge, positions]);
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
  return <group ref={ref} visible={!dimmed}>{Array.from({ length: 12 }, (_, i) => <mesh key={i} scale={0.09}><sphereGeometry args={[1, 7, 6]} /><meshBasicMaterial color="#5ce0ff" /></mesh>)}</group>;
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
  const sampleNodes: NetworkNode[] = sampleIds.map((id, i) => ({ id, type: i === 1 ? "recharge" : "storage", label: `${id} visualization sample`, sensor_ids: [], attributes: {} }));
  const allPositions = useMemo(() => ({ ...positions, ...samplePositions(positions, sampleIds) }), [positions, sampleIds.join("|")]);
  return <group>
    <TerrainSurface blueprint={blueprint} basins={basins} depthRef={depthRef} />
    <UrbanEnvironment positions={positions} blueprint={blueprint} storagePositions={basins} depthRef={depthRef} focused={Boolean(selected)} />
    {data.network.edges.map((edge) => {
      const isConnected = connectedIds.has(edge.id);
      const dimmed = emphasis && !isConnected && selected !== edge.id && !activeRoute.has(edge.id);
      if (!allPositions[edge.from] || !allPositions[edge.to]) return null;
      return <Conduit key={edge.id} edge={edge} positions={allPositions} selected={selected === edge.id} connected={isConnected || activeRoute.has(edge.id)} dimmed={dimmed} blueprint={blueprint} onSelect={onSelect} simulationActive={simulationActive} />;
    })}
    {data.network.nodes.map((node) => {
      const nodeSensors = data.sensors.filter((sensor) => sensor.node_id === node.id);
      const dimmed = emphasis && selectedNodeId !== node.id && !data.network.edges.some((edge) => connectedIds.has(edge.id) && (edge.from === node.id || edge.to === node.id));
      return <Structure key={node.id} node={node} position={allPositions[node.id]!} selected={selected === node.id || nodeSensors.some((sensor) => sensor.id === selected)} dimmed={dimmed} blueprint={blueprint} onSelect={onSelect} sensors={data.sensors} edges={data.network.edges} positions={allPositions} />;
    })}
    {samplesVisible && sampleNodes.map((node) => <Structure key={node.id} node={node} position={allPositions[node.id]!} selected={selected === node.id} dimmed={false} blueprint={blueprint} onSelect={onSelect} sensors={[]} edges={[]} positions={allPositions} sample />)}
    {healthMode && data.risks.map((risk) => { const target = allPositions[risk.target_id] ?? allPositions[data.sensors.find((sensor) => sensor.id === risk.target_id)?.node_id ?? ""]; return target ? <mesh key={risk.id} position={[target[0], SURFACE_Y(target[0], target[2]) + 0.18, target[2]]} rotation-x={-Math.PI / 2}><ringGeometry args={[4, 4.14, 48]} /><meshBasicMaterial color={risk.severity === "critical" || risk.severity === "high" ? "#c86254" : "#c7a55f"} /></mesh> : null; })}
    {rainActive && <Rain />}{floodActive && !blueprint && <mesh rotation-x={-Math.PI / 2} position={[26, SURFACE_Y(26, 20) + 0.08, 20]}><circleGeometry args={[2.2, 28]} /><meshStandardMaterial color="#21bce1" transparent opacity={0.55} /></mesh>}
  </group>;
}

export function EngineeringScene({ data, view, selected, onSelect, healthMode, simulationActive, rainActive, floodActive, samplesVisible = false }: { data: CanonicalResponse; view: EngineeringView; selected: string | null; onSelect: (id: string | null) => void; healthMode: boolean; simulationActive: boolean; rainActive: boolean; floodActive: boolean; samplesVisible?: boolean }) {
  const controlsRef = useRef<any>(null);
  const depthRef = useRef(0);
  const positions = useMemo(() => layoutCanonicalNetwork(data.network.nodes, data.network.edges), [data.network.nodes, data.network.edges]);
  const focusPositions = useMemo(() => ({ ...positions, ...samplePositions(positions) }), [positions]);
  const frame = useMemo(() => networkFrame(positions), [positions]);
  return <div className="engineering-scene"><Canvas shadows dpr={[1, 1.7]} camera={{ position: frame.position.toArray(), fov: 40 }} onPointerMissed={() => onSelect(null)} gl={{ antialias: true }}>
    <color attach="background" args={[view === "blueprint" ? "#142126" : "#acb8b1"]} />
    <fog attach="fog" args={[view === "blueprint" ? "#142126" : "#acb8b1", 52, 118]} />
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
