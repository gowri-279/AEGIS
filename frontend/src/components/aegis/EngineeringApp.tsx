import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, Bot, ListTree, Loader2, Radar, PanelLeftClose, Network as NetIcon, Play, ShieldCheck, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCanonicalResponse, getHealthFindings, getSimBobReply, runScenario } from "@/services/api";
import type { CanonicalResponse, RiskFinding } from "@/data/types";
import { cn } from "@/lib/utils";
import { nodeRisks, resolveTarget, severityTone, strongestTone } from "@/lib/aegis";
import { NetworkInventory } from "./NetworkInventory";
import { ComponentProfile } from "./ComponentProfile";
import { useNetworkSelection } from "./useNetworkSelection";
import { BobNavigator } from "./BobNavigator";
import { BobPanel } from "./bob/BobPanel";
import { NetworkCanvas } from "./workspace/NetworkCanvas";
import { ReviewPanel, SimulatePanel, type SimInput } from "./workspace/ModePanels";
import { SCENARIOS, type WorkspaceMode } from "./workspace/types";
import { useDiagnosticScan } from "./workspace/useDiagnosticScan";
import { HealthProblemPanel } from "./workspace/HealthProblemPanel";
import { HealthBob } from "./bob/HealthBob";
import type { SimBobReply } from "@/data/simBob";
import { createHealthBobContext } from "@/data/healthBob";
import type { FixtureId } from "@/data/mockCanonicalResponse";
import { type BobDecision, type BobVisualScenario } from "@/data/bobInterventions";
import { problemName } from "./workspace/HealthProblemMarkers";
import { simulationPlan } from "@/data/simulationPlans";

const MODES: { id: WorkspaceMode; label: string; icon: typeof NetIcon; caption: string }[] = [
  { id: "network", label: "Network", icon: NetIcon, caption: "Topology & Components" },
  { id: "health", label: "Health", icon: Activity, caption: "Reliability & Findings" },
  { id: "simulate", label: "Simulate", icon: Play, caption: "Scenario → Evaluation → Result" },
  { id: "review", label: "Review", icon: ShieldCheck, caption: "Recommendation & Limitations" },
];

