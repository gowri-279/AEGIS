import { describe, expect, it } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { mockHealthFindings } from "@/data/mockHealthFindings";
import { nodeRisks, severityTone } from "@/lib/aegis";
import { problemName } from "@/components/aegis/workspace/HealthProblemMarkers";

describe("Health Step 1 supplied findings", () => {
  it("supplies the three independent problem severities on real nodes", () => {
    const risks = mockHealthFindings("standard");
    expect(risks.map((risk) => [risk.target_id, risk.severity])).toEqual([["J3", "moderate"], ["L1", "low"], ["L2", "high"]]);
    for (const risk of risks) expect(fixtures.standard.network.nodes.some((node) => node.id === risk.target_id)).toBe(true);
  });
  it("uses cool information colour for low severity", () => expect(severityTone.low).toBe("info"));
  it("uses amber warning colour for moderate severity", () => expect(severityTone.moderate).toBe("warn"));
  it("uses red critical colour for high and critical severity", () => {
    expect(severityTone.high).toBe("crit");
    expect(severityTone.critical).toBe("crit");
  });
  it("retains existing observations, evidence and unknown overflow measurements without changing adjacent responses", () => {
    const before = JSON.stringify(fixtures);
    const risks = mockHealthFindings("standard");
    expect(risks.slice(0, 2)).toEqual(fixtures.standard.risks);
    const overflow = risks.find((risk) => risk.target_id === "L2");
    expect(overflow).toMatchObject({ observed_value: null, threshold: null, confidence: null });
    expect(JSON.stringify(fixtures)).toBe(before);
    expect(fixtures.standard.candidates.find((candidate) => candidate.id === "C-L2")?.feasible).toBe(true);
  });
  it("associates sensor-targeted findings with their actual node, not fake terrain objects", () => {
    const node = fixtures.critical_stale.network.nodes.find((node) => node.id === "J3");
    if (!node) throw new Error("Expected supplied J3 node");
    expect(nodeRisks(fixtures.critical_stale, node).map((risk) => risk.target_id)).toEqual(["WL-J3"]);
    expect(mockHealthFindings("critical_stale")).toEqual(fixtures.critical_stale.risks);
  });
  it("formats supplied problem names without hardcoding component IDs", () => {
    const risk = fixtures.standard.risks[0];
    if (!risk) throw new Error("Expected supplied depth finding");
    expect(problemName({ ...risk, title: "Elevated Depth at X.7" }, "X.7")).toBe("Elevated Depth");
  });
});