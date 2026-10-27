import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Play, Waves, X } from "lucide-react";
import {
  CAPACITY, FLOW_NOTES, FLOW_ROUTING, LIMITATIONS, PRIMARY_METRICS,
  SIM_INPUTS, SIM_META, SIM_NODES, SIM_STAGES, STRENGTHS, riskZones, simLinks, utilTone, utilization, type SimView,
} from "@/data/buildSimulation";
import type { CandidateId, Design } from "@/data/buildWorkspace";
import type { BuildPathKind } from "@/data/buildRequirements";
import { runBuildSimulation } from "@/services/api";
import { getBuildFlow } from "./buildFlowStore";

/** Preparation modal — confirms inputs before the mock run. */
export function SimulationPrep({ onStart, onCancel, design, label }: { onStart: () => void; onCancel: () => void; design?: Design; label?: string }) {
  return (
    <div className="sim-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="sim-prep-title">
      <div className="sim-modal">
        <button type="button" className="sim-close" aria-label="Close" onClick={onCancel}><X size={14} /></button>
        <p className="bs-panel-kicker">06 / Simulation</p>
        <h2 id="sim-prep-title">Run AEGIS Simulation</h2>
        <dl className="sim-kv"><div><dt>Design</dt><dd>{label ?? SIM_META.design}</dd></div><div><dt>Scenario</dt><dd>{SIM_META.scenario}</dd></div><div><dt>Network</dt><dd>{design ? `${design.nodes.length} Components · ${design.links.length} Connections` : SIM_META.network}</dd></div></dl>
        {design && <SimNetwork view="proposed" playing={false} compact design={design} />}
        <p className="sim-label">Simulation Inputs</p>
        <ul className="sim-inputs">{SIM_INPUTS.map((i) => <li key={i}><Check size={12} />{i}</li>)}</ul>
        <div className="sim-modal-actions">
          <button type="button" className="build-link" onClick={onCancel}>Cancel</button>
          <button type="button" className="build-link is-primary" onClick={onStart}>Start Simulation <ArrowRight size={13} /></button>
        </div>
      </div>
    </div>
  );
}

const STAGE_MS = 420;
export function SimulationRunning({
  onDone, design, path = "redesign", candidate = "A", revision = 0,
}: {
  onDone: () => void; design?: Design; path?: BuildPathKind; candidate?: CandidateId; revision?: number;
}) {
  const [done, setDone] = useState(0);
  const complete = done >= SIM_STAGES.length;
  // Bind live P1/P2/P3 evaluation to the exact applied active design (V2 metrics stay authored).
  useEffect(() => {
    if (!design) return;
    const flow = getBuildFlow();
    void runBuildSimulation({
      mode: path,
      rainfall_scenario: flow.requirements.scenario || "extreme",
      selected_candidate: candidate,
      revision,
      terrain_id: flow.terrainId,
      objectives: {
        primary: flow.requirements.primary,
        secondary: flow.requirements.secondary,
      },
      constraints: flow.requirements.constraints,
      active_design: design,
    });
  }, [design, path, candidate, revision]);
  useEffect(() => {
    const t = setTimeout(complete ? onDone : () => setDone((d) => d + 1), complete ? 900 : STAGE_MS);
    return () => clearTimeout(t);
  }, [done, complete, onDone]);
  return (
    <div className="landing build sim-running" role="status" aria-live="polite">
      <div className="sim-run-card bw-seq">
        <p className="bs-panel-kicker"><Waves size={13} />AEGIS · Simulation Engine</p>
        <h1 className="build-heading">{complete ? "Simulation Complete" : "Simulation In Progress"}</h1>
        <SimNetwork view={done >= 4 ? "proposed" : "baseline"} playing compact design={design} />
        <ol>{SIM_STAGES.map((s, i) => <li key={s} className={i < done ? "is-done" : i === done ? "is-active" : ""}><span>{s}</span><b>{i < done ? <Check size={12} /> : i === done ? "…" : ""}</b></li>)}</ol>
        <div className="bw-bar"><i style={{ width: `${(done / SIM_STAGES.length) * 100}%` }} /></div>
      </div>
    </div>
  );
}

