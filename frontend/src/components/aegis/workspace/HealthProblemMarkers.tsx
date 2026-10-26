import type { RiskFinding } from "@/data/types";
import { severityTone } from "@/lib/aegis";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Display supplied names only; no condition detection or node-specific cases. */
export function problemName(finding: RiskFinding, nodeId: string) {
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return finding.title
    .replace(new RegExp(`^${escaped}\\s*[—–:-]\\s*|\\s+at ${escaped}$`, "gi"), "")
    .replace(/\b[a-z]+\b/gi, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function HealthProblemMarkers({
  nodeId,
  findings,
  selectedFindingId,
  onSelect,
}: {
  nodeId: string;
  findings: RiskFinding[];
  selectedFindingId?: string | null;
  onSelect: (findingId: string) => void;
}) {
  return (
    <div className="health-problem-markers">
      {findings.map((finding) => (
        <Button
          variant="ghost"
          key={finding.id}
          className={cn(
            "health-problem-marker",
            `tone-${severityTone[finding.severity]}`,
            selectedFindingId === finding.id && "is-selected",
          )}
          data-node-id={nodeId}
          data-finding-id={finding.id}
          data-severity={finding.severity}
          aria-pressed={selectedFindingId === finding.id}
          aria-label={`${nodeId}: ${problemName(finding, nodeId)}, ${finding.severity}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(finding.id);
          }}
        >
          <span>{problemName(finding, nodeId)}</span>
        </Button>
      ))}
    </div>
  );
}
