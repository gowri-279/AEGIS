import * as THREE from "three";
import { NETWORK } from "../../visualConfig";

type StorageVariant = (typeof NETWORK.storage.variants)[number];

export function buildStorageBasinGeometry(seed: number, variant: StorageVariant) {
  const { radiusX: BASIN_RX, radiusZ: BASIN_RZ } = variant;
  const points = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const wave =
      1 +
      0.1 * Math.sin(angle * 3 + seed) +
      0.055 * Math.cos(angle * 5 + seed * 2) +
      0.025 * Math.sin(angle * 7 + seed * 0.4);
    return new THREE.Vector3(Math.cos(angle) * BASIN_RX * wave, 0, Math.sin(angle) * BASIN_RZ * wave);
  });
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
  const boundary = curve.getPoints(96).map((point) => [point.x, point.z] as [number, number]);

  const makeShape = (scale: number) => {
    const shape = new THREE.Shape();
    boundary.forEach(([x, z], index) => {
      const p: [number, number] = [x * scale, z * scale];
      if (!index) shape.moveTo(...p);
      else shape.lineTo(...p);
    });
    shape.closePath();
    return shape;
  };

  const makeBank = (outerScale: number, outerY: number, innerScale: number, innerY: number) => {
    const vertices: number[] = [];
    const indices: number[] = [];
    boundary.forEach(([x, z], index) => {
      vertices.push(x * outerScale, outerY, z * outerScale, x * innerScale, innerY, z * innerScale);
      const next = (index + 1) % boundary.length;
      const a = index * 2;
      const b = next * 2;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  const waterScale = variant.waterScale;
  const waterPoints = boundary.map(([x, z]) => new THREE.Vector3(x * waterScale, 0, z * waterScale));

  return {
    variant,
    outerBank: makeBank(1.3, 0.03, 1.08, -0.13),
    innerBank: makeBank(1.08, -0.13, 0.91, -0.47),
    shallowShelf: makeBank(0.91, -0.47, waterScale + 0.14, -0.32),
    water: new THREE.ShapeGeometry(makeShape(waterScale), 1),
    outline: new THREE.BufferGeometry().setFromPoints([...waterPoints, waterPoints[0]!]),
    basinRadii: { rx: BASIN_RX, rz: BASIN_RZ },
  };
}