/** Before/after schematic network (display-only). */
function SimNetwork({ view, playing, compact, design }: { view: SimView; playing: boolean; compact?: boolean | undefined; design?: Design | undefined }) {
  if (design) return <DesignSimNetwork view={view} playing={playing} compact={compact} design={design} />;
  const pos = Object.fromEntries(SIM_NODES.map((n) => [n.id, n]));
  const links = simLinks(view);
  const visible = SIM_NODES.filter((n) => view === "proposed" || n.kind !== "proposed");
  return (
    <svg className={`sim-net ${playing ? "is-playing" : ""} ${compact ? "is-compact" : ""}`} viewBox="0 0 640 330" role="img" aria-label={`${view} network flow`}>
      <path className="sim-corridor" d="M380 120 Q480 110 620 190 L620 240 Q500 200 380 170 Z" opacity={view === "baseline" ? 1 : 0.4} />
      <text className="sim-zone-label" x="520" y="140">Eastern Low-Point Corridor</text>
      <ellipse className="sim-lake" cx="360" cy="110" rx="70" ry="34" />
      <text className="sim-zone-label" x="320" y="62">Protected Lake</text>
      {links.map((l) => {
        const a = pos[l.from], b = pos[l.to];
        if (!a || !b) return null;
        const d = `M${a.x} ${a.y} L${b.x} ${b.y}`;
        const proposed = a.kind === "proposed" || b.kind === "proposed";
        return <g key={`${l.from}-${l.to}`}>
          <path d={d} className={`sim-link ${proposed ? "is-proposed" : ""}`} strokeWidth={l.weight * 2} />
          <path d={d} className="sim-flow" strokeWidth={Math.max(1.2, l.weight)} />
        </g>;
      })}
      {visible.map((n) => {
        const u = utilization(n.id, view);
        const bottleneck = n.id === "J3" && view === "baseline";
        return <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
          {bottleneck && <circle r="22" className="sim-bottleneck" />}
          <circle r={n.kind === "lake" ? 9 : 11} className={`sim-node is-${n.kind} ${u !== undefined ? `tone-${utilTone(u)}` : ""}`} />
          <text y="-17" className="sim-node-label">{n.id}</text>
          {u !== undefined && !compact && <text y="28" className={`sim-node-util tone-${utilTone(u)}`}>{u}%</text>}
        </g>;
      })}
    </svg>
  );
}

/** Renders the exact committed Build design (display positions from the 800 × 480 design canvas). */
function DesignSimNetwork({ view, playing, compact, design }: { view: SimView; playing: boolean; compact?: boolean | undefined; design: Design }) {
  const existing = design.nodes.some((n) => !n.proposed);
  const nodes = view === "baseline" && existing ? design.nodes.filter((n) => !n.proposed) : design.nodes;
  const links = view === "baseline" && existing ? design.links.filter((l) => !l.proposed) : design.links;
  const pos = Object.fromEntries(nodes.map((n) => [n.id, { ...n, x: 20 + n.x / 800 * 600, y: 15 + n.y / 480 * 300 }]));
  return (
    <svg className={`sim-net ${playing ? "is-playing" : ""} ${compact ? "is-compact" : ""}`} viewBox="0 0 640 330" role="img" aria-label={`${view} network flow`} data-design-ids={design.nodes.map((n) => n.id).join(" ")}>
      {links.map((l) => {
        const a = pos[l.from], b = pos[l.to];
        if (!a || !b) return null;
        const d = `M${a.x} ${a.y} L${b.x} ${b.y}`;
        return <g key={l.id}>
          <path d={d} className={`sim-link ${l.proposed ? "is-proposed" : ""}`} strokeWidth={l.kind === "channel" ? 4 : 3} strokeDasharray={l.kind === "channel" ? "6 4" : undefined} />
          <path d={d} className="sim-flow" strokeWidth={1.5} />
        </g>;
      })}
      {Object.values(pos).map((n) => {
        const u = utilization(n.id, view);
        return <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
          <circle r={n.kind === "storage" ? 9 : 11} className={`sim-node ${n.proposed ? "is-proposed" : n.kind === "storage" ? "is-lake" : ""} ${u !== undefined ? `tone-${utilTone(u)}` : ""}`} />
          <text y="-17" className="sim-node-label">{n.id}</text>
          {u !== undefined && !compact && <text y="28" className={`sim-node-util tone-${utilTone(u)}`}>{u}%</text>}
        </g>;
      })}
    </svg>
  );
}

