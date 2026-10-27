import { useState } from "react";
import { Bot, Check, ChevronDown, ChevronLeft, ChevronRight, CloudRain, CornerDownLeft, Droplets, Loader2, Play, ShieldAlert, ShieldCheck, ShieldQuestion, Waves, Activity } from "lucide-react";
import type { CanonicalResponse, NetworkNode } from "@/data/types";
import { display, feasibilityLabel, feasibilityTone, humanize, nodeRisks, nodeSensors, recommendationLabel, recommendationTone, resolveTarget, sensorTone, severityTone, strongestTone, type Tone } from "@/lib/aegis";
import { cn } from "@/lib/utils";
import { ConstraintRow, KV, Pill, Section } from "./atoms";
import { SCENARIOS } from "./types";
import { Button } from "@/components/ui/button";
import type { BobDecision } from "@/data/bobInterventions";
import type { SimBobReply } from "@/data/simBob";
import type { HydraulicResult } from "@/data/hydraulicSimulation";
import { getComponentIntel } from "@/data/componentIntelligence";

type Select = (id: string) => void;

/* ---------------- Simulate ---------------- */
const scenarioIcon = (id: string) => id === "heavy_storm" || id === "extreme_rainfall" ? CloudRain : id === "flooding" || id === "cloudburst" ? Droplets : Waves;

export type SimInput = "scenario" | "bob";

/** Bob simulation input — a situation question feeds the same mock
 *  simulation pipeline as a predefined scenario. */
function BobAsk({ pending, onAsk }: { pending: boolean; onAsk: (question: string) => void }) {
  const [prompt, setPrompt] = useState("");
  function submit(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setPrompt("");
    onAsk(question);
  }
  return (
    <div className="bob-ask">
      <p className="ws-note">Ask Bob what happens in a situation. Bob interprets the question, runs the same mock simulation as a scenario, and explains the supplied result.</p>
      <form className="bob-ask-form" onSubmit={(event) => { event.preventDefault(); submit(prompt); }}>
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Ask Bob a simulation question" placeholder="What happens if heavy rainfall occurs?" maxLength={2000} />
        <Button type="submit" size="icon" aria-label="Send to Bob" title="Send to Bob" disabled={pending || !prompt.trim()}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CornerDownLeft size={14} />}
        </Button>
      </form>
      {pending && <p role="status" className="ws-note">Running Synthetic Simulation…</p>}
    </div>
  );
}