export function EngineeringApp() {
  const [data, setData] = useState<CanonicalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("network");
  const { selectedId: selected, selectionRevision, select: setSelected } = useNetworkSelection();
  const [scenarioId, setScenarioId] = useState("standard");
  const [simPhase, setSimPhase] = useState<"idle" | "running" | "done">("idle");
  const [simInput, setSimInput] = useState<SimInput>("scenario");
  const [bobAnswer, setBobAnswer] = useState<SimBobReply | null>(null);
  const [bobPending, setBobPending] = useState(false);
  const { phase: healthPhase, startedAt: scanStartedAt, scan } = useDiagnosticScan();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [bobOpen, setBobOpen] = useState(false);
  const [healthFindings, setHealthFindings] = useState<{ fixtureId: string; risks: RiskFinding[] } | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  const [bobVisual, setBobVisual] = useState<BobVisualScenario | null>(null);
  const [, setBobConversation] = useState(false);
  const [decisions, setDecisions] = useState<BobDecision[]>([]);
  // Session-only: a component's findings resolve only when the authority completes
  // every action of its plan in Review — never when Bob's solution is approved.
  const [resolvedNodeIds, setResolvedNodeIds] = useState<string[]>([]);
  const confirmBobDecision = useCallback((decision: BobDecision) => {
    setDecisions((previous) => [...previous.filter((item) => item.id !== decision.id), decision]);
    setSelectedFindingId(null); setBobOpen(false); setBobVisual(null); setBobConversation(false);
  }, []);
  const togglePlanStep = useCallback((planId: string, stepIndex: number) => {
    setDecisions((previous) => previous.map((plan) => {
      if (plan.id !== planId || plan.status !== "Approved · pending") return plan;
      const done = plan.doneSteps.includes(stepIndex) ? plan.doneSteps.filter((item) => item !== stepIndex) : [...plan.doneSteps, stepIndex];
      const completed = done.length === plan.steps.length;
      if (completed) setResolvedNodeIds((ids) => ids.includes(plan.componentId) ? ids : [...ids, plan.componentId]);
      else setResolvedNodeIds((ids) => ids.filter((id) => id !== plan.componentId));
      return { ...plan, doneSteps: done, status: completed ? "Completed · resolved" : "Approved · pending" };
    }));
  }, []);
  const closeHealthBob = useCallback(() => { setBobOpen(false); setBobVisual(null); setBobConversation(false); }, []);
  /** Accepting a simulation recommendation creates a normal (non-priority)
   *  action plan in Review, carrying the supplied simulation values. */
  const acceptRecommendation = useCallback(() => {
    if (!data) return;
    if (simPhase !== "done") return;
    const decision = simulationPlan(data, data.simulation.scenario_option_id ?? scenarioId, new Date().toISOString());
    if (!decision) return;
    setDecisions((previous) => [...previous.filter((item) => item.id !== decision.id), decision]);
    setMode("review");
  }, [data, simPhase, scenarioId]);
  useEffect(() => { setBobVisual(null); setBobConversation(false); setBobOpen(false); setBobAnswer(null); }, [mode, selectedFindingId]);

  async function runHealthScan() {
    if (!data) return;
    if (selectedFindingId) setSelected(null);
    setSelectedFindingId(null);
    scan();
    setHealthFindings(null);
    try { setHealthFindings({ fixtureId: data.fixture_id, risks: await getHealthFindings(data.fixture_id) }); }
    catch { setError("Health findings could not be loaded."); }
  }

  useEffect(() => {
    getCanonicalResponse("standard").then(setData).catch(() => setError("Canonical response could not be loaded."));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelectedFindingId(null); setSelected(null); setControlsOpen(false); setBobOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSelected]);

  const select = useCallback((id: string | null) => { setSelectedFindingId(null); setSelected(id && data ? resolveTarget(data, id) : id); }, [data, setSelected]);

  async function runFixture(fixture: FixtureId, scenarioOptionId = scenarioId) {
    setSimPhase("running");
    setBobVisual(null);
    try { setData(await runScenario({ fixture, scenarioOptionId })); setSimPhase("done"); }
    catch { setError("Scenario run failed."); setSimPhase("idle"); }
  }

  async function simulate() {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;
    setBobAnswer(null);
    await runFixture(scenario.fixture, scenario.id);
  }

  /** Bob question → mock interpretation → same simulation pipeline (fixture or
   *  authored visual) → Evaluation/Result sections + terrain update. */
  async function askSimBob(question: string) {
    if (!data || bobPending) return;
    setBobPending(true);
    try {
      const reply = await getSimBobReply(question, data);
      setBobAnswer(reply);
      if (reply.fixture) {
        const optionId = reply.scenarioOptionId ?? scenarioId;
        setScenarioId(SCENARIOS.find((item) => item.id === optionId)?.id ?? scenarioId);
        await runFixture(reply.fixture, optionId);
      }
      if (reply.visual) setBobVisual({ scenarioId: "BOB_WHAT_IF", ...reply.visual, running: false, revision: 0 });
    } catch { setError("Bob's mock simulation reply could not be loaded."); }
    finally { setBobPending(false); }
  }

  function activeHealthData(source: CanonicalResponse): CanonicalResponse {
    const scoped = healthFindings?.fixtureId === source.fixture_id ? { ...source, risks: healthFindings.risks } : source;
    if (resolvedNodeIds.length === 0) return scoped;
    const resolved = new Set(scoped.network.nodes.filter((node) => resolvedNodeIds.includes(node.id)).flatMap((node) => nodeRisks(scoped, node).map((risk) => risk.id)));
    return { ...scoped, risks: scoped.risks.filter((risk) => !resolved.has(risk.id)) };
  }

  const healthBobContext = useMemo(() => {
    if (!data || mode !== "health" || healthPhase !== "done") return null;
    const scoped = activeHealthData(data);
    const finding = scoped.risks.find((risk) => risk.id === selectedFindingId);
    const node = data.network.nodes.find((item) => item.id === selected);
    return finding && node && nodeRisks(scoped, node).some((risk) => risk.id === finding.id) ? createHealthBobContext(scoped, node, finding) : null;
  }, [data, mode, healthPhase, healthFindings, selectedFindingId, selected, resolvedNodeIds]);

  if (error && !data) return <div className="ws-loading"><AlertTriangle size={18} /><span>{error}</span></div>;
  if (!data) return <div className="ws-loading"><span className="ws-loading-mark">AEGIS</span><small>Loading canonical network response…</small></div>;

  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  if (!current) return null;
  const bobMode = bobOpen && !!healthBobContext && mode === "health";
  const analytical = mode === "health" || mode === "simulate";
  const expanded = analytical && controlsOpen;
  const healthData = activeHealthData(data);
  const inspectedFinding = mode === "health" && healthPhase === "done" ? healthData.risks.find((finding) => finding.id === selectedFindingId) : undefined;
  const inspectedNode = inspectedFinding ? data.network.nodes.find((node) => node.id === selected && nodeRisks(healthData, node).some((finding) => finding.id === inspectedFinding.id)) : undefined;
  const inspectingProblem = !!(inspectedFinding && inspectedNode);
  const inspectProblem = (findingId: string) => {
    if (mode !== "health" || healthPhase !== "done") return;
    const node = data.network.nodes.find((node) => nodeRisks(healthData, node).some((finding) => finding.id === findingId));
    if (!node) return;
    setSelectedFindingId(findingId);
    setSelected(node.id);
    setControlsOpen(false);
  };
  const stepProblem = (delta: number) => {
    const problemNodes = data.network.nodes.filter((node) => nodeRisks(healthData, node).length > 0);
    if (problemNodes.length === 0) return;
    const count = problemNodes.length;
    const index = problemNodes.findIndex((node) => node.id === selected);
    const next = problemNodes[(((index + delta) % count) + count) % count];
    if (!next) return;
    const findings = nodeRisks(healthData, next);
    const strongest = strongestTone(findings.map((finding) => severityTone[finding.severity]));
    const finding = findings.find((candidate) => severityTone[candidate.severity] === strongest) ?? findings[0];
    if (!finding) return;
    inspectProblem(finding.id);
  };
  const nextProblem = () => stepProblem(1);
  const previousProblem = () => stepProblem(-1);


  return (
    <div className="ws" data-mode={mode} data-analysis-expanded={expanded} data-health-inspecting={inspectingProblem} data-bob-mode={bobMode}>
      <header className="ws-header">
        <Button variant="ghost" className="ws-brand" asChild><Link to="/" aria-label="AEGIS — Back To Home">
          <span className="ws-brand-mark"><Waves size={16} /></span>
          <span><strong>AEGIS</strong><small>Stormwater Network Decision Support</small></span>
        </Link></Button>
        <nav className="ws-modes" aria-label="Modes">
          {MODES.map((m) => (
            <Button variant="ghost" key={m.id} className={cn(mode === m.id && "is-active")} aria-label={m.label} aria-current={mode === m.id ? "page" : undefined} onClick={() => { setSelectedFindingId(null); setMode(m.id); setControlsOpen(m.id !== "network" && m.id !== "health"); }}>
              <m.icon size={14} /><span>{m.label}</span>
            </Button>
          ))}
        </nav>
        {mode !== "review" && <div className="ws-header-status">
          <span className="ws-synthetic">Synthetic · Illustrative</span>
        </div>}
      </header>

      {mode === "review" ? <main className="review-workspace">
        <aside className="review-workspace-body" aria-label="Review controls">
          <ReviewPanel data={healthData} onSelect={select} plans={decisions} onToggleStep={togglePlanStep} />
        </aside>
      </main> : <>
      <div className="twin-dock" aria-label="Context tools">
        {mode === "health" ? <Button variant="outline" size="sm" onClick={runHealthScan} disabled={healthPhase === "scanning"}>{healthPhase === "scanning" ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}{healthPhase === "scanning" ? "Scanning…" : "Run Health Scan"}</Button> : <Button variant="outline" size="sm" aria-expanded={controlsOpen} aria-controls="twin-controls" onClick={() => { setControlsOpen((open) => !open); if (mode === "network") setBobOpen(false); }}><ListTree size={14} />{mode === "network" ? "Inventory" : current.label}</Button>}
        <Button variant="outline" size="sm" aria-expanded={mode === "simulate" ? controlsOpen && simInput === "bob" : bobOpen} aria-controls="twin-bob" onClick={() => { if (mode === "simulate") { setSimInput("bob"); setControlsOpen(true); } else { setBobOpen((open) => !open); if (mode === "network") setControlsOpen(false); } }}><Bot size={14} />Bob</Button>
      </div>
      <aside id="twin-controls" className={cn("ws-left twin-overlay", analytical && "analysis-panel")} hidden={!controlsOpen} aria-label={`${current.label} controls`}>
        <div className="ws-left-head"><div><span>{current.label}</span><small>{current.caption}</small></div><Button variant="ghost" size="icon" aria-label={analytical ? `Minimize ${current.label} panel` : "Close controls"} title={analytical ? `Minimize ${current.label} panel` : "Close controls"} onClick={() => setControlsOpen(false)}>{analytical ? <PanelLeftClose size={16} /> : <X size={16} />}</Button></div>
        <div className="ws-left-body">
          {mode === "network" && <NetworkInventory data={data} selectedId={selected} onSelect={select} />}
           {mode === "simulate" && <SimulatePanel data={data} scenarioId={scenarioId} setScenarioId={(id) => { setScenarioId(id); setSimPhase("idle"); setBobAnswer(null); setBobVisual(null); }} phase={simPhase} onRun={simulate} onSelect={select} input={simInput} setInput={setSimInput} bobAnswer={bobAnswer} bobPending={bobPending} onBobAsk={(question) => void askSimBob(question)} onAcceptRecommendation={acceptRecommendation} />}
        </div>
      </aside>

      <main className="ws-canvas">
        <div className="ws-canvas-caption">
          <span>{data.network.network_id}</span><small>{current.caption} · layout is schematic, not geographic</small>
        </div>
        <NetworkCanvas data={mode === "health" ? healthData : data} mode={mode} selectedId={selected} selectionRevision={selectionRevision} onSelect={select} healthPhase={healthPhase} scanStartedAt={scanStartedAt} simPhase={simPhase} selectedFindingId={inspectingProblem ? selectedFindingId : null} onSelectHealthFinding={inspectProblem} bobVisual={mode === "health" || mode === "simulate" ? bobVisual : null} bobSignal={healthBobContext && !bobOpen ? { title: problemName(healthBobContext.finding, healthBobContext.node.id), severity: healthBobContext.finding.severity, onOpen: () => setBobOpen(true) } : null} />
        {bobOpen && mode === "health" && (healthBobContext ? <HealthBob key={`${data.fixture_id}:${healthBobContext.node.id}:${healthBobContext.finding.id}`} context={healthBobContext} onClose={closeHealthBob} onVisual={setBobVisual} onConversation={setBobConversation} onConfirm={confirmBobDecision} /> : <aside id="twin-bob" className="health-bob health-bob-empty twin-overlay" aria-label="Contextual Bob"><header className="health-bob-head"><Bot size={14} /><strong>Bob</strong><Button variant="ghost" size="icon" aria-label="Close Bob" title="Close Bob" onClick={() => setBobOpen(false)}><X size={16} /></Button></header><p>{healthPhase === "done" ? "Select a problem to view its synthetic analysis." : "No scanned problem selected."}</p></aside>)}
      </main>

      {!bobMode && inspectedNode && inspectedFinding && <HealthProblemPanel data={data} node={inspectedNode} finding={inspectedFinding} onClose={() => { setSelectedFindingId(null); setSelected(null); }} onNextProblem={nextProblem} onPreviousProblem={previousProblem} />}
      {!bobMode && selected && <aside className={cn("ws-right twin-overlay", expanded && "analysis-inspector")} aria-label="Inspector">
        {mode === "health" && resolvedNodeIds.includes(selected) && <p className="health-resolved-note" role="status">Health status: <strong>Resolved</strong> · decision approved in Review (session only)</p>}
        <ComponentProfile data={mode === "health" ? healthData : data} id={selected} onClose={() => { setSelectedFindingId(null); setSelected(null); }} />
      </aside>}
       <aside id={mode === "network" ? "twin-bob" : undefined} className="ws-left network-bob twin-overlay" hidden={!bobOpen || mode !== "network"} aria-label="Bob network navigator panel">
        <div className="twin-bob-close"><Button variant="ghost" size="icon" title="Close Bob" aria-label="Close Bob" onClick={() => setBobOpen(false)}><X size={16} /></Button></div>
         <div className="ws-left-body"><BobNavigator data={data} onSelect={select} /></div>
      </aside>
      </>}
      {error && <div className="twin-error" role="alert">{error}<Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={() => setError(null)}><X size={14} /></Button></div>}

    </div>
  );
}
