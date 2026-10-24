import type { NodeLayout } from "./types";
import { buildNeighbourhoodPlan } from "./neighbourhoodPlan";

type Props = {
  positions: NodeLayout;
  blueprint: boolean;
};

/** Neighbourhood geometry lands here in a later phase — keep empty so the network stays dominant. */
export function UrbanContext(_props: Props) {
  const plan = buildNeighbourhoodPlan();
  if (!plan.ready) return null;
  return null;
}
