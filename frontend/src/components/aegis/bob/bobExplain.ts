// Bob explanation boundary. Narrates ONLY fields present in the canonical
// response; the AI provider is abstract (mock today). Never computes or ranks.
import type { CanonicalResponse } from "@/data/types";
import { constraintLabel, display, feasibilityLabel, humanize, nodeCandidate, nodeRisks, nodeSensors, recommendationLabel } from "@/lib/aegis";

export interface BobLine { text: string; refs: string[] }

export function explain(data: CanonicalResponse, selectedId: string | null): BobLine[] {
  const rec = data.recommendation;
  const recLine: BobLine = {
    text: `Recommendation: ${recommendationLabel[rec.recommendation_status]}${rec.selected_candidate_id ? ` (${rec.selected_candidate_id})` : ""} · scope ${humanize(rec.recommendation_scope)} · safety qualified: ${rec.safety_qualified ? "yes" : "no"}.`,
    refs: rec.selected_candidate_id ? [rec.selected_candidate_id] : [],
  };

  if (!selectedId) {
    const issues = data.sensors.filter((s) => s.status !== "fresh");
    const critical = data.sensors.filter((s) => s.critical);
    return [
      { text: `Network ${data.network.network_id}: ${data.network.nodes.length} components and ${data.network.edges.length} connections in the canonical response.`, refs: [] },
      ...critical.map((s) => ({ text: `Critical sensor ${s.id} is ${s.status}; effective value ${display(s.effective_value, s.unit)}.`, refs: [s.id] })),
      { text: issues.length ? `${issues.length} sensor(s) report a non-fresh status.` : "All reported sensors are fresh.", refs: issues.map((s) => s.id) },
      { text: `${data.risks.length} canonical risk finding(s) reported.`, refs: data.risks.map((r) => r.target_id) },
      recLine,
    ];
  }

  const node = data.network.nodes.find((n) => n.id === selectedId);
  if (node) {
    const lines: BobLine[] = [{ text: `${node.label} (${node.type}).`, refs: [] }];
    for (const s of nodeSensors(data, node)) lines.push({ text: `${s.id} measures ${humanize(s.variable)}: ${s.status}, effective ${display(s.effective_value, s.unit)}, data confidence ${display(s.confidence)}. Confidence is data usability, not hazard probability.`, refs: [s.id] });
    for (const r of nodeRisks(data, node)) lines.push({ text: `Finding “${r.title}” (${r.severity}): ${r.potential_impact}`, refs: [] });
    const c = nodeCandidate(data, node);
    if (c) {
      const open = c.constraints.filter((k) => k.status !== "pass").map((k) => `${k.description} — ${constraintLabel[k.status].toLowerCase()}`);
      lines.push({ text: `Hosts candidate ${c.id}: ${feasibilityLabel(c.feasible).toLowerCase()} per backend${open.length ? `; ${open.join("; ")}` : ""}.`, refs: [c.id] });
    }
    if (lines.length === 1) lines.push({ text: "No sensors, findings or candidates are attached to this component in the response.", refs: [] });
    return lines;
  }

  const edge = data.network.edges.find((e) => e.id === selectedId);
  if (edge) {
    const routes = data.candidates.filter((c) => c.route_edge_ids.includes(edge.id));
    return [
      { text: `Connection ${edge.from} → ${edge.to}. The response carries no physical pipe dimensions; drawn geometry is presentation only.`, refs: [edge.from, edge.to] },
      { text: routes.length ? `Part of candidate route(s): ${routes.map((c) => c.id).join(", ")}.` : "Not part of any candidate route.", refs: routes.map((c) => c.id) },
    ];
  }

  return [{ text: `No canonical component matches ${selectedId}.`, refs: [] }];
}
