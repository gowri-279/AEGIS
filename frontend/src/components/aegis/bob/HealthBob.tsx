import { useEffect, useRef, useState } from "react";
import { Bot, Check, MessageCircle, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import type { HealthBobContext } from "@/data/healthBob";
import { bobProblemTitle, bobQuestionIntent, bobTransition, mockBudgetLabel, proposedBobScenario, type BobDecision, type BobPhase, type BobScenarioId, type BobScenarioResult, type BobVisualScenario } from "@/data/bobInterventions";
import { display } from "@/lib/aegis";
import { getHealthBobReply, runBobScenario } from "@/services/api";

interface Props {
  context: HealthBobContext;
  onClose: () => void;
  onVisual: (visual: BobVisualScenario | null) => void;
  onConversation: (expanded: boolean) => void;
  onConfirm: (decision: BobDecision) => void;
}
interface Turn { role: "user" | "assistant"; text: string }
const DEMO_DURATION = 3200;

/** Health Bob decision panel. Explanations from component intelligence; proposed solutions run AEGIS assessment when available. */
export function HealthBob({ context, onClose, onVisual, onConversation, onConfirm }: Props) {
  const [phase, setPhase] = useState<BobPhase>("no-action");
  const [result, setResult] = useState<BobScenarioResult | null>(null);
  const [noAction, setNoAction] = useState<BobScenarioResult | null>(null);
  const [brief, setBrief] = useState<{ existing_problem?: string; why_it_matters?: string; why_solution?: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const revision = useRef(0);
  const conversationBody = useRef<HTMLDivElement>(null);
  const decisionBody = useRef<HTMLDivElement>(null);
  const currentResult = useRef<BobScenarioResult | null>(null);
  const title = bobProblemTitle(context);
  function transition(event: Parameters<typeof bobTransition>[1]) { setPhase((previous) => bobTransition(previous, event)); }
  function cancelTimer() { if (timer.current !== null) clearTimeout(timer.current); }

  async function demonstrate(scenarioId: BobScenarioId, conversational = false) {
    cancelTimer(); setPending(true); setError(null);
    onVisual(null);
    const request = ++revision.current;
    try {
      const next = await runBobScenario(context, scenarioId);
      if (!mounted.current || request !== revision.current) return;
      if (scenarioId === "NO_ACTION" && !conversational) {
        setNoAction(next);
        setBrief({
          existing_problem: next.existing_problem,
          why_it_matters: next.why_it_matters,
          why_solution: next.why_solution,
        });
      } else {
        setResult(next);
        currentResult.current = next;
        setBrief((prev) => ({
          existing_problem: next.existing_problem ?? prev?.existing_problem,
          why_it_matters: next.why_it_matters ?? prev?.why_it_matters,
          why_solution: next.why_solution ?? prev?.why_solution,
        }));
      }
      onVisual({ ...next.visual, running: true, revision: request });
      timer.current = setTimeout(() => {
        if (!mounted.current || request !== revision.current) return;
        onVisual({ ...next.visual, running: false, revision: request });
        setPending(false);
        if (conversational) setTurns((previous) => [...previous, { role: "assistant", text: `### Simulation Result\n${next.title}\n\n${next.result ?? next.explanation}\n\n${next.consequences.map((item) => `- ${item}`).join("\n")}\n\nProposed option: ${next.intervention}` }]);
        else transition(scenarioId === "NO_ACTION" ? "NO_ACTION_DONE" : "SOLUTION_DONE");
      }, DEMO_DURATION);
    } catch { if (mounted.current) { setError("The engineering scenario could not be loaded. Please retry."); setPending(false); } }
  }

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const reply = await getHealthBobReply({ context });
        if (mounted.current) {
          setBrief({
            existing_problem: reply.existing_problem,
            why_it_matters: reply.why_it_matters,
            why_solution: reply.why_solution,
          });
        }
      } catch { /* briefing is optional; scenario path still runs */ }
      void demonstrate("NO_ACTION");
    })();
    return () => { mounted.current = false; revision.current++; cancelTimer(); onVisual(null); onConversation(false); };
  }, []);
  useEffect(() => { conversationBody.current?.scrollTo?.({ top: conversationBody.current.scrollHeight, behavior: "smooth" }); }, [turns, pending]);

  useEffect(() => { if (phase === "result" || phase === "confirmed") decisionBody.current?.scrollTo?.({ top: decisionBody.current.scrollHeight, behavior: "smooth" }); }, [phase]);

  async function submit(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setPrompt(""); setTurns((previous) => [...previous, { role: "user", text: question }]);
    const intent = bobQuestionIntent(question);
    if (intent === "approve") {
      if (currentResult.current?.supported && currentResult.current.scenarioId !== "NO_ACTION") { onConversation(false); transition("RETURN"); }
      else setTurns((previous) => [...previous, { role: "assistant", text: "First run a supported proposed solution. An unavailable or constrained alternative cannot be approved." }]);
      return;
    }
    if (/\br1\b/i.test(question) && /divert|rerout|route|send|branch/i.test(question)) {
      setTurns((previous) => [...previous, { role: "assistant", text: "R1 is a recharge branch. Its supplied candidate is ineligible or undetermined; it is not a preferred diversion route and has no connection to J4. No rerouting was applied." }]); return;
    }
    if (intent !== "evidence") { await demonstrate(intent, true); return; }
    setPending(true);
    try {
      const reply = await getHealthBobReply({ context, question });
      if (mounted.current) setTurns((previous) => [...previous, { role: "assistant", text: reply.text }]);
    } catch { if (mounted.current) setError("Bob's explanation could not be loaded."); }
    finally { if (mounted.current) setPending(false); }
  }

  const problemText = brief?.existing_problem
    ?? `${context.node.id} · ${context.finding.severity}. Observed: ${context.finding.observed_value == null ? "unavailable" : display(context.finding.observed_value, context.finding.unit)} · Threshold: ${context.finding.threshold == null ? "unavailable" : display(context.finding.threshold, context.finding.unit)}. ${context.finding.potential_impact}`;
  const whyText = brief?.why_it_matters
    ?? context.component_intelligence?.engineering_significance
    ?? context.finding.potential_impact;
  const proposedText = result?.intervention
    ?? (context.finding.category === "bottleneck"
      ? `Expand storage capacity at ${context.node.type === "storage" ? context.node.id : "L1"}`
      : context.finding.category === "overflow"
        ? `Redesign the ${context.node.id} → J4 → O1 downstream connection`
        : `Increase downstream conveyance capacity at ${context.node.id}`);
  const whySolutionText = result?.why_solution ?? brief?.why_solution
    ?? `Addresses the ${context.finding.category.replaceAll("_", " ")} finding at ${context.node.id} using known topology and component constraints.`;
  const resultText = result?.result
    ?? (result?.simulation_metrics?.from_simulation
      ? result.explanation
      : null);

  const isConversation = phase === "conversation";
  return <aside id="twin-bob" className={`bob-decision bob-mode-panel${isConversation ? " bob-conversation-panel" : ""}`} aria-label="Contextual Bob" data-component={context.node.id} data-phase={phase}>
    <header className="health-bob-head"><Bot size={14} /><div><strong>Bob · {context.node.id}</strong><small>Engineering Intelligence</small></div><Button variant="ghost" size="sm" title="Back to Health" aria-label="Close Bob" onClick={onClose}><X size={14} />Back</Button></header>
    {isConversation ? <>
      <div ref={conversationBody} className="bob-conversation-body" aria-label="Health Bob conversation">
        <h2>{title}</h2>
        {turns.map((turn, index) => <Message key={index} from={turn.role}><MessageContent><MessageResponse>{turn.text}</MessageResponse></MessageContent></Message>)}
        {pending && <p role="status">Running engineering scenario…</p>}
      </div>
      <PromptInput className="health-bob-composer" onSubmit={({ text }) => submit(text)}><PromptInputTextarea aria-label="Ask Health Bob" placeholder="What if we divert toward L1?" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} /><PromptInputFooter><small>AEGIS-grounded</small><PromptInputSubmit aria-label="Send to Health Bob" title="Send question" status={pending ? "submitted" : "ready"} disabled={pending || !prompt.trim()} /></PromptInputFooter></PromptInput>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => { onConversation(false); transition("RETURN"); }}>Return to decision</Button>
    </> : <div ref={decisionBody} className="bob-decision-body">
      <section><h3>Existing problem</h3><h2>{title}</h2><p>{problemText}</p>
        <details><summary>Supplied evidence</summary><ul>{context.finding.evidence.map((e) => <li key={e}>{e}</li>)}</ul><p>Finding confidence: {display(context.finding.confidence)} — data usability, not hazard probability.</p></details>
      </section>
      <section><h3>Why it matters</h3><p>{whyText}</p></section>
      {phase !== "plan" && phase !== "confirmed" && <section><h3>If no action is taken</h3>{phase === "no-action" ? <p role="status">Evaluating no-action consequence…</p> : <><p>{noAction?.if_no_action ?? noAction?.explanation}</p><ul>{(noAction?.consequences ?? []).map((item) => <li key={item}>{item}</li>)}</ul></>}</section>}
      {phase !== "no-action" && <section><h3>Proposed solution</h3><p>{proposedText}</p><p>{whySolutionText}</p>{(phase === "proposed" || phase === "result") && <Button variant="outline" size="sm" disabled={pending} onClick={() => { transition("RUN_SOLUTION"); void demonstrate(result && result.scenarioId !== "NO_ACTION" ? result.scenarioId : proposedBobScenario(context)); }}><Play size={13} />Run Proposed Solution</Button>}</section>}
      {phase === "solution" && <p role="status">Running AEGIS assessment for proposed solution…</p>}
      {phase === "result" && result && <section><h3>Result</h3><strong>{result.title}</strong><p>{resultText ?? result.explanation}</p>
        {result.simulation_metrics?.from_simulation && (
          <dl className="health-inspection-values">
            {result.simulation_metrics.recommendation_status != null && <div><dt>Assessment</dt><dd>{result.simulation_metrics.recommendation_status}</dd></div>}
            {result.simulation_metrics.selected_candidate_id != null && <div><dt>Selected</dt><dd>{result.simulation_metrics.selected_candidate_id}</dd></div>}
            {result.simulation_metrics.diverted_volume_m3 != null && <div><dt>Diverted</dt><dd>{result.simulation_metrics.diverted_volume_m3} m³</dd></div>}
            {result.simulation_metrics.proposed_flow_m3s != null && <div><dt>Proposed flow</dt><dd>{result.simulation_metrics.proposed_flow_m3s} m³/s</dd></div>}
          </dl>
        )}
      </section>}
      {phase === "result" && <section><h3>What Next?</h3><div className="bob-actions"><Button variant="ghost" size="sm" disabled={!result?.supported || result.scenarioId === "NO_ACTION"} onClick={() => transition("APPROVE")}><Check size={13} />Approve</Button><Button variant="ghost" size="sm" onClick={() => { transition("MORE"); onConversation(true); setTurns((previous) => previous.length ? previous : [{ role: "assistant", text: `### Current option\n${result?.intervention}\n\n${result?.title}\n\n${result?.result ?? result?.explanation ?? ""}` }]); }}><MessageCircle size={13} />More</Button></div>{!result?.supported && <p>This outcome cannot be approved; review missing data or explore another option.</p>}</section>}
      {phase === "confirmed" && <section><h3>Decision confirmed</h3><p>Added to Review as an action plan. The problem stays active until the authority completes the actions there. Session only; no work has been authorized.</p></section>}
      {phase === "plan" && result && <section className="bob-action-plan bob-action-plan-inline" aria-label="Action plan"><h3>Action plan</h3><strong>{context.node.id} → {result.intervention}</strong><ol>{result.steps.map((step) => <li key={step}>{step}</li>)}</ol><Button variant="outline" size="sm" onClick={() => { onConfirm({ id: `${context.node.id}:${context.finding.id}:${revision.current}`, componentId: context.node.id, problem: title, intervention: result.intervention, outcome: result.title, steps: [...result.steps], status: "Approved · pending", createdAt: new Date().toISOString(), doneSteps: [], source: "mock", priority: true, budget: mockBudgetLabel(result.scenarioId) }); transition("CONFIRM"); }}><Check size={13} />Confirm Decision</Button></section>}
    </div>}
    {error && <div role="alert" className="bob-error"><p>{error}</p><Button variant="outline" size="sm" onClick={() => void demonstrate(phase === "no-action" ? "NO_ACTION" : proposedBobScenario(context), isConversation)}>Retry</Button></div>}
  </aside>;
}
