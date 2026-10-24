import type { CanonicalResponse } from "@/data/types";

/** Matches existing EngineeringApp terrain / blueprint toggle. */
export type EngineeringView = "terrain" | "blueprint";

export type TwinSceneProps = {
  data: CanonicalResponse;
  view: EngineeringView;
  selected: string | null;
  onSelect: (id: string | null) => void;
  healthMode: boolean;
  simulationActive: boolean;
  rainActive: boolean;
  floodActive: boolean;
  samplesVisible?: boolean;
};

export type NodeLayout = Record<string, [number, number, number]>;
