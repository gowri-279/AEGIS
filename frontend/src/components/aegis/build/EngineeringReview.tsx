import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Minus, PanelRight, Play, Save, Trash2, Undo2, Waves, Wrench, X } from "lucide-react";
import type { BuildPathKind } from "@/data/buildRequirements";
import { connectNodes, KIND_LABEL, placeComponent, TOOLS, updateLink, WS_CANDIDATES, type CandidateId, type Design, type EditResult, type ToolId } from "@/data/buildWorkspace";
import { designChanges, removeProposed, REVIEW_CHECKLIST, REVIEW_PURPOSE, REVIEW_STEPS, reviewMetrics, updateProposedNode } from "@/data/buildReview";
import { OVERALL_RELIABILITY, SIM_META } from "@/data/buildSimulation";
import { canConfirmFinalization, FINAL_RESULTS, FINALIZE_SEQUENCE, NETWORK_SEQUENCE } from "@/data/buildFinalize";
import { DesignCanvas } from "./DesignCanvas";
import { SimulationPrep, SimulationRunning } from "./SimulationFlow";
import { addFinalizedBuildNetwork, finalizeBuildOnBackend, getBuildDraft, saveBuildDraft } from "@/services/api";
import { useBuildFlow } from "./buildFlowStore";

function ReviewProperties({ design, id, onApply, onRemove, onClose }: { design: Design; id: string; onApply: (d: Design) => void; onRemove: () => void; onClose: () => void }) {
  const node = design.nodes.find((n) => n.id === id); const link = design.links.find((l) => l.id === id);
  const proposed = node?.proposed ?? link?.proposed ?? false;
  const initRows = (): [string, string][] => node ? (node.props.length ? node.props : [["Elevation", ""], ["Capacity", ""]]) : [];
  const [rows, setRows] = useState<[string, string][]>(initRows);
  const [cap, setCap] = useState(String(link?.capacity ?? "")); const [len, setLen] = useState(String(link?.length ?? ""));
  const [purpose, setPurpose] = useState(node?.purpose ?? link?.purpose ?? "");
  useEffect(() => { setRows(initRows()); setCap(String(link?.capacity ?? "")); setLen(String(link?.length ?? "")); setPurpose(node?.purpose ?? link?.purpose ?? ""); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!node && !link) return null;
  const kind = node ? KIND_LABEL[node.kind] : KIND_LABEL[link!.kind];
  const readRows: [string, string][] = node ? node.props : link!.props ?? [];
  return <div className="er-props">
    <div className="er-props-head"><div className="bw-prop-head"><strong>{id}</strong><span className={proposed ? "is-proposed" : ""}>{proposed ? `Proposed ${kind}` : `Existing ${kind}`}</span></div>
      <button type="button" className="sim-close" aria-label="Close properties" onClick={onClose}><X size={13} /></button></div>
    {link && <dl className="bs-stats"><div><dt>From</dt><dd>{link.from}</dd></div><div><dt>To</dt><dd>{link.to}</dd></div></dl>}
    {proposed ? <form className="bw-form" onSubmit={(e) => {
      e.preventDefault();
      onApply(link ? updateLink(design, id, { capacity: Number(cap) || link.capacity, length: Number(len) || link.length, purpose }) : updateProposedNode(design, id, rows.filter(([, v]) => v.trim()), purpose));
    }}>
      {node && rows.map(([k, v], i) => <label key={k}>{k}<input value={v} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [k, e.target.value] : r)))} /></label>)}
      {link && <><label>Capacity<input type="number" min={20} max={300} value={cap} onChange={(e) => setCap(e.target.value)} /></label>
        <label>Length (m)<input type="number" min={10} value={len} onChange={(e) => setLen(e.target.value)} /></label></>}
      <label>Purpose<textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
      <label>Status<input value="Proposed" readOnly /></label>
      <div className="er-row"><button type="submit" className="build-link is-primary">Apply Change</button><button type="button" className="build-link er-danger" onClick={onRemove}><Trash2 size={12} />Remove</button></div>
    </form> : <>
      {readRows.length > 0 && <dl className="bs-stats">{readRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={/High|Stale|Near/.test(v) ? "is-warn" : ""}>{v}</dd></div>)}</dl>}
      <p className="bs-note">Existing infrastructure · protected · read only.</p>
      <button type="button" className="build-link er-danger" onClick={onRemove}><Trash2 size={12} />Remove</button>
    </>}
  </div>;
}

