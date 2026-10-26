import { useSyncExternalStore } from "react";
import { DEFAULT_REQUIREMENTS, type DesignRequirements } from "@/data/buildRequirements";
import type { ConnectionChoice } from "@/data/buildSetupDemo";
import type { CandidateId } from "@/data/buildWorkspace";

/** Session-only Build flow state shared across Build steps (replaceable by API-backed state). */
export interface BuildFlowState {
  terrainId: string | null;
  connection: ConnectionChoice;
  points: string[];
  /** Redesign scope: "region" or a component/pipe id. */
  redesignScope: string | null;
  requirements: DesignRequirements;
  /** Candidate whose committed draft is the active design per Build path. */
  activeCandidate: Partial<Record<"new" | "redesign", CandidateId>>;
}

let state: BuildFlowState = { terrainId: null, connection: null, points: [], redesignScope: null, requirements: DEFAULT_REQUIREMENTS, activeCandidate: {} };
const listeners = new Set<() => void>();

export function setBuildFlow(patch: Partial<BuildFlowState> | ((s: BuildFlowState) => Partial<BuildFlowState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
export const getBuildFlow = () => state;
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useBuildFlow(): BuildFlowState {
  return useSyncExternalStore(subscribe, getBuildFlow, getBuildFlow);
}
