import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";
import type { Vec3 } from "@/data/networkLayout";
import { twinPalette } from "./materials";
import type { EngineeringView } from "./types";
import { NETWORK } from "./visualConfig";

type Props = {
  view: EngineeringView;
  onPointerMissed: () => void;
  initialCamera: Vec3;
  children: ReactNode;
};

export function SceneShell({ view, onPointerMissed, initialCamera, children }: Props) {
  const blueprint = view === "blueprint";
  const cam = NETWORK.camera;
  const fog = NETWORK.presentation;

  return (
    <div className="engineering-scene">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{
          position: initialCamera,
          fov: cam.fov,
          near: cam.near,
          far: cam.far,
        }}
        onPointerMissed={onPointerMissed}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[blueprint ? twinPalette.background.blueprint : twinPalette.background.terrain]} />
        <fog
          attach="fog"
          args={[
            blueprint ? twinPalette.fog.blueprint : twinPalette.fog.terrain,
            blueprint ? fog.blueprintFogNear : fog.terrainFogNear,
            blueprint ? fog.blueprintFogFar : fog.terrainFogFar,
          ]}
        />
        {children}
      </Canvas>
    </div>
  );
}