export function SimulatePanel({ data, scenarioId, setScenarioId, phase, onRun, onSelect, input, setInput, bobAnswer, bobPending, onBobAsk, onAcceptRecommendation, hydraulic, onClearWhatIf }: {
  data: CanonicalResponse; scenarioId: string; setScenarioId: (id: string) => void;
  phase: "idle" | "running" | "done"; onRun: () => void; onSelect: Select;
  input: SimInput; setInput: (input: SimInput) => void;
  bobAnswer: SimBobReply | null; bobPending: boolean; onBobAsk: (question: string) => void;
  onAcceptRecommendation?: () => void;
  hydraulic?: HydraulicResult | null;
  onClearWhatIf?: () => void;
}) {
  const sim = data?.simulation;
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const [menuOpen, setMenuOpen] = useState(false);
  const scenarios = Array.isArray(SCENARIOS) && SCENARIOS.length > 0 ? SCENARIOS : [];
  const current = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  if (!current) {
    return <div className="ws-stack"><p className="ws-note">Simulation scenarios unavailable. Canonical network remains visible.</p></div>;
  }
  const CurrentIcon = scenarioIcon(current.id);
  const failedEdges = Array.isArray(hydraulic?.failed_edges) ? hydraulic!.failed_edges : [];
  const storageStress = Array.isArray(hydraulic?.storage_stress) ? hydraulic!.storage_stress : [];
  return (
    <div className="ws-stack">
      <div className="sim-input-toggle" role="group" aria-label="Simulation input method">
        <Button variant={input === "scenario" ? "default" : "outline"} size="sm" aria-pressed={input === "scenario"} onClick={() => setInput("scenario")}><Play size={13} />Scenario</Button>
        <Button variant={input === "bob" ? "default" : "outline"} size="sm" aria-pressed={input === "bob"} onClick={() => setInput("bob")}><Bot size={13} />Bob</Button>
      </div>
      {input === "scenario" ? (
        <Section title="1 · Scenario">
          <div className="scenario-menu">
            <Button variant="outline" size="sm" className="scenario-menu-toggle" disabled={phase === "running" || bobPending} aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>
              <CurrentIcon size={14} /><span>Scenario · {current.label}</span><ChevronDown size={13} />
            </Button>
            {menuOpen && <div className="scenario-menu-list" role="menu" aria-label="Scenarios">
              {scenarios.map((s) => { const Icon = scenarioIcon(s.id); return (
                <Button variant="ghost" key={s.id} role="menuitemradio" aria-checked={scenarioId === s.id} className={cn("scenario", scenarioId === s.id && "is-active")} onClick={() => { setScenarioId(s.id); setMenuOpen(false); }}>
                  <Icon size={15} /><span><strong>{s.label}</strong><small>{s.detail}</small></span>
                </Button>
              ); })}
            </div>}
          </div>
          <p className="ws-note">{current.detail}. Deterministic AEGIS hydraulic evaluation using canonical capacities — what-if states are temporary.</p>
          <Button className="ws-action" onClick={onRun} disabled={phase === "running"}>
            {phase === "running" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}{phase === "running" ? "Running Simulation…" : "Run Scenario"}
          </Button>
          {hydraulic?.what_if && onClearWhatIf && (
            <Button variant="outline" className="ws-action" onClick={onClearWhatIf} disabled={phase === "running"}>Clear What-If / Reset</Button>
          )}
        </Section>
      ) : (
        <Section title="1 · Bob · Simulation Assistant">
          <BobAsk pending={bobPending || phase === "running"} onAsk={onBobAsk} />
          {hydraulic?.what_if && onClearWhatIf && (
            <Button variant="outline" className="ws-action" onClick={onClearWhatIf} disabled={phase === "running" || bobPending}>Clear What-If / Reset</Button>
          )}
        </Section>
      )}
      {bobAnswer?.text && (
        <Section title="Bob · Interpretation" aside={<Pill tone="info">Synthetic</Pill>}>
          <div className="bob-interpretation">
            <SafeBobMarkdown text={bobAnswer.text} />
          </div>
        </Section>
      )}
      <Section title="2 · Evaluation" aside={phase === "done" ? <span className="ws-count">{hydraulic?.condition_label ?? data.fixture_label ?? "Simulation"}</span> : undefined}>
        {phase !== "done" ? <p className="ws-note">{phase === "running" ? "Evaluating hydraulic condition…" : "No scenario evaluated."}</p> : <>
        {hydraulic ? (
          <div className="kv-grid">
            <KV label="Condition" value={hydraulic.condition_label ?? "—"} />
            <KV label="Network Status" value={hydraulic.overall_network_status ?? "—"} />
            <KV label="Max Loading" value={display(hydraulic.max_loading_ratio)} />
            <KV label="Bottleneck" value={hydraulic.critical_bottleneck ?? "—"} />
            <KV label="Failed Edges" value={failedEdges.join(", ") || "—"} />
            <KV label="Storage Stress" value={storageStress.join(", ") || "—"} />
          </div>
        ) : (
          <div className="kv-grid">
            <KV label="Scenario ID" value={sim?.scenario_id ?? "—"} /><KV label="Diverted Volume" value={display(sim?.diverted_volume_m3, "m³")} />
            <KV label="Duration" value={display(sim?.duration_s, "s")} /><KV label="Proposed Flow" value={display(sim?.proposed_flow_m3s, "m³/s")} />
          </div>
        )}
        {candidates.map((c) => (
          <div key={c.id} className={cn("cand-card", `tone-${feasibilityTone(c.feasible)}`)}>
            <Button variant="ghost" className="cand-head" onClick={() => onSelect(c.node_id)}>
              <span><strong>{c.id}</strong><small>{c.kind} at {c.node_id} · route {(c.route_edge_ids ?? []).join(", ") || "—"}</small></span>
              <Pill tone={feasibilityTone(c.feasible)}>{feasibilityLabel(c.feasible)}</Pill>
            </Button>
            {(c.constraints ?? []).map((k) => <ConstraintRow key={k.constraint_id} c={k} />)}
          </div>
        ))}
        <p className="ws-note">{hydraulic?.summary ?? `Candidate-level capacity constraints are MVP model constraints, not surveyed pipe capacities. ${sim?.model_note ?? ""}`}</p>
        </>}
      </Section>
      <Section title="3 · Result">
        {phase === "done" ? <><ResultBanner data={data} onAccept={onAcceptRecommendation} /><ResultInterpretation data={data} onSelect={onSelect} hydraulic={hydraulic ?? null} /></> : <p className="ws-note">{phase === "running" ? "Simulation running…" : "No simulation result."}</p>}
      </Section>
    </div>
  );
}

