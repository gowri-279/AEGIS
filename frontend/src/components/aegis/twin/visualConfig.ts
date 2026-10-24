/** Presentation-only values — not engineering survey data or pipe capacity. */

export const SAMPLE_NODE_IDS = ["V5", "V6", "V7", "V8"] as const;

/** Stormwater network presentation scale (visual twin only). */
export const NETWORK = {
  terrainFootprint: 72,
  conduit: {
    outerRadius: 0.2,
    outerRadiusSelected: 0.26,
    innerRadius: 0.065,
    arrowRadius: 0.22,
    arrowHeight: 0.52,
    segments: 64,
    radialSegments: 14,
    blueprintDepth: 1.25,
    buryDepth: { junction: 1.2, storage: 1.85, recharge: 1.4, default: 1.55 },
    innerEmissiveTerrain: 0.04,
    innerEmissiveBlueprint: 0.1,
  },
  junction: {
    apronRadius: 1.55,
    chamberRadius: 0.98,
    chamberDepth: 0.62,
    collarRadius: 1.02,
    collarHeight: 0.12,
    grateRadius: 0.72,
    grateHeight: 0.035,
    boltCount: 8,
    transitionDepth: 0.45,
  },
  storage: {
    /** Two basin silhouettes so multiple storage nodes read distinctly (variant cycles by sorted id). */
    variants: [
      { radiusX: 5, radiusZ: 3.7, bankTiers: 3, waterScale: 0.77 },
      { radiusX: 6.1, radiusZ: 4.35, bankTiers: 4, waterScale: 0.74 },
    ],
    waterRestY: -0.27,
    waterRipple: 0.012,
    portStructureWidth: 0.74,
    outlineLift: 0.04,
  },
  recharge: {
    basinRadiusX: 2.75,
    basinRadiusZ: 2.1,
    terraceRadii: [2.12, 1.54] as const,
    shaftRadius: 0.34,
    grateRadius: 0.28,
    infiltrationRingCount: 2,
  },
  selectionRing: {
    junction: 1.45,
    storage: 6.1,
    recharge: 3.05,
    default: 2,
    width: 0.1,
  },
  transition: {
    collarRadius: 0.42,
    collarDepth: 0.28,
    surfaceLift: 0.02,
  },
  labelHeight: { storage: 0.85, default: 2.05 },
} as const;

/** @deprecated greybox alias — prefer NETWORK */
export const GREYBOX = {
  terrainSize: NETWORK.terrainFootprint,
  pipeRadius: NETWORK.conduit.outerRadius,
  pipeRadiusSelected: NETWORK.conduit.outerRadiusSelected,
  blueprintPipeDepth: NETWORK.conduit.blueprintDepth,
  buryDepth: NETWORK.conduit.buryDepth,
} as const;
