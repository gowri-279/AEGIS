import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { severityTone } from "@/lib/aegis";
import type { Severity } from "@/data/types";

export function BobSignal({
  title,
  severity,
  onOpen,
}: {
  title: string;
  severity: Severity;
  onOpen: () => void;
}) {
  return (
    <div
      className={`bob-signal tone-${severityTone[severity]}`}
      aria-label={`Bob signal: ${title}`}
    >
      <Bot size={13} className="bob-orb" aria-hidden="true" />
      <span>{title}</span>
      <Button
        variant="ghost"
        size="icon"
        className="bob-question"
        aria-label="Explain with Bob"
        title="Explain with Bob"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        ?
      </Button>
    </div>
  );
}