function SafeBobMarkdown({ text }: { text: string }) {
  // Prefer plain text so markdown/stream parsers cannot crash Simulate.
  return <div className="bob-interpretation-text" style={{ whiteSpace: "pre-wrap" }}>{text}</div>;
}

/** Reading of supplied scenario outputs only — infeasible routes, failed constraints,
 *  unreliable sensors and findings are lookups, never new calculations. */
function ResultInterpretation({ data, onSelect, hydraulic }: { data: CanonicalResponse; onSelect: Select; hydraulic: HydraulicResult | null }) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const risks = Array.isArray(data?.risks) ? data.risks : [];
  const sensors = Array.isArray(data?.sensors) ? data.sensors : [];
  const infeasible = candidates.filter((c) => c.feasible === false);
  const failed = candidates.flatMap((c) => (c.constraints ?? []).filter((rule) => rule.status === "fail").map((rule) => ({ candidate: c, rule })));
  const unreliable = sensors.filter((s) => s.status !== "fresh");
  const edges = Array.isArray(hydraulic?.edges) ? hydraulic!.edges : [];
  const components = Array.isArray(hydraulic?.components) ? hydraulic!.components : [];
  const affectedEdges = Array.isArray(hydraulic?.affected_edges) ? hydraulic!.affected_edges : [];
  const affectedComponents = Array.isArray(hydraulic?.affected_components) ? hydraulic!.affected_components : [];
  const sensorNotes = Array.isArray(hydraulic?.sensor_considerations) ? hydraulic!.sensor_considerations : [];
  const items: { tone: Tone; text: React.ReactNode }[] = [
    ...(hydraulic ? [
      { tone: "info" as Tone, text: <>Condition: {hydraulic.condition_label ?? "—"} · overall {hydraulic.overall_network_status ?? "—"}</> },
      ...affectedEdges.map((id) => ({ tone: "crit" as Tone, text: <>Affected edge {id} · state {edges.find((e) => e.edge_id === id)?.state ?? "—"}</> })),
      ...affectedComponents.map((id) => ({ tone: "warn" as Tone, text: <>Affected component <button className="link" onClick={() => onSelect(id)}>{id}</button> · state {components.find((c) => c.component_id === id)?.state ?? "—"}</> })),
      ...sensorNotes.map((note) => ({ tone: "warn" as Tone, text: <>{note}</> })),
    ] : []),
    ...infeasible.map((c) => ({ tone: "crit" as Tone, text: <>Route infeasible: <button className="link" onClick={() => onSelect(c.node_id)}>{c.id} at {c.node_id}</button></> })),
    ...failed.map(({ candidate, rule }) => ({ tone: "crit" as Tone, text: <>Critical constraint · {candidate.node_id}: {rule.description} (observed {display(rule.observed, rule.unit)}, limit {display(rule.limit, rule.unit)})</> })),
    ...risks.map((r) => ({ tone: (severityTone[r.severity] ?? "unknown") as Tone, text: <>{r.title} · {r.target_id}: {r.potential_impact}</> })),
    ...unreliable.map((s) => ({ tone: (sensorTone[s.status] ?? "unknown") as Tone, text: <>Sensor unreliable: {s.id} at {s.node_id} ({s.status}){s.issue ? ` — ${s.issue}` : ""}</> })),
  ];
  return (
    <div className="result-interpretation">
      <h4>Interpretation · Simulation Results</h4>
      {items.length ? <ul className="ws-list">{items.map((item, index) => <li key={index} className={`tone-text-${item.tone}`}>{item.text}</li>)}</ul> : <p className="ws-note">No hydraulic stress, constraint, finding or sensor issue in this scenario.</p>}
      <p className="ws-note">{hydraulic ? "Edge and component states come from the deterministic AEGIS hydraulic engine. What-if changes do not mutate the canonical baseline." : "Results are read from the supplied evaluation."}</p>
    </div>
  );
}

