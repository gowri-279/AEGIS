// Service boundary for the future FastAPI backend.
// Currently returns mock canonical fixtures. Swap internals for fetch() later;
// keep signatures stable. No endpoints are defined yet.
import { fixtures, type FixtureId } from "@/data/mockCanonicalResponse";
import type { CanonicalResponse } from "@/data/types";

export interface ScenarioRequest {
  fixture: FixtureId;
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
  return fixtures[req.fixture];
}
