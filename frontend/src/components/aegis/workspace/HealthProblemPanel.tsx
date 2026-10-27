import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanonicalResponse, NetworkNode, RiskFinding } from "@/data/types";
import { display, humanize, severityTone } from "@/lib/aegis";
import { Pill } from "./atoms";
import { problemName } from "./HealthProblemMarkers";

/** Decision-support inspection of one supplied finding: what is wrong, how severe it is,
 *  what evidence supports it and what it could cause. No condition detection or risk
 *  calculation; canonical component details stay in the right-side component profile. */
export function HealthProblemPanel({ data: _data, node, finding, onClose, onNextProblem, onPreviousProblem }: { data: CanonicalResponse; node: NetworkNode; finding: RiskFinding; onClose: () => void; onNextProblem?: () => void; onPreviousProblem?: () => void }) {
  const value = (number: number | null) => number == null ? "Unknown" : finding.unit === "m" ? `${number.toFixed(2)} m` : display(number, finding.unit);
  return <aside className="health-inspection" aria-label="Health problem details">
    <header className="health-inspection-head">
      <div className="health-inspection-title">
        <h2>{node.id} {humanize(node.type).replace(/^\w/, (letter) => letter.toUpperCase())}</h2>
        {onPreviousProblem && <Button variant="ghost" size="icon" className="health-prev-problem" title="Previous problem" aria-label="Previous problem" onClick={onPreviousProblem}><ChevronLeft size={15} /></Button>}
        {onNextProblem && <Button variant="ghost" size="icon" className="health-next-problem" title="Next problem" aria-label="Next problem" onClick={onNextProblem}><ChevronRight size={15} /></Button>}
      </div>
      <Button variant="ghost" size="icon" title="Close problem details" aria-label="Close problem details" onClick={onClose}><X size={16} /></Button>

    </header>
    <div className="health-inspection-body">
      <section className="health-inspection-issue">
        <h3>Health Issue</h3>
        <h4>{problemName(finding, node.id)}</h4>
        <div className="health-inspection-severity"><span>Severity</span><Pill tone={severityTone[finding.severity]}>{finding.severity}</Pill></div>
      </section>
      <section><h3>Observation</h3><dl className="health-inspection-values">
        <div><dt>Observed</dt><dd>{value(finding.observed_value)}</dd></div>
        <div><dt>Threshold</dt><dd>{value(finding.threshold)}</dd></div>
        <div><dt>Finding confidence</dt><dd>{finding.confidence == null ? "Unknown" : display(finding.confidence)}</dd></div>
      </dl></section>
      <section><h3>Evidence</h3><ul className="health-inspection-evidence">{finding.evidence.map((evidence, index) => <li key={`${finding.id}-${index}`}>{evidence}</li>)}</ul></section>
      <section className="health-inspection-risk"><h3>Potential Impact</h3><p>{finding.potential_impact}</p></section>
    </div>
  </aside>;
}
