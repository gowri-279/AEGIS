import { useState } from "react";
import { Bot, Check, ChevronDown, ChevronLeft, ChevronRight, CloudRain, CornerDownLeft, Droplets, Gauge, Loader2, Play, ShieldAlert, ShieldCheck, ShieldQuestion, Waves, Activity } from "lucide-react";
import type { CanonicalResponse, NetworkNode } from "@/data/types";
import { display, feasibilityLabel, feasibilityTone, humanize, nodeRisks, nodeSensors, recommendationLabel, recommendationTone, resolveTarget, sensorTone, severityTone, strongestTone, type Tone } from "@/lib/aegis";
import { cn } from "@/lib/utils";
import { ConstraintRow, KV, Pill, Section } from "./atoms";
import { SCENARIOS } from "./types";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";

import type { BobDecision } from "@/data/bobInterventions";
import type { SimBobReply } from "@/data/simBob";

type Select = (id: string) => void;

/* ---------------- Simulate ---------------- */
const scenarioIcon = (id: string) => id === "heavy-rain" ? CloudRain : id === "flooding" ? Droplets : id === "degraded" || id === "sensor-failure" ? Gauge : Waves;

export type SimInput = "scenario" | "bob";

const BOB_SUGGESTIONS = [
  "What happens if heavy rainfall occurs?",
  "What happens if L2 reaches maximum capacity?",
  "What happens if J3 water depth exceeds 0.8 m?",
  "What happens if the downstream conduit is blocked?",
  "What happens if the sensor becomes stale?",
  "What happens if we divert water from L2 to J4?",
];

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
      <div className="sim-bob-chips">
        {BOB_SUGGESTIONS.map((suggestion) => <Button key={suggestion} variant="outline" size="sm" disabled={pending} onClick={() => submit(suggestion)}>{suggestion}</Button>)}
      </div>
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

export function SimulatePanel({ data, scenarioId, setScenarioId, phase, onRun, onSelect, input, setInput, bobAnswer, bobPending, onBobAsk, onAcceptRecommendation }: {
  data: CanonicalResponse; scenarioId: string; setScenarioId: (id: string) => void;
  phase: "idle" | "running" | "done"; onRun: () => void; onSelect: Select;
  input: SimInput; setInput: (input: SimInput) => void;
  bobAnswer: SimBobReply | null; bobPending: boolean; onBobAsk: (question: string) => void;
  onAcceptRecommendation?: () => void;
}) {
  const sim = data.simulation;
  const [menuOpen, setMenuOpen] = useState(false);
  const current = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  if (!current) return null;
  const CurrentIcon = scenarioIcon(current.id);
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
              {SCENARIOS.map((s) => { const Icon = scenarioIcon(s.id); return (
                <Button variant="ghost" key={s.id} role="menuitemradio" aria-checked={scenarioId === s.id} className={cn("scenario", scenarioId === s.id && "is-active")} onClick={() => { setScenarioId(s.id); setMenuOpen(false); }}>
                  <Icon size={15} /><span><strong>{s.label}</strong><small>{s.detail}</small></span>
                </Button>
              ); })}
            </div>}
          </div>
          <p className="ws-note">{current.detail}. Illustrative MVP scenario — every value comes from the mock data model, not live sensors or hydraulics.</p>
          <Button className="ws-action" onClick={onRun} disabled={phase === "running"}>
            {phase === "running" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}{phase === "running" ? "Running Simulation…" : "Run Scenario"}
          </Button>
        </Section>
      ) : (
        <Section title="1 · Bob · Simulation Assistant">
          <BobAsk pending={bobPending || phase === "running"} onAsk={onBobAsk} />
        </Section>
      )}
      {bobAnswer && (
        <Section title="Bob · Interpretation" aside={<Pill tone="info">Synthetic</Pill>}>
          <div className="bob-interpretation"><MessageResponse>{bobAnswer.text}</MessageResponse></div>
        </Section>
      )}
      <Section title="2 · Evaluation" aside={phase === "done" ? <span className="ws-count">{data.fixture_label}</span> : undefined}>
        {phase !== "done" ? <p className="ws-note">{phase === "running" ? "Evaluating supplied mock scenario…" : "No scenario evaluated."}</p> : <>
        <div className="kv-grid">
          <KV label="Scenario ID" value={sim.scenario_id} /><KV label="Diverted Volume" value={display(sim.diverted_volume_m3, "m³")} />
          <KV label="Duration" value={display(sim.duration_s, "s")} /><KV label="Proposed Flow" value={display(sim.proposed_flow_m3s, "m³/s")} />
        </div>
        {data.candidates.map((c) => (
          <div key={c.id} className={cn("cand-card", `tone-${feasibilityTone(c.feasible)}`)}>
            <Button variant="ghost" className="cand-head" onClick={() => onSelect(c.node_id)}>
              <span><strong>{c.id}</strong><small>{c.kind} at {c.node_id} · route {c.route_edge_ids.join(", ") || "—"}</small></span>
              <Pill tone={feasibilityTone(c.feasible)}>{feasibilityLabel(c.feasible)}</Pill>
            </Button>
            {c.constraints.map((k) => <ConstraintRow key={k.constraint_id} c={k} />)}
          </div>
        ))}
        <p className="ws-note">Candidate-level capacity constraints are MVP model constraints, not surveyed pipe capacities. {sim.model_note}</p>
        </>}
      </Section>
      <Section title="3 · Result">
        {phase === "done" ? <><ResultBanner data={data} onAccept={onAcceptRecommendation} /><ResultInterpretation data={data} onSelect={onSelect} /></> : <p className="ws-note">{phase === "running" ? "Simulation running…" : "No simulation result."}</p>}
      </Section>
    </div>
  );
}

