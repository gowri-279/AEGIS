import { useMemo } from "react";
import * as THREE from "three";
import { NETWORK } from "./visualConfig";

type Props = {
  center: THREE.Vector3;
  span: number;
  blueprint: boolean;
};

export function NetworkPresentationLighting({ center, span, blueprint }: Props) {
  const cfg = NETWORK.lighting;
  const shadowExtent = useMemo(() => Math.max(span * cfg.shadowExtentScale, cfg.shadowMinExtent), [cfg.shadowExtentScale, cfg.shadowMinExtent, span]);
  const keyPosition = useMemo(() => {
    const dir = new THREE.Vector3(cfg.keyDirection[0], cfg.keyDirection[1], cfg.keyDirection[2]).normalize();
    return center.clone().add(dir.multiplyScalar(span * cfg.keyDistanceScale + cfg.keyDistanceMin));
  }, [center, cfg.keyDirection, cfg.keyDistanceMin, cfg.keyDistanceScale, span]);

  const fillPosition = center.clone().add(new THREE.Vector3(-span * 0.55, span * 0.22, -span * 0.42));

  return (
    <>
      <hemisphereLight
        args={[
          blueprint ? cfg.blueprintSky : cfg.terrainSky,
          blueprint ? cfg.blueprintGround : cfg.terrainGround,
          blueprint ? cfg.blueprintHemisphere : cfg.terrainHemisphere,
        ]}
      />
      <ambientLight intensity={blueprint ? cfg.blueprintAmbient : cfg.terrainAmbient} />
      <directionalLight
        castShadow={!blueprint}
        position={keyPosition.toArray()}
        intensity={blueprint ? cfg.blueprintKey : cfg.terrainKey}
        color={blueprint ? cfg.blueprintKeyColor : cfg.terrainKeyColor}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={shadowExtent * 4}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-bias={cfg.shadowBias}
        shadow-normalBias={cfg.shadowNormalBias}
      />
      <directionalLight
        position={fillPosition.toArray()}
        intensity={blueprint ? cfg.blueprintFill : cfg.terrainFill}
        color={cfg.fillColor}
      />
    </>
  );
}