function ViewToggle({ view, onView }: { view: SimView; onView: (v: SimView) => void }) {
  return <div className="sim-toggle" role="radiogroup" aria-label="Baseline or proposed">
    {(["baseline", "proposed"] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? "is-on" : ""} onClick={() => onView(v)}><i />{v === "baseline" ? "Baseline" : "Proposed"}</button>)}
  </div>;
}

function Section({ title, kicker, children, className = "" }: { title: string; kicker?: string; children: React.ReactNode; className?: string }) {
  return <section className={`sim-sec ${className}`}><header><h2>{title}</h2>{kicker && <span>{kicker}</span>}</header>{children}</section>;
}

export function SimulationResults({ outdated, onBack, onRerun, path = "redesign", design = "A", network, label }: { outdated: boolean; onBack: () => void; onRerun: () => void; path?: "new" | "redesign"; design?: CandidateId; network?: Design; label?: string }) {
  const [view, setView] = useState<SimView>("proposed");
  const playing = false;
  const zones = riskZones(view);

  return (
    <div className={`sim ${outdated ? "is-outdated" : ""}`}>
      <header className="bw-top">
        <Link to="/" className="landing-brand build-brand" aria-label="AEGIS — Back To Home"><Waves size={15} /><strong>AEGIS</strong><small>Simulation Results</small></Link>
        <span className="bw-context">{label ?? SIM_META.design} · {SIM_META.scenario}</span>
        <span className={`bw-status ${outdated ? "is-warn" : ""}`}><i />{outdated ? "Simulation Outdated" : "Simulation Complete"}</span>
        <div className="bw-actions"><button type="button" className="build-link" onClick={onBack}><ArrowLeft size={13} />Back To Design</button></div>
      </header>

      <div className="sim-body">
        {outdated && <div className="bw-outdated sim-outdated" role="alert"><AlertTriangle size={14} /><div><b>Simulation Outdated</b><span>Design changed after the last simulation. Run simulation again before using these results.</span></div>
          <button type="button" className="build-link is-primary" onClick={onRerun}><Play size={12} />Run Simulation Again →</button></div>}

        <Section title="Baseline vs Proposed" kicker="Simulated values">
          <div className="sim-metrics">{PRIMARY_METRICS.map((m) => <div key={m.id} className="sim-metric">
            <p>{m.label}</p>
            <div className="sim-metric-vals"><span><small>Baseline</small><b className="is-base">{m.baseline}</b></span><ArrowRight size={14} /><span><small>Proposed</small><b>{m.proposed}</b></span></div>
            <footer>{m.change && <em>{m.change}</em>}<i>{m.status}</i></footer>
          </div>)}</div>
        </Section>

        <div className="sim-grid">
          <Section title="Network Simulation" className="sim-wide">
            <div className="sim-vis-head"><ViewToggle view={view} onView={setView} /><span className="sim-path">{network ? `${(view === "baseline" && network.nodes.some((n) => !n.proposed) ? network.nodes.filter((n) => !n.proposed) : network.nodes).length} Components` : view === "baseline" ? "J3 → L2 → O1" : "J3 → J5 → D01 → R01 → O1"}</span></div>
            <SimNetwork view={view} playing={playing} design={network} />
            <p className="sim-caption">{view === "baseline" ? "Heavy flow through J3 → L2 · J3 bottleneck · O1 approaching capacity · lake sensitive" : "Flow split through diversion and detention · J3 load reduced · lake protected · existing connection retained"}</p>
          </Section>
          <Section title="Flood Risk Analysis">
            <svg className="sim-risk" viewBox="0 0 640 260" role="img" aria-label={`${view} flood risk map`}>
              {[40, 80, 120, 160, 200].map((y) => <path key={y} className="build-contour" d={`M0 ${y} Q320 ${y - 30} 640 ${y + 20}`} />)}
              {zones.map((z, i) => <ellipse key={i} cx={z.x} cy={z.y} rx={z.rx} ry={z.ry} className={`risk-${z.level}`} />)}
              <text className="sim-zone-label" x="130" y="60">J3</text><text className="sim-zone-label" x="420" y="100">Eastern Low Point</text>
            </svg>
            <div className="sim-risk-legend">{["low", "moderate", "high", "critical"].map((l) => <span key={l}><i className={`risk-${l}`} />{l}</span>)}</div>
            <p className="sim-caption">{view === "baseline" ? "Primary risk at the eastern low-point corridor; elevated around J3." : "Risk zone smaller and peak concentration reduced; residual moderate exposure remains."}</p>
          </Section>
        </div>

        <div className="sim-grid is-3">
          <Section title="Network Capacity Analysis">
            <div className="sim-bars">{CAPACITY.map((c) => <div key={c.id} className="sim-bar-row">
              <b>{c.id}</b>
              <div className="sim-bar-track"><i className="is-base" style={{ width: `${c.baseline}%` }} /><i className={`tone-${utilTone(c.proposed)}`} style={{ width: `${c.proposed}%` }} /></div>
              <span>{c.baseline}% → <strong>{c.proposed}%</strong></span>
            </div>)}</div>
            <p className="sim-flag is-ok"><b>Primary Improvement</b>J3 → L2 bottleneck reduced</p>
            <p className="sim-flag is-warn"><b>Remaining Constraint</b>O1 remains a downstream capacity consideration.</p>
          </Section>
          <Section title="Flow Routing Analysis" kicker="Simulated values">
            <table className="sim-table"><thead><tr><th /><th>Baseline</th><th>Proposed</th></tr></thead>
              <tbody>{FLOW_ROUTING.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.baseline}</td><td><b>{r.proposed}</b></td></tr>)}</tbody></table>
            <dl className="sim-kv is-tight">{FLOW_NOTES.map((n) => <div key={n.label}><dt>{n.label}</dt><dd>{n.value}</dd></div>)}</dl>
          </Section>
          <Section title="Environmental Impact">
            <dl className="sim-kv is-tight"><div><dt>Protected Water Body</dt><dd>L2</dd></div><div><dt>Baseline</dt><dd className="tone-risk">High Impact Risk</dd></div><div><dt>Proposed</dt><dd className="tone-ok">Low Impact Risk</dd></div><div><dt>Peak Inflow</dt><dd>↓ 18%</dd></div><div><dt>Peak Hydraulic Load</dt><dd>↓ 14%</dd></div><div><dt>Environmental Protection</dt><dd className="tone-ok">Improved</dd></div></dl>
            <p className="sim-caption">The proposed design reduces peak hydraulic transfer toward the protected downstream water body while retaining the existing network connection.</p>
          </Section>
        </div>

        <section className="sim-conclusion">
          <p className="bs-panel-kicker">AEGIS Simulation Conclusion</p>
          <h2>Design Performance: <span>Improved</span></h2>
          <p>Design A reduces peak flood risk and upstream bottleneck loading while limiting additional downstream hydraulic transfer. The protected water body remains within the preferred impact range.</p>
          <div className="sim-grid">
            <div><p className="sim-label">Design Strengths</p><ul className="sim-list is-ok">{STRENGTHS.map((s) => <li key={s}><Check size={12} />{s}</li>)}</ul></div>
            <div><p className="sim-label">Limitations</p><ul className="sim-list is-warn">{LIMITATIONS.map((s) => <li key={s}><AlertTriangle size={12} />{s}</li>)}</ul></div>
          </div>
          <small className="bs-note">Simulation result is not validation and not approval — the engineer decides.</small>
        </section>
      </div>

      <footer className="bw-statusbar sim-status">
        <div><span><b>Simulation</b><i className={outdated ? "is-warn" : "is-ok"}>{outdated ? "Outdated" : "Complete"}</i></span><span><b>Design</b><i>{label ?? SIM_META.design}</i></span><span><b>Scenario</b><i>{SIM_META.scenario}</i></span><span><b>Confidence</b><i>{SIM_META.confidence}%</i></span></div>
        <div><Link to="/build/review" search={{ path, design }} className="build-link is-primary">Proceed To Engineering Review <ArrowRight size={13} /></Link></div>
      </footer>
    </div>
  );
}