/** Reading of supplied scenario outputs only — infeasible routes, failed constraints,
 *  unreliable sensors and findings are lookups, never new calculations. */
function ResultInterpretation({ data, onSelect }: { data: CanonicalResponse; onSelect: Select }) {
  const infeasible = data.candidates.filter((c) => c.feasible === false);
  const failed = data.candidates.flatMap((c) => c.constraints.filter((rule) => rule.status === "fail").map((rule) => ({ candidate: c, rule })));
  const unreliable = data.sensors.filter((s) => s.status !== "fresh");
  const items: { tone: Tone; text: React.ReactNode }[] = [
    ...infeasible.map((c) => ({ tone: "crit" as Tone, text: <>Route infeasible: <button className="link" onClick={() => onSelect(c.node_id)}>{c.id} at {c.node_id}</button></> })),
    ...failed.map(({ candidate, rule }) => ({ tone: "crit" as Tone, text: <>Critical constraint · {candidate.node_id}: {rule.description} (observed {display(rule.observed, rule.unit)}, limit {display(rule.limit, rule.unit)})</> })),
    ...data.risks.map((r) => ({ tone: severityTone[r.severity] as Tone, text: <>{r.title} · {r.target_id}: {r.potential_impact}</> })),
    ...unreliable.map((s) => ({ tone: sensorTone[s.status] as Tone, text: <>Sensor unreliable: {s.id} at {s.node_id} ({s.status}){s.issue ? ` — ${s.issue}` : ""}</> })),
  ];
  return (
    <div className="result-interpretation">
      <h4>Interpretation · Supplied Results</h4>
      {items.length ? <ul className="ws-list">{items.map((item, index) => <li key={index} className={`tone-text-${item.tone}`}>{item.text}</li>)}</ul> : <p className="ws-note">No supplied constraint, finding or sensor issue in this scenario.</p>}
      <p className="ws-note">Which route is infeasible, which component is overloaded and whether risk increased are read from the supplied mock evaluation — nothing is recalculated here.</p>
    </div>
  );
}

function ResultBanner({ data, onAccept }: { data: CanonicalResponse; onAccept?: (() => void) | undefined }) {
  const r = data.recommendation;
  const Icon = r.recommendation_status === "recommended" ? ShieldCheck : r.recommendation_status === "abstained" ? ShieldQuestion : ShieldAlert;
  const className = cn("result-banner", `tone-${recommendationTone[r.recommendation_status]}`);
  const content = <>
    <Icon size={20} />
    <div>
      <strong>{recommendationLabel[r.recommendation_status]}{r.selected_candidate_id ? ` · ${r.selected_candidate_id}` : ""}</strong>
      <small>Scope: {humanize(r.recommendation_scope)} · Safety qualified: {r.safety_qualified ? "Yes" : "No"}</small>
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
  const confidence = sensors.find((s) => s.confidence != null)?.confidence;
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
