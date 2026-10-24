/** Presentation-only values — not engineering survey data or pipe capacity. */

export const SAMPLE_NODE_IDS = ["V5", "V6", "V7", "V8"] as const;

export const GREYBOX = {
  terrainSize: 72,
  pipeRadius: 0.22,
  pipeRadiusSelected: 0.28,
  blueprintPipeDepth: 1.25,
  buryDepth: { junction: 1.2, storage: 1.85, recharge: 1.4, default: 1.55 },
} as const;
