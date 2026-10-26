// Mock Bob: narrates canonical data. Bob explains; it never ranks or computes physics.
import type { CanonicalResponse } from "./types";

export interface BobMessage {
  role: "bob" | "user";
  text: string;
}

const fmt = (n: number | null | undefined, d = 2) => (n == null ? "unavailable" : n.toFixed(d));

export function bobInsight(data: CanonicalResponse, context: string | null): string[] {
  const s = data.sensors[0]!;
  const rec = data.recommendation;
  if (!context) {
    return [
      `Network ${data.network.network_id}: ${data.network.nodes.length} nodes, ${data.network.edges.length} conduits.`,
      `Critical sensor WL-J3 is ${s.status}${s.effective_value != null ? ` reading ${fmt(s.effective_value)} m` : ""}.`,
      `${data.risks.length} finding(s) need attention.`,
      `Recommendation status: ${rec.recommendation_status.replace(/_/g, " ")}${rec.selected_candidate_id ? ` → ${rec.selected_candidate_id}` : ""}.`,
    ];
  }
  const node = data.network.nodes.find((n) => n.id === context);
  const cand = data.candidates.find((c) => c.node_id === context || c.id === context);
  if (context === "J3" || context === "WL-J3") {
    return [
      `J3 is the controlling junction. Hard rule: depth < 0.80 m.`,
      s.effective_value != null
        ? `WL-J3 effective depth ${fmt(s.effective_value)} m (${s.status}, confidence ${fmt(s.confidence)}). Confidence is data usability, not hazard probability.`
        : `WL-J3 is ${s.status}; effective value unavailable, so the J3 constraint is not evaluated.`,
      `Downstream options: L1, R1, L2.`,
    ];
  }
  if (cand) {
    const fails = cand.constraints.filter((c) => c.status === "fail").map((c) => c.description);
    return [
      `${node?.label ?? context} hosts candidate ${cand.id} (${cand.kind}).`,
      cand.available_storage_m3 != null
        ? `Available storage: ${cand.available_storage_m3} m³.`
        : `Eligibility: ${cand.eligible ? "eligible" : "ineligible"}.`,
      cand.feasible
        ? `Backend marks it feasible (rank ${cand.rank}).`
        : cand.feasible === false
          ? `Infeasible: ${fails.join("; ") || "constraints not met"}.`
          : `Feasibility not determined.`,
    ];
  }
  if (context.startsWith("E-"))
    return [
      `Conduit ${context}. Pipe geometry shown is illustrative only — no canonical dimensions exist.`,
    ];
  return [`No additional context for ${context}.`];
}

export function bobReply(prompt: string, data: CanonicalResponse): string {
  const p = prompt.toLowerCase();
  const rec = data.recommendation;
  if (p.includes("simulat") || p.includes("divert"))
    return `Queued scenario ${data.simulation.scenario_id}: ${data.simulation.diverted_volume_m3} m³ over ${data.simulation.duration_s} s (≈${data.simulation.proposed_flow_m3s.toFixed(3)} m³/s). Open the Simulator to run it.`;
  if (p.includes("why") || p.includes("recommend"))
    return (
      rec.rationale.join(" ") +
      ` Scope: ${rec.recommendation_scope.replace(/_/g, " ")}; not safety-qualified.`
    );
  if (p.includes("sensor") || p.includes("health"))
    return data.sensors
      .map((s) => `${s.id}: ${s.status}${s.issue ? ` — ${s.issue}` : ""}`)
      .join(" ");
  return "I explain AEGIS backend outputs. Try: “Why this recommendation?”, “Sensor health”, or “Simulate diverting 200 m³ for 600 seconds.”";
}
