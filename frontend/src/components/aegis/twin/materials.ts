/** Restrained engineering-twin palette (presentation only). */

export const twinPalette = {
  terrain: { terrain: "#b8b2a6", blueprint: "#1a282c" },
  urban: { fill: "#8a8780", blueprint: "#24363a" },
  network: {
    junction: "#8a8d88",
    storage: "#6a8a94",
    recharge: "#7a8578",
    pipe: "#5f6a66",
    pipeBlueprint: "#4a7278",
    pipeSelected: "#c6a96d",
    pipeConnected: "#8a9994",
  },
  background: { terrain: "#b5b0a4", blueprint: "#142126" },
  fog: { terrain: "#b5b0a4", blueprint: "#142126" },
} as const;
