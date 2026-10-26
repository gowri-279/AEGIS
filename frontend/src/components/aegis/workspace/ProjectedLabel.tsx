import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

// One DOM root per label element, ref-counted so StrictMode's double effect
// (mount → cleanup → mount) reuses the same root instead of racing a deferred
// unmount against a fresh root on the same container.
const labelRoots = new WeakMap<HTMLDivElement, { root: Root; users: number }>();

export function ProjectedLabel({ position, children, interactive = true, above = false }: { position: [number, number, number]; children: ReactNode; interactive?: boolean; above?: boolean }) {
  const { gl, size } = useThree();
  const [element] = useState(() => document.createElement("div"));
  const root = useRef<Root | null>(null);
  const vector = useRef(new Vector3());
  useEffect(() => {
    element.className = interactive ? "model-projected-label" : "model-projected-label is-passive";
    gl.domElement.parentElement?.appendChild(element);
    let state = labelRoots.get(element);
    if (!state) { state = { root: createRoot(element), users: 0 }; labelRoots.set(element, state); }
    state.users++;
    root.current = state.root;
    return () => {
      root.current = null;
      state.users--;
      const current = state;
      // Defer cleanup until the R3F commit completes (React 19-safe), and only
      // unmount when no newer effect run reclaimed the element.
      queueMicrotask(() => {
        if (current.users === 0) {
          labelRoots.delete(element);
          try { current.root.unmount(); } catch { /* container already detached */ }
          element.remove();
        }
      });
    };
  }, [gl, element, interactive]);
  useEffect(() => { root.current?.render(children); }, [children]);
  useFrame(({ camera }) => {
    vector.current.set(...position).project(camera);
    const x = (vector.current.x + 1) * size.width / 2;
    const y = (-vector.current.y + 1) * size.height / 2;
    element.style.transform = above ? `translate(${x}px, ${y}px) translate(-50%, -100%) translateY(-20px)` : `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    element.style.visibility = Math.abs(vector.current.z) <= 1 ? "visible" : "hidden";
  });
  return null;
}