function ResultBanner({ data, onAccept }: { data: CanonicalResponse; onAccept?: (() => void) | undefined }) {
  const r = data?.recommendation;
  if (!r) return <div className="result-banner tone-unknown"><ShieldQuestion size={20} /><div><strong>No recommendation supplied</strong><small>Canonical network is unchanged.</small></div></div>;
  const status = r.recommendation_status;
  const Icon = status === "recommended" ? ShieldCheck : status === "abstained" ? ShieldQuestion : ShieldAlert;
  const className = cn("result-banner", `tone-${recommendationTone[status] ?? "unknown"}`);
  const content = <>
    <Icon size={20} />
    <div>
      <strong>{recommendationLabel[status] ?? status}{r.selected_candidate_id ? ` · ${r.selected_candidate_id}` : ""}</strong>
      <small>Scope: {humanize(r.recommendation_scope ?? "limited_mvp_scope")} · Safety qualified: {r.safety_qualified ? "Yes" : "No"}</small>
    </div>
  </>;
  // Same visual box; when a recommendation can be accepted it behaves as a button.
  if (onAccept) {
    return <Button variant="ghost" className={className} onClick={onAccept} title="Review supplied recommendation — create an Action Plan in Review">{content}</Button>;
  }
  return <div className={className}>{content}</div>;
}

/* ---------------- Review ---------------- */
const healthLabel: Record<string, string> = { info: "Low", warn: "Moderate", crit: "High / Critical", ok: "Healthy", unknown: "Unknown", neutral: "Healthy" };

function ComponentSlab({ data, node, onSelect }: { data: CanonicalResponse; node: NetworkNode; onSelect: Select }) {
  const risks = nodeRisks(data, node);
  const sensors = nodeSensors(data, node);
  const tone = risks.length ? strongestTone(risks.map((risk) => severityTone[risk.severity])) : "ok";
  const intel = getComponentIntel(node.id);
  const confidence = sensors.find((s) => s.confidence != null)?.confidence
    ?? intel?.sensor_confidence
    ?? intel?.sensor?.confidence
    ?? null;
  return (
    <Button variant="ghost" className={cn("review-slab", `tone-${tone}`)} onClick={() => onSelect(node.id)}>
      <div className="review-slab-head"><strong>{node.id}</strong><Pill tone={tone}>{healthLabel[tone]}</Pill></div>
      <small>{humanize(node.type)}</small>
      <dl className="review-slab-facts">
        <div><dt>Confidence</dt><dd>{confidence == null ? "Unknown" : display(confidence)}</dd></div>
        <div><dt>Current Problem</dt><dd>{risks[0]?.title ?? "—"}</dd></div>
      </dl>
    </Button>
  );
}

function ActionPlanCard({ plan, onSelect, onToggleStep }: { plan: BobDecision; onSelect: Select; onToggleStep: (planId: string, stepIndex: number) => void }) {
  const completed = plan.status === "Completed · resolved";
  return (
    <article className={cn("action-plan-card", completed && "is-completed")}>
      <div className="action-plan-head">
        <Button variant="ghost" className="link" onClick={() => onSelect(plan.componentId)}>{plan.componentId} — {plan.problem}</Button>
        {plan.priority && <Pill tone="crit">PRIORITY</Pill>}
        <Pill tone={completed ? "ok" : "warn"}>{plan.status}</Pill>
      </div>
      <h4>Proposed Action</h4><p>{plan.intervention}</p>
      <h4>Simulation Outcome · Synthetic</h4><p>{plan.outcome}</p>
      <h4>Action Items</h4>
      <ol className="action-plan-steps">
        {plan.steps.map((step, index) => {
          const done = plan.doneSteps.includes(index);
          return <li key={step} className={cn(done && "is-done")}>
            <Button variant="ghost" size="icon" className="step-tick" aria-pressed={done} aria-label={`${done ? "Reopen" : "Complete"} action: ${step}`} title={done ? "Reopen action" : "Complete action"} onClick={() => onToggleStep(plan.id, index)}><Check size={13} /></Button>
            <span>{step}</span>
          </li>;
        })}
      </ol>
      <small>Created {new Date(plan.createdAt).toLocaleString()} · mock action plan · illustrative · session only — the problem resolves only when every action is completed</small>
    </article>
  );
}

