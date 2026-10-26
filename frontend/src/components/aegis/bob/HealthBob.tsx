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

/** One session-only state machine. Scenario results come from the mock service, not UI calculations. */
export function HealthBob({ context, onClose, onVisual, onConversation, onConfirm }: Props) {
  const [phase, setPhase] = useState<BobPhase>("no-action");
  const [result, setResult] = useState<BobScenarioResult | null>(null);
  const [noAction, setNoAction] = useState<BobScenarioResult | null>(null);
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
    // Clear the previous visual state before applying the next fixed scenario.
    onVisual(null);
    const request = ++revision.current;
    try {
      const next = await runBobScenario(context, scenarioId);
      if (!mounted.current || request !== revision.current) return;
      if (scenarioId === "NO_ACTION" && !conversational) setNoAction(next);
      else { setResult(next); currentResult.current = next; }
      onVisual({ ...next.visual, running: true, revision: request });
      timer.current = setTimeout(() => {
        if (!mounted.current || request !== revision.current) return;
        onVisual({ ...next.visual, running: false, revision: request });
        setPending(false);
        if (conversational) setTurns((previous) => [...previous, { role: "assistant", text: `### Simulation Result · Synthetic\n${next.title}\n\n${next.explanation}\n\n${next.consequences.map((item) => `- ${item}`).join("\n")}\n\nProposed option: ${next.intervention}` }]);
        else transition(scenarioId === "NO_ACTION" ? "NO_ACTION_DONE" : "SOLUTION_DONE");
      }, DEMO_DURATION);
    } catch { if (mounted.current) { setError("The mock demonstration could not be loaded. Please retry."); setPending(false); } }
  }

  useEffect(() => {
    mounted.current = true;
    void demonstrate("NO_ACTION");
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
      setTurns((previous) => [...previous, { role: "assistant", text: "R1 is a recharge branch. Its supplied candidate is ineligible or undetermined; it is not a preferred diversion route and has no connection to J4. No rerouting demonstration was applied." }]); return;
    }
    if (intent !== "evidence") { await demonstrate(intent, true); return; }
    setPending(true);
    try {
      const reply = await getHealthBobReply({ context, question });
      if (mounted.current) setTurns((previous) => [...previous, { role: "assistant", text: reply.text }]);
    } catch { if (mounted.current) setError("Bob's mock explanation could not be loaded."); }
    finally { if (mounted.current) setPending(false); }
  }
  const isConversation = phase === "conversation";
  return <aside id="twin-bob" className={`bob-decision bob-mode-panel${isConversation ? " bob-conversation-panel" : ""}`} aria-label="Contextual Bob" data-component={context.node.id} data-phase={phase}>
    <header className="health-bob-head"><Bot size={14} /><div><strong>Bob · {context.node.id}</strong><small>Synthetic Simulation · Illustrative</small></div><Button variant="ghost" size="sm" title="Back to Health" aria-label="Close Bob" onClick={onClose}><X size={14} />Back</Button></header>
    {isConversation ? <>
      <div ref={conversationBody} className="bob-conversation-body" aria-label="Health Bob conversation">
        <h2>{title}</h2>
        {turns.map((turn, index) => <Message key={index} from={turn.role}><MessageContent><MessageResponse>{turn.text}</MessageResponse></MessageContent></Message>)}
        {pending && <p role="status">Running synthetic demonstration…</p>}
      </div>
      <PromptInput className="health-bob-composer" onSubmit={({ text }) => submit(text)}><PromptInputTextarea aria-label="Ask Health Bob" placeholder="What if we divert toward L1?" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} /><PromptInputFooter><small>Mock scenarios only</small><PromptInputSubmit aria-label="Send to Health Bob" title="Send question" status={pending ? "submitted" : "ready"} disabled={pending || !prompt.trim()} /></PromptInputFooter></PromptInput>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => { onConversation(false); transition("RETURN"); }}>Return to decision</Button>
    </> : <div ref={decisionBody} className="bob-decision-body">
      <section><h3>Existing problem</h3><h2>{title}</h2><p>{context.node.id} · {context.finding.severity}</p><p>Observed: {context.finding.observed_value == null ? "This is not available in the current model." : display(context.finding.observed_value, context.finding.unit)} · Threshold: {context.finding.threshold == null ? "This is not available in the current model." : display(context.finding.threshold, context.finding.unit)}</p><p>{context.finding.potential_impact}</p><details><summary>Supplied evidence & limitations</summary><ul>{context.finding.evidence.map((e) => <li key={e}>{e}</li>)}</ul><p>Finding confidence: {display(context.finding.confidence)} — data usability, not hazard probability.</p><p>No measured overflow, pipe capacity or safety assessment is supplied by Bob.</p><ul>{[...context.recommendation.uncertainty, ...context.recommendation.data_limitations].map((e, i) => <li key={i}>{e}</li>)}</ul></details></section>
      {phase !== "plan" && phase !== "confirmed" && <section><h3>If no action is taken</h3>{phase === "no-action" ? <p role="status">Running no-action demonstration…</p> : <><p>{noAction?.explanation}</p><ul>{noAction?.consequences.map((item) => <li key={item}>{item}</li>)}</ul></>}</section>}
      {phase !== "no-action" && <section><h3>Proposed solution</h3><p>{result?.intervention ?? (context.finding.category === "bottleneck" ? `Assess storage expansion at ${context.node.id}` : context.finding.category === "overflow" ? `Review downstream connections from ${context.node.id}` : `Review downstream conveyance at ${context.node.id}`)}</p><p>Conceptual engineering review option; demonstrate before deciding.</p>{(phase === "proposed" || phase === "result") && <Button variant="outline" size="sm" disabled={pending} onClick={() => { transition("RUN_SOLUTION"); void demonstrate(result && result.scenarioId !== "NO_ACTION" ? result.scenarioId : proposedBobScenario(context)); }}><Play size={13} />Run Proposed Solution</Button>}</section>}
      {phase === "solution" && <p role="status">Applying mock intervention · running demonstration…</p>}
      {phase === "result" && result && <section><h3>Result · demonstration only</h3><strong>{result.title}</strong><p>{result.explanation}</p></section>}
      {phase === "result" && <section><h3>What Next?</h3><div className="bob-actions"><Button variant="ghost" size="sm" disabled={!result?.supported || result.scenarioId === "NO_ACTION"} onClick={() => transition("APPROVE")}><Check size={13} />Approve</Button><Button variant="ghost" size="sm" onClick={() => { transition("MORE"); onConversation(true); setTurns((previous) => previous.length ? previous : [{ role: "assistant", text: `### Current option\n${result?.intervention}\n\n${result?.title}\n\nSynthetic demonstration only. Canonical constraints remain unchanged.` }]); }}><MessageCircle size={13} />More</Button></div>{!result?.supported && <p>This outcome cannot be approved; review missing data or explore another option.</p>}</section>}
      {phase === "confirmed" && <section><h3>Decision confirmed</h3><p>Added to Review as an action plan. The problem stays active until the authority completes the actions there. Session only; no work has been authorized.</p></section>}
      {phase === "plan" && result && <section className="bob-action-plan bob-action-plan-inline" aria-label="Action plan"><h3>Action plan</h3><strong>{context.node.id} → {result.intervention}</strong><ol>{result.steps.map((step) => <li key={step}>{step}</li>)}</ol><Button variant="outline" size="sm" onClick={() => { onConfirm({ id: `${context.node.id}:${context.finding.id}:${revision.current}`, componentId: context.node.id, problem: title, intervention: result.intervention, outcome: result.title, steps: [...result.steps], status: "Approved · pending", createdAt: new Date().toISOString(), doneSteps: [], source: "mock", priority: true, budget: mockBudgetLabel(result.scenarioId) }); transition("CONFIRM"); }}><Check size={13} />Confirm Decision</Button></section>}
    </div>}
    {error && <div role="alert" className="bob-error"><p>{error}</p><Button variant="outline" size="sm" onClick={() => void demonstrate(phase === "no-action" ? "NO_ACTION" : proposedBobScenario(context), isConversation)}>Retry demonstration</Button></div>}
  </aside>;
}
