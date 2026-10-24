import type { NetworkNode } from "@/data/types";
import type { CatchmentModel } from "./catchment/catchmentModel";
import { buildUrbanLayout, type UrbanLayout } from "./urban/urbanLayout";
import type { NodeLayout } from "./types";

export type NeighbourhoodPlan = UrbanLayout;

export function buildNeighbourhoodPlan(
  model: CatchmentModel,
  positions: NodeLayout,
  nodes: NetworkNode[],
): NeighbourhoodPlan {
  const seed = nodes
    .map((node) => node.id)
    .sort()
    .join("")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return buildUrbanLayout(model, positions, seed);
}
