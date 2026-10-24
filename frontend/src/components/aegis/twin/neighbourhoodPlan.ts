/**
 * Future: deterministic street/block/park layout for UrbanContext.
 * Phase 1 scaffold — no generated geometry yet.
 */
export type NeighbourhoodPlan = {
  ready: boolean;
};

export function buildNeighbourhoodPlan(): NeighbourhoodPlan {
  return { ready: false };
}
