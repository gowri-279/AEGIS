import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";
import type { EngineeringView } from "./types";
import { twinPalette } from "./materials";

type Props = {
  view: EngineeringView;
  onPointerMissed: () => void;
  children: ReactNode;
};

export function SceneShell({ view, onPointerMissed, children }: Props) {
  const blueprint = view === "blueprint";
  return (
    <div className="engineering-scene">
      <Canvas
        shadows
        dpr={[1, 1.7]}
        camera={{ position: [9.5, 22, 34], fov: 42 }}
        onPointerMissed={onPointerMissed}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[blueprint ? twinPalette.background.blueprint : twinPalette.background.terrain]} />
        <fog attach="fog" args={[blueprint ? twinPalette.fog.blueprint : twinPalette.fog.terrain, 78, 150]} />
        <hemisphereLight
          args={[
            blueprint ? "#7ebac4" : "#eff3e7",
            blueprint ? "#18272b" : "#625b4e",
            blueprint ? 0.8 : 1.15,
          ]}
        />
        <ambientLight intensity={blueprint ? 0.7 : 0.55} />
        <directionalLight
          castShadow
          position={[24, 34, 15]}
          intensity={blueprint ? 0.75 : 2.0}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={110}
          shadow-camera-left={-55}
          shadow-camera-right={55}
          shadow-camera-top={55}
          shadow-camera-bottom={-55}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-24, 15, -20]} intensity={blueprint ? 0.45 : 0.72} color="#d9e4d6" />
        {children}
      </Canvas>
    </div>
  );
}
