import { fixtures } from "./mockCanonicalResponse";
import type { RiskFinding } from "./types";

// Health-only illustrative finding; never changes scenario constraints or Bob's response.
const overflowRisk: RiskFinding = {
  id: "RK-L2-OVERFLOW-DEMO",
  target_id: "L2",
  category: "overflow",
  title: "Overflow Risk",
  severity: "high",
  observed_value: null,
  threshold: null,
  confidence: null,
  evidence: ["Synthetic Health Scan demonstration; no measured overflow or threshold supplied."],
  potential_impact:
    "Illustrative potential overflow condition, not a confirmed failure or simulation result.",
};

export function mockHealthFindings(fixtureId: string): RiskFinding[] {
  const response = Object.values(fixtures).find((fixture) => fixture.fixture_id === fixtureId);
  if (!response) return [];
  return fixtureId === "critical_stale" ? [...response.risks] : [...response.risks, overflowRisk];
}