export function ReviewPanel({ data, onSelect, plans = [], onToggleStep }: { data: CanonicalResponse; onSelect: Select; plans?: BobDecision[]; onToggleStep?: (planId: string, stepIndex: number) => void }) {
  const r = data.recommendation;
  const selected = data.candidates.find((c) => c.id === r.selected_candidate_id);
  return (
    <div className="review-grid">
    <div className="ws-stack review-main">
      <Section title="Component Status" aside={<span className="ws-count">{data.network.nodes.length}</span>}>
        <div className="review-slabs">
          {data.network.nodes.map((node) => <ComponentSlab key={node.id} data={data} node={node} onSelect={onSelect} />)}
        </div>
        <p className="ws-note">Health and confidence are read from the active supplied findings and sensors; resolved components show Healthy.</p>
      </Section>
      <Section title="Recommendation">
        <ResultBanner data={data} />
        <div className="kv-grid">
          <KV label="Selected Candidate" value={selected ? <button className="link" onClick={() => onSelect(selected.node_id)}>{selected.id}</button> : "None"} />
          <KV label="Backend Rank" value={display(selected?.rank)} />
        </div>
        <div className={cn("safety-flag", r.safety_qualified ? "tone-ok" : "tone-warn")}>
          <ShieldAlert size={14} /> {r.safety_qualified ? "Safety qualified under the contract." : "Not safety-qualified. Decision support within limited MVP scope only."}
        </div>
      </Section>
      <Section title="Decision Basis">
        <ol className="ws-list">{r.rationale.map((x) => <li key={x}>{x}</li>)}</ol>
      </Section>
      {selected && <Section title={`Constraints · ${selected.id}`}>{selected.constraints.map((k) => <ConstraintRow key={k.constraint_id} c={k} />)}</Section>}
      <Section title="Review Priorities" aside={<span className="ws-count">{data.risks.length}</span>}>
        {data.risks.map((k) => (
          <button key={k.id} className="review-item" onClick={() => onSelect(resolveTarget(data, k.target_id))}>
            <Activity size={13} /><span><strong>{k.title}</strong><small>{k.target_id}</small></span><Pill tone={severityTone[k.severity]}>{k.severity}</Pill>
          </button>
        ))}
        {!data.risks.length && <p className="ws-note">No canonical findings.</p>}
      </Section>
    </div>
    <section className="ws-stack review-plans" aria-label="Action plan">
      <ActionPlanList plans={plans} onSelect={onSelect} onToggleStep={onToggleStep ?? (() => {})} />
    </section>
    </div>
  );
}

/** Heading menu and detail share the same session plans and completion controls. */
function ActionPlanList({ plans, onSelect, onToggleStep }: { plans: BobDecision[]; onSelect: Select; onToggleStep: (planId: string, stepIndex: number) => void }) {
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const visible = plans.filter((plan) => plan.status !== "Completed · resolved" && (!priorityOnly || plan.priority));
  const pageCount = Math.ceil(visible.length / 2);
  const index = Math.min(page, Math.max(pageCount - 1, 0));
  const headings = visible.slice(index * 2, index * 2 + 2);
  const opened = plans.find((plan) => plan.id === openedId);
  return (
    <Section title="Action Plan" {...(opened ? { leading: <Button variant="ghost" size="icon" className="plan-detail-back" aria-label="Back to action plan menu" title="Back to action plan menu" onClick={() => setOpenedId(null)}><ChevronLeft size={14} /></Button> } : {})} aside={<Button variant="outline" size="sm" className="plan-priority-filter" aria-pressed={priorityOnly} onClick={() => { setPriorityOnly((on) => !on); setPage(0); setOpenedId(null); }}>Priority</Button>}>
      {opened ? <ActionPlanCard key={opened.id} plan={opened} onSelect={onSelect} onToggleStep={onToggleStep} /> : headings.length ? <div className="plan-heading-list">
        {headings.map((plan) => <Button key={plan.id} variant="outline" className="plan-menu-heading" onClick={() => setOpenedId(plan.id)}>
          <strong>{plan.componentId} — {plan.problem}</strong>
          {plan.priority && <Pill tone="crit">PRIORITY</Pill>}
        </Button>)}
      </div> : <p className="ws-note">No Action Plans currently</p>}
      {!opened && pageCount > 1 && (
        <nav className="plan-pagination" aria-label="Action plan pages">
          <Button variant="ghost" size="icon" aria-label="Previous action plan page" title="Previous page" disabled={index === 0} onClick={() => setPage(index - 1)}><ChevronLeft size={13} /></Button>
          {Array.from({ length: pageCount }, (_, itemIndex) => (
            <Button key={itemIndex} variant={itemIndex === index ? "default" : "ghost"} size="icon" aria-label={`Action plan page ${itemIndex + 1}`} aria-current={itemIndex === index ? "page" : undefined} onClick={() => setPage(itemIndex)}>{itemIndex + 1}</Button>
          ))}
          <Button variant="ghost" size="icon" aria-label="Next action plan page" title="Next page" disabled={index === pageCount - 1} onClick={() => setPage(index + 1)}><ChevronRight size={13} /></Button>
        </nav>
      )}
    </Section>
  );
}
