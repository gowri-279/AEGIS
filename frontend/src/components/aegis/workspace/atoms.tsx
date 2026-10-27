import type { ReactNode } from "react";
import { Check, CircleDashed, X } from "lucide-react";
import type { ConstraintEvaluation } from "@/data/types";
import { constraintLabel, constraintTone, display, type Tone } from "@/lib/aegis";
import { cn } from "@/lib/utils";

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("pill", `tone-${tone}`, className)}>{children}</span>;
}

export function Section({ title, aside, children, className, leading }: { title: string; aside?: ReactNode; children: ReactNode; className?: string; leading?: ReactNode | undefined }) {
  return (
    <section className={cn("ws-section", className)}>
      <header className="ws-section-head">{leading}<h3>{title}</h3>{aside}</header>
      {children}
    </section>
  );
}

export function KV({ label, value }: { label: string; value: ReactNode }) {
  return <div className="kv"><span>{label}</span><strong>{value}</strong></div>;
}

export function ConstraintRow({ c }: { c: ConstraintEvaluation }) {
  const Icon = c.status === "pass" ? Check : c.status === "fail" ? X : CircleDashed;
  return (
    <div className={cn("constraint", `tone-${constraintTone[c.status]}`)}>
      <Icon size={14} className="constraint-icon" />
      <div className="constraint-body">
        <strong>{c.description}</strong>
        <small>Observed {display(c.observed, c.unit)} · Limit {display(c.limit, c.unit)}{c.note ? ` · ${c.note}` : ""}</small>
      </div>
      <span className="constraint-status">{constraintLabel[c.status]}</span>
    </div>
  );
}
