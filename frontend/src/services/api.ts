// Service boundary for the future FastAPI backend.
// Currently returns mock canonical fixtures. Swap internals for fetch() later;
// keep signatures stable. No endpoints are defined yet.
import { fixtures, type FixtureId } from "@/data/mockCanonicalResponse";
import type { CanonicalResponse } from "@/data/types";
import { mockHealthFindings } from "@/data/mockHealthFindings";
import { mockHealthBobReply, type HealthBobRequest, type HealthBobResponse } from "@/data/healthBob";
import { mockBobScenario, type BobScenarioId } from "@/data/bobInterventions";
import { mockSimBobReply, type SimBobReply } from "@/data/simBob";
import { landingDemoModel } from "@/data/landingDemoNetwork";
export { resolvedSimulationResponse } from "@/data/simulationResolution";
export { getNetworkSession, subscribeNetworkSession, selectSessionNetwork, getSessionDraft as getBuildDraft, saveSessionDraft as saveBuildDraft, finalizeSessionNetwork as addFinalizedBuildNetwork } from "@/data/networkSession";
export type { BuildDraft, SessionNetwork } from "@/data/networkSession";

/** Separate local landing model; never reads Monitor fixtures or backend state. */
export function getLandingDemoModel() {
  return landingDemoModel;
}

export interface ScenarioRequest {
  fixture: FixtureId;
  scenarioOptionId?: string;
  diverted_volume_m3?: number;
  duration_s?: number;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getCanonicalResponse(fixture: FixtureId = "standard"): Promise<CanonicalResponse> {
  await delay(150);
  return fixtures[fixture];
}

export async function runScenario(req: ScenarioRequest): Promise<CanonicalResponse> {
  await delay(1200);
  const response = fixtures[req.fixture];
  return req.scenarioOptionId ? { ...response, simulation: { ...response.simulation, scenario_option_id: req.scenarioOptionId } } : response;
}

/** Separate mock scan output preserves the canonical scenario/Bob response. */
export async function getHealthFindings(fixtureId: string) {
  return mockHealthFindings(fixtureId);
}

/** Replaceable local provider seam. No network calls or keys in the demo. */
export async function getHealthBobReply(request: HealthBobRequest): Promise<HealthBobResponse> {
  return mockHealthBobReply(request);
}

/** Authored demonstration outcomes behind the same replaceable service boundary. */
export async function runBobScenario(context: HealthBobRequest["context"], scenarioId: BobScenarioId) {
  return mockBobScenario(context, scenarioId);
}

/** Simulate-mode Bob: deterministic mock assistant over supplied scenario data. */
export async function getSimBobReply(question: string, data: CanonicalResponse): Promise<SimBobReply> {
  await delay(200);
  return mockSimBobReply(question, data);
}