type ReviewPhase = "review" | "prep" | "running" | "confirm" | "finalizing" | "adding" | "added";

/** Mock-only staged sequence (finalizing / network update). */
function Sequence({ title, stages, onDone }: { title: string; stages: string[]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= stages.length) { const t = setTimeout(onDone, 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setStep((s) => s + 1), 380);
    return () => clearTimeout(t);
  }, [step, stages.length, onDone]);
  return <div className="landing build sim-running" role="status" aria-live="polite">
    <div className="sim-run-card bw-seq">
      <p className="bs-panel-kicker"><Waves size={13} />{title}</p>
      <h1 className="build-heading">{step >= stages.length ? stages[stages.length - 1] : `${stages[step]}…`}</h1>
      <ol>{stages.map((s, i) => <li key={s} className={i < step ? "is-done" : i === step ? "is-active" : ""}><span>{s}</span><b>{i < step ? <Check size={12} /> : i === step ? "…" : ""}</b></li>)}</ol>
      <div className="bw-bar"><i style={{ width: `${(step / stages.length) * 100}%` }} /></div>
    </div>
  </div>;
}

export function EngineeringReview({ path, design: candidateId }: { path: BuildPathKind; design: CandidateId }) {
  const cand = WS_CANDIDATES.find((c) => c.id === candidateId)!;
  const bobEnrich = useBuildFlow().bobCandidates[candidateId];
  const title = `Design ${cand.id} — ${cand.subtitle}`;
  const [design, setDesign] = useState<Design>(() => getBuildDraft(path, candidateId).design);
  const [simulated, setSimulated] = useState<Design>(() => getBuildDraft(path, candidateId).design);
  const [history, setHistory] = useState<Design[]>([]);
  const [revision, setRevision] = useState(() => getBuildDraft(path, candidateId).revision);
  const [simRevision, setSimRevision] = useState(() => getBuildDraft(path, candidateId).simulatedRevision);
  const [resims, setResims] = useState(0);
  const [phase, setPhase] = useState<ReviewPhase>("review");
  const [tool, setTool] = useState<ToolId>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ title: string; detail: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState(() => getBuildDraft(path, candidateId).notes);
  const [drawer, setDrawer] = useState(false);
  const [approved, setApproved] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const networkId = path === "redesign" ? "BLR-SYNTHETIC-01" : "BLR-SYNTHETIC-02";
  useEffect(() => { saveBuildDraft({ path, candidate: candidateId, design, revision, simulatedRevision: simRevision, notes }); }, [path, candidateId, design, revision, simRevision, notes]);

  const changes = designChanges(simulated, design);
  const outdated = revision !== simRevision;
  const modified = revision > 0;
  const metrics = reviewMetrics(candidateId, resims);
  const conflict = warning && /Conflict/.test(warning.title) ? warning : null;
  const toolLabel = TOOLS.find((t) => t.id === tool)!.label;

  function change(next: Design, id?: string, msg?: string) {
    setHistory((h) => [...h, design]); setDesign(next); setRevision((r) => r + 1); setWarning(null);
    if (id !== undefined) setSelected(id);
    if (msg) setNotice(msg);
  }
  function commit(r: EditResult) { if (!r.ok) { setWarning({ title: r.title, detail: r.detail }); return; } change(r.design, r.id, `${r.id} added.`); }
  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1)); setDesign(prev); setRevision((r) => r + 1); setSelected(null); setWarning(null); setNotice("Last change undone.");
  }
  function remove(id: string) {
    const r = removeProposed(design, id);
    if (!r.ok) { setWarning({ title: r.title, detail: r.detail }); return; }
    setSelected(null); change(r.design, undefined, `${id} removed.`);
  }
  function onNode(id: string) {
    if (tool === "pipe" || tool === "channel") {
      if (!pendingFrom) { setPendingFrom(id); setNotice(`Source ${id} selected — choose a destination node.`); return; }
      const r = connectNodes(design, tool, pendingFrom, id); setPendingFrom(null); commit(r); return;
    }
    if (tool === "select") { setSelected(id); setDrawer(true); return; }
    setWarning({ title: "Placement Conflict", detail: "Location already occupied." });
  }
  function onCanvas(x: number, y: number) {
    if (tool === "select") { setSelected(null); return; }
    if (tool === "pipe" || tool === "channel") { setNotice(pendingFrom ? "Choose a destination node." : "Choose a source node."); return; }
    commit(placeComponent(design, tool, x, y));
  }

  if (phase === "running") return <SimulationRunning path={path} candidate={candidateId} revision={revision} design={design} onDone={() => { setSimulated(design); setSimRevision(revision); setResims((n) => n + 1); setPhase("review"); setNotice("Simulation complete · results updated (Simulated Values)."); }} />;
  if (phase === "finalizing") return <Sequence title="Finalizing Design" stages={FINALIZE_SEQUENCE} onDone={() => setPhase("adding")} />;
  if (phase === "adding") return <Sequence title="AEGIS Network Update" stages={NETWORK_SEQUENCE} onDone={() => {
    try {
      const draft = { path, candidate: candidateId, design, revision, simulatedRevision: simRevision, notes };
      // Guard: finalized topology must be the applied active design, never a silent revert.
      const currentIds = design.nodes.map((n) => n.id).sort().join(",");
      const simulatedIds = simulated.nodes.map((n) => n.id).sort().join(",");
      if (currentIds !== simulatedIds || revision !== simRevision) {
        throw new Error("Finalize requires the exact simulated active design. Re-run simulation after Apply Change.");
      }
      const entry = addFinalizedBuildNetwork(draft, true, 0);
      void finalizeBuildOnBackend(draft, entry.id);
      setPhase("added");
    }
    catch (error) { setHandoffError(error instanceof Error ? error.message : "Network update could not be completed."); setPhase("review"); }
  }} />;
  if (phase === "added") return (
    <div className="landing build sim-running">
      <div className="sim-run-card bw-seq">
        <p className="bs-panel-kicker"><Check size={13} />Network Update Complete</p>
        <h1 className="build-heading">Design Added To AEGIS Network</h1>
        <dl className="sim-kv">
          <div><dt>Network</dt><dd>{networkId}</dd></div>
          <div><dt>Network Status</dt><dd>{path === "new" ? "New · Active" : "Updated · Active"}</dd></div>
          <div><dt>Design Revision</dt><dd>R{revision}</dd></div>
          <div><dt>Components / Conduits</dt><dd>{design.nodes.length} / {design.links.length}</dd></div>
        </dl>
        <div className="sim-modal-actions"><Link to="/monitor" className="build-link is-primary">Open Updated Network In Monitor <ArrowRight size={13} /></Link></div>
      </div>
    </div>
  );

  const status: [string, string, "ok" | "warn" | "crit" | ""][] = [
    ["Terrain", "Analyzed", "ok"], ["Network", "Valid", "ok"],
    ["Design", modified ? "Engineer Modified" : "Bob Proposed", modified ? "warn" : ""],
    ["Simulation", outdated ? "Outdated" : "Current", outdated ? "warn" : "ok"],
    
  ];

  return (
    <div className={`bw er ${drawer ? "has-drawer" : ""}`}>
      <header className="bw-top">
        <Link to="/" className="landing-brand build-brand" aria-label="AEGIS — Back To Home"><Waves size={15} /><strong>AEGIS</strong><small>Engineering Review</small></Link>
        <span className="bw-context">Synthetic Illustrative</span>
        <span className="er-rev">Revision <b>R{revision}</b></span>
        <div className="bw-actions">
          <Link to="/build/workspace" search={{ path, view: "results" }} className="build-link"><ArrowLeft size={13} />Back To Simulation</Link>
          <button type="button" className="build-link bw-drawer-btn" aria-label="Toggle properties panel" onClick={() => setDrawer(!drawer)}><PanelRight size={13} /></button>
        </div>
      </header>
      <div className="er-intro">
        <div><h1 className="build-heading">Engineering Review</h1><p className="sim-caption">Review, modify and prepare the selected design for finalization.</p></div>
      </div>

      <aside className="bw-left er-left" aria-label="Design review">
        <p className="bs-panel-kicker">Design Review</p>
        <div className="bw-prop-head"><strong>Design {cand.id}</strong><span>{cand.subtitle}{cand.recommended ? " · Recommended" : ""}</span></div>
        <p className="bs-note">{bobEnrich?.rationale ?? REVIEW_PURPOSE}</p>
        {bobEnrich?.reliability_considerations && <p className="bs-note">{bobEnrich.reliability_considerations}</p>}
        <p className="bw-group">Design Performance <em className="er-sim">Simulated Values</em></p>
        <dl className="bs-stats">{metrics.map(([k, v]) => <div key={k}><dt>{k === "Construction" ? k : k}</dt><dd>{v}</dd></div>)}</dl>
        <p className="bw-group">Engineering Checklist</p>
        <ul className="er-check">{REVIEW_CHECKLIST.map((c) => <li key={c}><Check size={12} />{c}</li>)}</ul>
        <p className="bw-group">Data Quality</p>
        <dl className="bs-stats"><div><dt>Sensor Reliability</dt><dd>{OVERALL_RELIABILITY}%</dd></div><div><dt>Simulation Confidence</dt><dd>{SIM_META.confidence}%</dd></div><div><dt>L2 Observation</dt><dd className="is-warn">Stale</dd></div></dl>
      </aside>

      <main className="bw-canvas er-canvas">
        <div className="er-editbar">
          <div><b>Engineer Edit Mode</b><span className="er-on">Editing Enabled</span><small>Bob-generated design. Engineer modifications are allowed before finalization.</small></div>
          <div className="er-row">
            <span className={`bw-mode ${tool !== "select" ? "is-placing" : ""}`}><Wrench size={12} />{tool === "select" ? "Select" : `Place ${toolLabel}`}{pendingFrom && ` · From ${pendingFrom}`}</span>
            {selected && <button type="button" className="build-link er-danger" onClick={() => remove(selected)}><Minus size={12} />Remove Selected</button>}
            <button type="button" className="build-link" disabled={!history.length} onClick={undo}><Undo2 size={12} />Undo Last Change</button>
            <button type="button" className="build-link" onClick={() => setNotice(`Design changes saved for this session · R${revision}.`)}><Save size={12} />Save Design Changes</button>
          </div>
        </div>
        <div className={`bw-outdated er-simstatus ${outdated ? "" : "is-current"}`} role="status">
          {outdated ? <AlertTriangle size={14} /> : <Check size={14} />}
          <div><b>{outdated ? "Simulation Outdated" : "Simulation Current"}</b><span>{outdated ? "Design changed after the last simulation. Results must be recalculated before finalization." : `Simulation Complete · Confidence: ${SIM_META.confidence}%`}</span></div>
          {outdated && <button type="button" className="build-link is-primary" onClick={() => setPhase("prep")}><Play size={12} />Run Simulation Again →</button>}
        </div>
        {warning && <div className="bw-conflict" role="alert"><b>{warning.title}</b><span>{warning.detail}</span></div>}
        {notice && !warning && <p className="bw-notice" role="status">{notice}</p>}
        <DesignCanvas design={design} tool={tool} selectedId={selected} pendingFrom={pendingFrom} onSelectNode={onNode} onSelectLink={(id) => { if (tool === "select") { setSelected(id); setDrawer(true); } }} onCanvasClick={onCanvas} onSnap={(x, y) => commit(placeComponent(design, tool, x, y))} />
      </main>

      <aside className="bw-right er-right" aria-label="Component properties and engineering intelligence">
        {selected && <ReviewProperties design={design} id={selected} onApply={(d) => change(d, selected, `${selected} updated.`)} onRemove={() => remove(selected)} onClose={() => setSelected(null)} />}
        <section className="er-sec">
          <p className="bs-panel-kicker">Final Simulation Result</p>
          <dl className="bs-stats">{FINAL_RESULTS.map(([k, a, b, d]) => <div key={k}><dt>{k}</dt><dd>{a} → <b>{b}</b>{d ? ` (${d})` : ""}</dd></div>)}</dl>
          <dl className="bs-stats"><div><dt>Sensor Reliability</dt><dd>{OVERALL_RELIABILITY}%</dd></div><div><dt>Simulation Status</dt><dd className={outdated ? "is-warn" : ""}>{outdated ? "Outdated — Re-run Required" : "Current"}</dd></div></dl>
          {modified && changes.length > 0 && <p className="er-flag is-warn"><b>Design Modified By Engineer</b>Results reflect the latest simulated revision of the current engineer-modified design.</p>}
          <p className="bs-note">Simulated outcome for the current canonical design.</p>
        </section>
        {changes.length > 0 && <section className="er-sec">
          <p className="bw-group">Design Changes</p>
          <ul className="er-changes">{changes.map((c) => <li key={`${c.sign}${c.id}`} className={`is-${c.sign === "+" ? "add" : c.sign === "−" ? "rem" : "mod"}`}><b>{c.sign} {c.id}</b><span>{c.label}</span></li>)}</ul>
          <dl className="bs-stats"><div><dt>Last Simulated Design</dt><dd>{simRevision === 0 ? `Design ${cand.id} — Baseline Version` : `Engineer Revision ${String(simRevision).padStart(2, "0")}`}</dd></div><div><dt>Current Design</dt><dd>Engineer Revision {String(revision).padStart(2, "0")}</dd></div></dl>
        </section>}
        <section className="er-sec">
          <label className="bw-group" htmlFor="er-notes">Engineer Notes</label>
          <textarea id="er-notes" className="er-notes" rows={3} value={notes} placeholder="Record reasoning or modifications before finalization..." onChange={(e) => setNotes(e.target.value)} />
        </section>
        <section className="er-sec er-final">
          <p className="bw-group">Current Design Status</p>
          <p className="er-final-title">Design {cand.id} — Engineer Review</p>
          <div className="er-row">
            <button type="button" className="build-link" onClick={() => setNotice(`Design saved for this session · R${revision}. Nothing is persisted.`)}><Save size={12} />Save Design</button>
            <button type="button" className="build-link is-primary" disabled={outdated} onClick={() => setPhase("confirm")}>Finalize Design <ArrowRight size={13} /></button>
          </div>
          {outdated && <small className="er-block">Run simulation again before finalization.</small>}
          {handoffError && <small className="er-block" role="alert">{handoffError}</small>}
        </section>
      </aside>

      <footer className="bw-statusbar"><div>{status.map(([k, v, t]) => <span key={k}><b>{k}</b><i className={t ? `is-${t}` : ""}>{v}</i></span>)}</div><div><span><b>Revision</b><i>R{revision}</i></span></div></footer>
      {phase === "prep" && <SimulationPrep design={design} label={`Design ${candidateId} · Rev ${revision}`} onCancel={() => setPhase("review")} onStart={() => setPhase("running")} />}
      {phase === "confirm" && <div className="sim-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="fin-title">
        <div className="sim-modal">
          <button type="button" className="sim-close" aria-label="Close" onClick={() => setPhase("review")}><X size={14} /></button>
          <p className="bs-panel-kicker">08 / Engineering Review</p>
          <h2 id="fin-title">Finalize This Design?</h2>
          <p className="bs-note">Finalizing records the engineer’s approval and adds this simulated design to the AEGIS network.</p>
          <dl className="sim-kv"><div><dt>Design</dt><dd>{title}</dd></div><div><dt>Revision</dt><dd>R{revision}</dd></div><div><dt>Simulation</dt><dd>Current</dd></div></dl>
          <label className="val-ack"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />I have reviewed the final design, simulation results, assumptions, and residual risks. I approve this design for addition to the AEGIS network.</label>
          <div className="sim-modal-actions"><button type="button" className="build-link" onClick={() => setPhase("review")}>Cancel</button>
            <button type="button" className="build-link is-primary" disabled={!canConfirmFinalization(approved, 0)} onClick={() => setPhase("finalizing")}>Confirm Finalization</button></div>
        </div>
      </div>}
    </div>
  );
}
