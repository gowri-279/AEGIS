import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Circle, Diamond, GitBranch, MousePointer2, Spline, Square, Triangle, Waves } from "lucide-react";
import { CONFIDENCE } from "@/data/buildAssessment";
import { EXPLANATION, KIND_LABEL, STATUS_LEFT, TOOLS, WHY, WS_CANDIDATES, type CandidateId, type Design, type ToolId } from "@/data/buildWorkspace";
import { useBuildFlow } from "./buildFlowStore";

const ICONS: Record<ToolId, typeof Circle> = { select: MousePointer2, junction: Circle, pipe: Spline, channel: Waves, detention: Square, recharge: Diamond, outfall: Triangle };

export function Toolbox({ tool, onTool }: { tool: ToolId; onTool: (t: ToolId) => void }) {
  return <aside className="bw-left" aria-label="Design tools">
    <p className="bs-panel-kicker">Design Tools</p>
    <ul className="bw-tools">{TOOLS.map((t) => { const I = ICONS[t.id]; return <li key={t.id}>
      <button type="button" title={t.tip} aria-pressed={tool === t.id} className={tool === t.id ? "is-on" : ""} onClick={() => onTool(t.id)}><I size={14} /><span>{t.label}</span></button>
    </li>; })}</ul>
    <div className="bw-edit-mode"><b>Engineer Edit Mode</b><span>Bob-generated design. Engineer modifications are allowed before simulation.</span></div>
  </aside>;
}

export function CandidateTabs({ active, onPick }: { active: CandidateId; onPick: (c: CandidateId) => void }) {
  return <div className="bw-cands" role="tablist" aria-label="Candidate designs">{WS_CANDIDATES.map((c) =>
    <button key={c.id} role="tab" type="button" aria-selected={active === c.id} className={active === c.id ? "is-on" : ""} onClick={() => onPick(c.id)}>
      <strong>{c.name}</strong><span>{c.subtitle}</span>{c.recommended && <em>Recommended</em>}
    </button>)}</div>;
}

export function BobDesignPanel({ active, onPick }: { active: CandidateId; onPick: (c: CandidateId) => void }) {
  const c = WS_CANDIDATES.find((x) => x.id === active)!;
  const flow = useBuildFlow();
  const enrich = flow.bobCandidates[active];
  const recommended = WS_CANDIDATES.find((x) => flow.bobCandidates[x.id]?.recommended) ?? WS_CANDIDATES.find((x) => x.recommended) ?? WS_CANDIDATES[0]!;
  const recommendedEnrich = flow.bobCandidates[recommended.id];
  const whyItems = enrich?.tradeoffs?.length ? enrich.tradeoffs : WHY;
  const reliabilityNote = enrich?.reliability_considerations
    ?? "L2 sensor observation is stale. Design confidence is reduced until downstream observations are refreshed.";
  const recommendedBlurb = recommendedEnrich?.rationale
    ?? "J3 → L2 is the primary network bottleneck. The proposed diversion toward the eastern low-point corridor reduces upstream concentration while avoiding direct transfer of additional hydraulic load to O1.";
  // V2 metrics remain canonical; Bob may enrich prose only.
  return <>
    <p className="bs-panel-kicker">Bob Design Intelligence</p>
    <label className="bw-group bw-select-label" htmlFor="bw-design-select">Select Design</label>
    <select id="bw-design-select" className="bw-select" value={active} onChange={(e) => onPick(e.target.value as CandidateId)}>
      {WS_CANDIDATES.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.subtitle}</option>)}
    </select>
    <section className="bw-selected" aria-live="polite">
      <header><strong>{c.name} — {c.subtitle}</strong>{(enrich?.recommended ?? c.recommended) && <em>Recommended</em>}</header>
      <dl className="bs-stats bw-metrics">{c.metrics.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>
    <div className="bw-rec"><span>Recommended</span><strong>{recommendedEnrich?.name ?? `${recommended.name} — ${recommended.subtitle}`}</strong>
      <p>{recommendedBlurb}</p></div>
    <div><p className="bw-group">Why This Design</p><ul className="bw-why">{whyItems.map((w) => <li key={w}><Check size={12} />{w}</li>)}</ul></div>
    <div className="bw-note"><AlertTriangle size={13} /><div><b>Reliability Note</b><span>{reliabilityNote}</span></div></div>
    <div className="bw-conf"><span>Confidence</span><strong>{CONFIDENCE.overall}%</strong><small>Based on terrain, topology, sensor reliability and downstream constraints.</small></div>
  </>;
}

export function PropertiesPanel({ design, id, onBack, onApply }: { design: Design; id: string; onBack: () => void; onApply: (patch: { capacity?: number; length?: number; purpose?: string }) => void }) {
  const node = design.nodes.find((n) => n.id === id); const link = design.links.find((l) => l.id === id);
  const proposed = node?.proposed ?? link?.proposed ?? false;
  const [cap, setCap] = useState(String(link?.capacity ?? "")); const [len, setLen] = useState(String(link?.length ?? ""));
  const [purpose, setPurpose] = useState(node?.purpose ?? link?.purpose ?? "");
  useEffect(() => { setCap(String(link?.capacity ?? "")); setLen(String(link?.length ?? "")); setPurpose(node?.purpose ?? link?.purpose ?? ""); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!node && !link) return null;
  const kind = node ? KIND_LABEL[node.kind] : KIND_LABEL[link!.kind];
  const rows: [string, string][] = node ? node.props : link!.proposed ? [] : link!.props ?? [];
  return <>
    <button type="button" className="bw-back" onClick={onBack}><ArrowLeft size={13} />Bob Intelligence</button>
    <p className="bs-panel-kicker">Component Properties</p>
    <div className="bw-prop-head"><strong>{id}</strong><span className={proposed ? "is-proposed" : ""}>{proposed ? `Proposed ${kind}` : kind}</span></div>
    {link && <dl className="bs-stats"><div><dt>From</dt><dd>{link.from}</dd></div><div><dt>To</dt><dd>{link.to}</dd></div></dl>}
    {rows.length > 0 && <dl className="bs-stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={/High|Attention|Constraint|Stale|Near/.test(v) ? "is-warn" : ""}>{v}</dd></div>)}</dl>}
    {proposed ? <form className="bw-form" onSubmit={(e) => { e.preventDefault(); onApply(link ? { capacity: Number(cap) || link.capacity, length: Number(len) || link.length, purpose } : { purpose }); }}>
      {link && <><label>Capacity<input type="number" min={20} max={300} value={cap} onChange={(e) => setCap(e.target.value)} /></label>
        <label>Length (m)<input type="number" min={10} value={len} onChange={(e) => setLen(e.target.value)} /></label></>}
      <label>Status<input value="Proposed" readOnly /></label>
      <label>Purpose<textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
      <button type="submit" className="build-link is-primary">Apply Change</button>
    </form> : node?.purpose ? <p className="bs-note">{node.purpose}</p> : <p className="bs-note">Existing infrastructure · read only.</p>}
  </>;
}

export function StatusBar({ simulated, label }: { simulated: boolean; label?: string }) {
  return <footer className="bw-statusbar" aria-label="System status">
    <div>{STATUS_LEFT.map(([k, v, t]) => <span key={k}><b>{k}</b><i className={`is-${t}`}>{v}</i></span>)}</div>
    <div><span><b>Design</b><i className="is-warn">Draft</i></span><span><b>Simulation</b><i>{label ?? (simulated ? "Queued (Demo)" : "Not Run")}</i></span><span className="bw-synth"><GitBranch size={11} />Synthetic Design Data</span></div>
  </footer>;
}
