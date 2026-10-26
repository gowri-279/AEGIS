import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bot, Check, LogOut, PanelRight, Play, Waves, Wrench } from "lucide-react";
import type { BuildPathKind } from "@/data/buildRequirements";
import { BOB_SEQUENCE } from "@/data/buildAssessment";
import { candidateDesign, connectNodes, placeComponent, TOOLS, updateLink, updateNodePurpose, type CandidateId, type Design, type EditResult, type ToolId } from "@/data/buildWorkspace";
import { DesignCanvas } from "./DesignCanvas";
import { SimulationPrep, SimulationResults, SimulationRunning } from "./SimulationFlow";
import { BobDesignPanel, PropertiesPanel, Toolbox } from "./WorkspacePanels";
import { getBuildDraft, saveBuildDraft } from "@/services/api";
import { getBuildFlow, setBuildFlow } from "./buildFlowStore";

const STEP_MS = 520;

/** Mock-only transition: steps through a fixed sequence, then reveals the workspace. */
export function BobTransition({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= BOB_SEQUENCE.length) { const t = setTimeout(onDone, 500); return () => clearTimeout(t); }
    const t = setTimeout(() => setDone((d) => d + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [done, onDone]);
  return (
    <div className="landing build bw-transition" role="status" aria-live="polite">
      <div className="bw-seq">
        <p className="bs-panel-kicker"><Bot size={13} />05 / Build Workspace</p>
        <h1 className="build-heading">Bob Is Analyzing The AEGIS Context</h1>
        <ol>{BOB_SEQUENCE.map((s, i) => <li key={s} className={i < done ? "is-done" : i === done ? "is-active" : ""}><span>{s}</span><b>{i < done ? <Check size={12} /> : i === done ? "…" : ""}</b></li>)}</ol>
        <div className="bw-bar"><i style={{ width: `${(done / BOB_SEQUENCE.length) * 100}%` }} /></div>
      </div>
    </div>
  );
}

export function BuildWorkspace({ path, showResults = false }: { path: BuildPathKind; showResults?: boolean }) {
  const [ready, setReady] = useState(showResults);
  if (!ready) return <BobTransition onDone={() => setReady(true)} />;
  return <DesignWorkspace path={path} showResults={showResults} />;
}

/** Interactive design workspace — local mock state only; no simulation, persistence or backend. */
export function DesignWorkspace({ path, showResults = false }: { path: BuildPathKind; showResults?: boolean }) {
  const [initial] = useState(() => getBuildDraft(path, getBuildFlow().activeCandidate[path] ?? "A"));
  const [candidate, setCandidate] = useState<CandidateId>(initial.candidate);
  const [design, setDesign] = useState<Design>(initial.design);
  const [tool, setTool] = useState<ToolId>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ title: string; detail: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(initial.simulatedRevision >= 0 && initial.simulatedRevision !== initial.revision);
  const [simQueued, setSimQueued] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [phase, setPhase] = useState<"design" | "prep" | "running" | "results">(showResults ? "results" : "design");
  const [rev, setRev] = useState(initial.revision);
  const [simRev, setSimRev] = useState<number | null>(initial.simulatedRevision >= 0 ? initial.simulatedRevision : showResults ? initial.revision : null);
  const simCurrent = simRev !== null && simRev === rev;
  const bump = () => setRev((r) => r + 1);
  useEffect(() => { setBuildFlow((f) => ({ activeCandidate: { ...f.activeCandidate, [path]: candidate } })); saveBuildDraft({ path, candidate, design, revision: rev, simulatedRevision: simRev ?? -1, notes: getBuildDraft(path, candidate).notes }); }, [path, candidate, design, rev, simRev]);
  const label = `Design ${candidate} · Rev ${rev}`;
  const toolLabel = TOOLS.find((t) => t.id === tool)!.label;

  function commit(r: EditResult) {
    if (!r.ok) { setWarning({ title: r.title, detail: r.detail }); return; }
    setDesign(r.design); setSelected(r.id); setWarning(null); setOutdated(true); setSimQueued(false); bump(); setNotice(`${r.id} added to the draft design.`);
  }
  function pickTool(t: ToolId) { setTool(t); setPendingFrom(null); setWarning(null); setNotice(null); }
  function pickCandidate(c: CandidateId) { const d = getBuildDraft(path, c); setCandidate(c); setDesign(d.design ?? candidateDesign(c, path)); setRev(d.revision + 1); setSimRev(null); setSelected(null); setOutdated(false); setWarning(null); setNotice(null); }
  function onNode(id: string) {
    if (tool === "pipe" || tool === "channel") {
      if (!pendingFrom) { setPendingFrom(id); setWarning(null); setNotice(`Source ${id} selected — choose a destination node.`); return; }
      const r = connectNodes(design, tool, pendingFrom, id); setPendingFrom(null); commit(r); return;
    }
    if (tool === "select") { setSelected(id); setDrawer(true); return; }
    setWarning({ title: "Placement Conflict", detail: "Location already occupied." });
  }
  function onLink(id: string) { if (tool === "select") { setSelected(id); setDrawer(true); } }
  function onCanvas(x: number, y: number) {
    if (tool === "select") { setSelected(null); return; }
    if (tool === "pipe" || tool === "channel") { setNotice(pendingFrom ? "Choose a destination node." : "Choose a source node."); return; }
    commit(placeComponent(design, tool, x, y));
  }
  function apply(patch: { capacity?: number; length?: number; purpose?: string }) {
    if (!selected) return;
    const next = design.links.some((l) => l.id === selected) ? updateLink(design, selected, patch) : updateNodePurpose(design, selected, patch.purpose ?? "");
    setDesign(next); setOutdated(true); setSimQueued(false); bump(); setNotice(`${selected} updated.`);
  }

  if (phase === "running") return <SimulationRunning design={design} onDone={() => { setSimRev(rev); setOutdated(false); setSimQueued(true); setPhase("results"); }} />;
  if (phase === "results") return <SimulationResults path={path} design={candidate} network={design} label={label} outdated={!simCurrent} onBack={() => setPhase("design")} onRerun={() => setPhase("prep")} />;

  return (
    <div className={`bw ${drawer ? "has-drawer" : ""}`}>
      <header className="bw-top">
        <Link to="/" className="landing-brand build-brand" aria-label="AEGIS — Back To Home"><Waves size={15} /><strong>AEGIS</strong><small>Build Network</small></Link>
        <span className="bw-context">{path === "redesign" ? "BLR-SYNTHETIC-01" : "New Network · BLR-SYNTHETIC-02"}</span>
        <span className="bw-status"><i />Design Status: Draft</span>
        <div className="bw-actions">
          {simRev !== null && <button type="button" className="build-link" onClick={() => setPhase("results")}>{simCurrent ? "View Results" : "Last Results (Outdated)"}</button>}
          <button type="button" className="build-link is-primary" onClick={() => setPhase("prep")}><Play size={13} />Run Simulation →</button>
          <Link to="/build" className="build-link"><LogOut size={13} />Exit Build</Link>
          <button type="button" className="build-link bw-drawer-btn" aria-label="Toggle Bob panel" onClick={() => setDrawer(!drawer)}><PanelRight size={13} /></button>
        </div>
      </header>
      <Toolbox tool={tool} onTool={pickTool} />
      <main className="bw-canvas">
        <div className="bw-canvas-head">
          <span className={`bw-mode ${tool !== "select" ? "is-placing" : ""}`}><Wrench size={12} />{tool === "select" ? "Select" : `Place ${toolLabel}`}{pendingFrom && ` · From ${pendingFrom}`}</span>
          <span className="bw-cand-label">Showing Design {candidate}{outdated ? " · Engineer Modified" : ""}</span>
        </div>
        {outdated && <div className="bw-outdated" role="status"><AlertTriangle size={14} /><div><b>Simulation Outdated</b><span>Design has changed since the last analysis.</span></div>
          <button type="button" className="build-link is-primary" onClick={() => setPhase("prep")}><Play size={12} />{simRev !== null ? "Run Simulation Again →" : "Run Simulation →"}</button></div>}
        {warning && <div className="bw-conflict" role="alert"><b>{warning.title}</b><span>{warning.detail}</span></div>}
        {notice && !warning && <div className="bw-notice" role="status">{notice}</div>}
        <DesignCanvas design={design} tool={tool} selectedId={selected} pendingFrom={pendingFrom} onSelectNode={onNode} onSelectLink={onLink} onCanvasClick={onCanvas} onSnap={(x, y) => commit(placeComponent(design, tool, x, y))} />
        <div className="bt-legend bw-legend"><span><i className="lg-node" /><b>Existing</b></span><span><i className="lg-proposed" /><b>Proposed</b></span><span><i className="lg-flow" /><b>Flow Direction</b></span><span><i className="lg-bottleneck" /><b>Bottleneck</b></span><span><i className="lg-protected" /><b>Protected Area</b></span><span><i className="lg-low" /><b>Low Point</b></span></div>
      </main>
      <aside className="bw-right" aria-label="Bob intelligence">
        {selected ? <PropertiesPanel design={design} id={selected} onBack={() => setSelected(null)} onApply={apply} /> : <BobDesignPanel active={candidate} onPick={pickCandidate} />}
      </aside>
      {phase === "prep" && <SimulationPrep design={design} label={label} onCancel={() => setPhase("design")} onStart={() => setPhase("running")} />}
    </div>
  );
}
