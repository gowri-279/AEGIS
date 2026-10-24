import type * as THREE from "three";

export type ControlsRef = {
  current: { target: THREE.Vector3; update: () => void } | null;
};

export type DepthRef = { current: number };
