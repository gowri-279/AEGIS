import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, ChevronRight, Crosshair, Layers, Loader2, Network as NetIcon, PanelRightClose, PanelRightOpen, Play, RotateCcw, Send, ShieldAlert, ShieldCheck, ShieldQuestion, Waves, X } from "lucide-react";
import { NetworkScene, type ViewMode } from "./NetworkScene";
import { getCanonicalResponse, runScenario } from "@/services/api";
import type { FixtureId } from "@/data/mockCanonicalResponse";
import type { CanonicalResponse, ConstraintStatus, Recommendation } from "@/data/types";
import { bobInsight, bobReply, type BobMessage } from "@/data/mockBob";
import { cn } from "@/lib/utils";

type Mode = "overview" | "health" | "simulator" | "review" | "pipeline";
const MODES: { id: Mode; label: string; icon: typeof NetIcon }[] = [
  { id: "overview", label: "Network Overview", icon: NetIcon },
  { id: "health", label: "Assess Health", icon: Activity },
  { id: "simulator", label: "Simulator", icon: Play },
  { id: "review", label: "Assess / Review", icon: ShieldCheck },
  { id: "pipeline", label: "Pipeline Analysis", icon: Layers },
];

const statusTone: Record<string, string> = {
  fresh: "text-ok", degraded: "text-warn", stale: "text-stale", missing: "text-stale", invalid: "text-crit", conflicting: "text-warn",
  low: "text-water", moderate: "text-warn", high: "text-crit", critical: "text-crit",
  pass: "text-ok", fail: "text-crit", not_evaluated: "text-stale",
};

const Mono = ({ children, className }: { children: React.ReactNode; className?: string | undefined }) => <span className={cn("font-mono", className)}>{children}</span>;
const fmt = (n: number | null | undefined, d = 2) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(d));

export function AegisApp() {
  const [data, setData] = useState<CanonicalResponse | null>(null);
  const [mode, setMode] = useState<Mode>("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("blueprint");
  const [panelOpen, setPanelOpen] = useState(true);
  const [simActive, setSimActive] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => { getCanonicalResponse("standard").then(setData); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = async (fixture: FixtureId) => {
    setRunning(true); setSimActive(false);
    const res = await runScenario({ fixture });
    setData(res); setRunning(false); setSimActive(true);
  };

  if (!data) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-water" /></div>;

  const healthMode = mode === "health" || mode === "review";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 z-0 isolate">
        <NetworkScene data={data} selected={selected} onSelect={setSelected} viewMode={viewMode} healthMode={healthMode} simActive={simActive && (mode === "simulator" || mode === "review")} />
      </div>
      <div className="pointer-events-none absolute inset-0 scanline opacity-40" />

      {/* Top bar */}
      <header className="pointer-events-none absolute z-20 inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="pointer-events-auto glass flex items-center gap-3 px-4 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-water/40 text-water"><Waves className="h-4 w-4" /></div>
          <div>
            <div className="font-mono text-sm font-semibold tracking-[0.3em]">AEGIS</div>
            <div className="label-xs !text-[9px]">Bengaluru · {data.network.network_id}</div>
          </div>
        </div>
        <nav className="pointer-events-auto glass flex items-center gap-1 p-1">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => { setMode(m.id); if (m.id === "overview" || m.id === "pipeline") setSimActive(false); }}
              className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors", mode === m.id ? "bg-water/15 text-water" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              <m.icon className="h-3.5 w-3.5" /><span className="hidden xl:inline">{m.label}</span>
            </button>
          ))}
        </nav>
        <div className="pointer-events-auto glass flex items-center gap-2 px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" />
          <span className="label-xs !text-warn">Synthetic · Illustrative MVP data</span>
        </div>
      </header>

      {/* Left: mode panel */}
      <aside className="absolute z-20 left-4 top-24 bottom-20 w-[340px] overflow-y-auto">
        {mode === "overview" && <OverviewPanel data={data} onSelect={setSelected} onAssess={() => setMode("health")} />}
        {mode === "health" && <HealthPanel data={data} onSelect={setSelected} selected={selected} />}
        {mode === "simulator" && <SimulatorPanel data={data} running={running} simActive={simActive} onRun={run} onReset={() => { setSimActive(false); run("standard").then(() => setSimActive(false)); }} />}
        {mode === "review" && <ReviewPanel data={data} onSelect={setSelected} />}
        {mode === "pipeline" && <PipelinePanel data={data} onSelect={setSelected} selected={selected} />}
      </aside>

      {/* Bottom: view modes */}
      <div className="absolute z-20 bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3">
        <div className="glass flex items-center gap-1 p-1">
          {(["blueprint", "terrain", "underground"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setViewMode(v)} className={cn("rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors", viewMode === v ? "bg-water/15 text-water" : "text-muted-foreground hover:text-foreground")}>{v}</button>
          ))}
        </div>
        <button onClick={() => setSelected(null)} className="glass flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"><Crosshair className="h-3.5 w-3.5" /> Reset view</button>
        {mode !== "health" && (
          <button onClick={() => setMode("health")} className="flex items-center gap-2 rounded-md border border-water/50 bg-water/15 px-4 py-2 font-mono text-xs uppercase tracking-widest text-water shadow-[var(--shadow-glow)] hover:bg-water/25">
            <Activity className="h-3.5 w-3.5" /> Assess Health
          </button>
        )}
      </div>
      <div className="absolute bottom-5 left-4 label-xs max-w-[340px] !normal-case !tracking-normal">
        Not a validated real-world hydraulic safety model. Flow animation is illustrative.
      </div>

      {/* Right: Bob */}
      {panelOpen ? (
        <BobPanel data={data} context={selected} onClose={() => setPanelOpen(false)} onClear={() => setSelected(null)}
          onAction={(a) => { if (a === "health") setMode("health"); if (a === "simulate") setMode("simulator"); if (a === "review") setMode("review"); }} />
      ) : (
        <button onClick={() => setPanelOpen(true)} className="glass absolute right-4 top-24 flex items-center gap-2 px-3 py-2 text-xs text-bob"><PanelRightOpen className="h-4 w-4" /> Bob</button>
      )}
    </div>
  );
}

function Card({ title, children, className, tone }: { title?: string; children: React.ReactNode; className?: string | undefined; tone?: string | undefined }) {
  return (
    <section className={cn("glass mb-3 p-4 anim-rise", className)}>
      {title && <div className={cn("label-xs mb-3", tone)}>{title}</div>}
      {children}
    </section>
  );
}

function Row({ k, v, tone, onClick }: { k: React.ReactNode; v: React.ReactNode; tone?: string | undefined; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cn("flex w-full items-center justify-between gap-3 border-b border-border/60 py-1.5 text-left text-xs last:border-0", onClick && "hover:text-water")}>
      <span className="text-muted-foreground">{k}</span><span className={cn("font-mono", tone)}>{v}</span>
    </C>
  );
}

function OverviewPanel({ data, onSelect, onAssess }: { data: CanonicalResponse; onSelect: (id: string) => void; onAssess: () => void }) {
  const s = data.sensors[0]!;
  return (
    <>
      <Card title="Network state">
        <div className="mb-3 text-sm leading-relaxed">Four-node synthetic catchment. Junction <Mono className="text-water">J3</Mono> discharges to three intervention points.</div>
        <Row k="Nodes" v={data.network.nodes.length} />
        <Row k="Conduits" v={data.network.edges.length} />
        <Row k="Critical sensor WL-J3" v={s.status} tone={statusTone[s.status]} onClick={() => onSelect("WL-J3")} />
        <Row k="Open findings" v={data.risks.length} tone={data.risks.length ? "text-warn" : "text-ok"} />
      </Card>
      <Card title="Components">
        {data.network.nodes.map((n) => (
          <button key={n.id} onClick={() => onSelect(n.id)} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs hover:bg-accent">
            <span><Mono className="text-water">{n.id}</Mono> <span className="text-muted-foreground">· {n.type}</span></span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </Card>
      <button onClick={onAssess} className="glass w-full p-3 text-left text-xs text-muted-foreground hover:text-water">Reveal health layer over the network →</button>
    </>
  );
}

function HealthPanel({ data, onSelect, selected }: { data: CanonicalResponse; onSelect: (id: string) => void; selected: string | null }) {
  return (
    <>
      <Card title="Sensor reliability">
        {data.sensors.map((s) => (
          <button key={s.id} onClick={() => onSelect(s.id)} className={cn("w-full rounded border border-border p-3 text-left text-xs hover:border-water/50", selected === s.id && "border-water/60")}>
            <div className="flex items-center justify-between"><Mono className="text-sm">{s.id}</Mono><Mono className={cn("uppercase", statusTone[s.status])}>{s.status}</Mono></div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-muted-foreground">
              <span>Effective</span><Mono className="text-right text-foreground">{s.effective_value != null ? `${fmt(s.effective_value)} ${s.unit}` : "unavailable"}</Mono>
              <span>Confidence</span><Mono className="text-right text-foreground">{fmt(s.confidence)}</Mono>
            </div>
            {s.issue && <div className={cn("mt-2", statusTone[s.status])}>{s.issue}</div>}
          </button>
        ))}
        <p className="mt-2 text-[11px] text-muted-foreground">Confidence = data usability, not hazard probability.</p>
      </Card>
      <Card title="Risk findings">
        {data.risks.length === 0 && <p className="text-xs text-muted-foreground">No findings in this fixture.</p>}
        {data.risks.map((r) => (
          <button key={r.id} onClick={() => onSelect(r.target_id)} className="mb-2 w-full rounded border border-border p-3 text-left text-xs hover:border-water/50">
            <div className="flex items-center justify-between"><span className="font-medium">{r.title}</span><Mono className={cn("uppercase", statusTone[r.severity])}>{r.severity}</Mono></div>
            <div className="mt-1 text-muted-foreground"><Mono>{r.target_id}</Mono> · {r.category.replace(/_/g, " ")}</div>
            {(r.observed_value != null || r.threshold != null) && (
              <div className="mt-1"><Mono>{fmt(r.observed_value)} / {fmt(r.threshold)} {r.unit}</Mono></div>
            )}
            <ul className="mt-2 list-disc pl-4 text-muted-foreground">{r.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            <div className="mt-2 text-foreground/80">{r.potential_impact}</div>
          </button>
        ))}
      </Card>
    </>
  );
}

const SCENARIOS: { id: FixtureId; label: string; desc: string }[] = [
  { id: "standard", label: "Standard", desc: "200 m³ · 600 s · fresh sensor" },
  { id: "degraded", label: "Degraded sensor", desc: "WL-J3 degraded but usable" },
  { id: "critical_stale", label: "Critical sensor failure", desc: "WL-J3 stale → abstain" },
  { id: "stress", label: "Stress", desc: "900 m³ · 600 s" },
];

function SimulatorPanel({ data, running, simActive, onRun, onReset }: { data: CanonicalResponse; running: boolean; simActive: boolean; onRun: (f: FixtureId) => void; onReset: () => void }) {
  const [pick, setPick] = useState<FixtureId>("standard");
  const sim = data.simulation;
  return (
    <>
      <Card title="What-if scenario">
        <div className="space-y-1.5">
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => setPick(s.id)} className={cn("w-full rounded border p-2.5 text-left text-xs transition-colors", pick === s.id ? "border-water/60 bg-water/10" : "border-border hover:border-water/30")}>
              <div className="font-medium">{s.label}</div><div className="font-mono text-[10px] text-muted-foreground">{s.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button disabled={running} onClick={() => onRun(pick)} className="flex flex-1 items-center justify-center gap-2 rounded-md border border-water/50 bg-water/15 py-2 font-mono text-xs uppercase tracking-widest text-water hover:bg-water/25 disabled:opacity-50">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {running ? "Evaluating" : "Run"}
          </button>
          <button onClick={onReset} className="rounded-md border border-border px-3 text-muted-foreground hover:text-foreground" aria-label="Reset"><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>
        {running && <div className="relative mt-3 h-0.5 overflow-hidden rounded bg-muted"><div className="anim-sweep absolute inset-y-0 w-1/3 bg-water" /></div>}
      </Card>
      {simActive && !running && (
        <>
          <Card title="Scenario (backend)">
            <Row k="scenario_id" v={sim.scenario_id} />
            <Row k="diverted_volume" v={`${sim.diverted_volume_m3} m³`} />
            <Row k="duration" v={`${sim.duration_s} s`} />
            <Row k="proposed_flow" v={`≈${fmt(sim.proposed_flow_m3s, 3)} m³/s`} tone="text-water" />
            <p className="mt-2 text-[11px] text-muted-foreground">{sim.model_note}</p>
          </Card>
          <CandidateList data={data} />
          <RecommendationCard rec={data.recommendation} />
        </>
      )}
    </>
  );
}

function CandidateList({ data }: { data: CanonicalResponse }) {
  return (
    <Card title="Candidate interventions">
      {data.candidates.map((c) => (
        <div key={c.id} className={cn("mb-2 rounded border p-3 text-xs", c.id === data.recommendation.selected_candidate_id ? "border-ok/50 bg-ok/5" : "border-border")}>
          <div className="flex items-center justify-between"><Mono className="text-sm">{c.id}</Mono>
            <Mono className={cn("uppercase", c.feasible ? "text-ok" : c.feasible === false ? "text-crit" : "text-stale")}>{c.feasible ? "feasible" : c.feasible === false ? "infeasible" : "not evaluated"}</Mono>
          </div>
          <div className="mt-2 space-y-1">
            {c.constraints.map((k) => (
              <div key={k.constraint_id} className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground">{k.description}{k.note && <span className="block text-[10px] opacity-70">{k.note}</span>}</span>
                <ConstraintBadge s={k.status} v={k.observed != null || k.limit != null ? `${fmt(k.observed, 3)}/${fmt(k.limit, 2)}` : ""} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

function ConstraintBadge({ s, v }: { s: ConstraintStatus; v: string }) {
  return <Mono className={cn("shrink-0 text-[10px] uppercase", statusTone[s])}>{v && <span className="mr-1 normal-case text-foreground/70">{v}</span>}{s.replace("_", " ")}</Mono>;
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const cfg = {
    recommended: { icon: ShieldCheck, tone: "text-ok", border: "border-ok/50", label: "Recommended" },
    no_feasible_candidate: { icon: ShieldAlert, tone: "text-crit", border: "border-crit/50", label: "No feasible candidate" },
    abstained: { icon: ShieldQuestion, tone: "text-warn", border: "border-warn/50", label: "Abstained" },
  }[rec.recommendation_status];
  return (
    <section className={cn("glass mb-3 border-2 p-4 anim-rise", cfg.border)}>
      <div className="flex items-center gap-2"><cfg.icon className={cn("h-5 w-5", cfg.tone)} /><span className={cn("font-mono text-sm uppercase tracking-widest", cfg.tone)}>{cfg.label}</span></div>
      <div className="mt-3 text-2xl font-semibold"><Mono>{rec.selected_candidate_id ?? "No candidate selected"}</Mono></div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Mono className="rounded bg-muted px-1.5 py-0.5 text-[10px]">scope: {rec.recommendation_scope}</Mono>
        <Mono className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-warn">safety_qualified: {String(rec.safety_qualified)}</Mono>
      </div>
      <div className="label-xs mt-4 mb-1">Rationale</div>
      <ul className="list-disc space-y-1 pl-4 text-xs">{rec.rationale.map((r) => <li key={r}>{r}</li>)}</ul>
      <div className="label-xs mt-3 mb-1">Uncertainty</div>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{rec.uncertainty.map((r) => <li key={r}>{r}</li>)}</ul>
      <div className="label-xs mt-3 mb-1">Data limitations</div>
      <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">{rec.data_limitations.map((r) => <li key={r}>{r}</li>)}</ul>
    </section>
  );
}

function ReviewPanel({ data, onSelect }: { data: CanonicalResponse; onSelect: (id: string) => void }) {
  return (
    <>
      <Card title="Flagged components">
        {data.risks.map((r) => <Row key={r.id} k={r.title} v={r.target_id} tone={statusTone[r.severity]} onClick={() => onSelect(r.target_id)} />)}
      </Card>
      <RecommendationCard rec={data.recommendation} />
      <CandidateList data={data} />
    </>
  );
}

function PipelinePanel({ data, onSelect, selected }: { data: CanonicalResponse; onSelect: (id: string) => void; selected: string | null }) {
  return (
    <Card title="Topology">
      <div className="mb-3 rounded border border-border p-3 font-mono text-[11px] leading-6 text-muted-foreground">
        {data.network.edges.map((e) => (
          <button key={e.id} onClick={() => onSelect(e.id)} className={cn("block w-full text-left hover:text-water", selected === e.id && "text-water")}>
            <span className="text-foreground">{e.from}</span> ──▶ <span className="text-foreground">{e.to}</span> <span className="opacity-60">[{e.id}]</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Pipe geometry and positions are visualization metadata only — no canonical lengths, diameters or elevations.</p>
    </Card>
  );
}

function BobPanel({ data, context, onClose, onClear, onAction }: { data: CanonicalResponse; context: string | null; onClose: () => void; onClear: () => void; onAction: (a: string) => void }) {
  const [msgs, setMsgs] = useState<BobMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const insight = useMemo(() => bobInsight(data, context), [data, context]);
  const detail = useMemo(() => contextDetail(data, context), [data, context]);
  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }]); setInput(""); setThinking(true);
    setTimeout(() => { setMsgs((m) => [...m, { role: "bob", text: bobReply(text, data) }]); setThinking(false); }, 700);
  };
  return (
    <aside className="glass absolute z-20 right-4 top-24 bottom-4 flex w-[360px] flex-col overflow-hidden anim-rise">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-bob/50 bg-bob/15 text-bob"><Bot className="h-4 w-4" /></div>
          <div><div className="font-mono text-xs font-semibold tracking-[0.25em] text-bob">BOB</div>
            <div className="font-mono text-[10px] text-muted-foreground">Context: <span className="text-foreground">{context ?? "Network"}</span></div></div>
        </div>
        <div className="flex gap-1">
          {context && <button onClick={onClear} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear context"><X className="h-4 w-4" /></button>}
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Collapse"><PanelRightClose className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {detail && (
          <div className="rounded border border-border p-3">
            <div className="label-xs mb-2">{detail.title}</div>
            {detail.rows.map(([k, v, t]) => <Row key={k} k={k} v={v} tone={t} />)}
          </div>
        )}
        <div className="rounded border border-bob/30 bg-bob/5 p-3 text-xs leading-relaxed">
          {insight.map((l) => <p key={l} className="mb-1.5 last:mb-0">{l}</p>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[["Explain this", "explain"], ["Assess health", "health"], ["Simulate intervention", "simulate"], ["Explain recommendation", "review"]].map(([l, a]) => (
            <button key={a} onClick={() => (a === "explain" ? send(`Explain ${context ?? "the network"}`) : a === "review" ? (send("Why this recommendation?"), onAction(a!)) : onAction(a!))}
              className="rounded-full border border-bob/30 px-2.5 py-1 text-[11px] text-bob hover:bg-bob/10">{l}</button>
          ))}
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={cn("rounded-md p-2.5 text-xs leading-relaxed", m.role === "user" ? "ml-8 bg-accent" : "mr-4 border-l-2 border-bob bg-bob/5")}>{m.text}</div>
        ))}
        {thinking && <div className="flex items-center gap-2 text-[11px] text-bob"><Loader2 className="h-3 w-3 animate-spin" /> Bob is reading the backend response…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-border p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Bob — e.g. Simulate diverting 200 m³ for 600 s"
          className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-bob/60" />
        <button className="rounded-md border border-bob/40 bg-bob/15 p-2 text-bob hover:bg-bob/25" aria-label="Send"><Send className="h-3.5 w-3.5" /></button>
      </form>
    </aside>
  );
}

function contextDetail(data: CanonicalResponse, id: string | null): { title: string; rows: [string, string, (string | undefined)?][] } | null {
  if (!id) return null;
  const s = data.sensors.find((x) => x.id === id);
  if (s) return { title: `Sensor · ${s.id}`, rows: [
    ["Variable", `${s.variable} (${s.unit})`], ["Effective value", s.effective_value != null ? `${fmt(s.effective_value)} ${s.unit}` : "unavailable", s.effective_value == null ? "text-crit" : undefined],
    ["Status", s.status, statusTone[s.status]], ["Confidence", fmt(s.confidence)], ["Timestamp", s.timestamp ?? "—"], ...(s.issue ? [["Issue", s.issue, "text-warn"] as [string, string, string]] : []),
  ] };
  const n = data.network.nodes.find((x) => x.id === id);
  if (n) {
    const c = data.candidates.find((x) => x.node_id === id);
    return { title: `${n.type} · ${n.id}`, rows: [
      ...Object.entries(n.attributes).map(([k, v]) => [k, String(v)] as [string, string]),
      ...(n.sensor_ids.length ? [["Sensors", n.sensor_ids.join(", ")] as [string, string]] : []),
      ...(c ? [["Candidate", c.id], ["Feasible", c.feasible == null ? "not evaluated" : String(c.feasible), c.feasible ? "text-ok" : c.feasible === false ? "text-crit" : "text-stale"]] as [string, string, (string | undefined)?][] : []),
    ] };
  }
  const e = data.network.edges.find((x) => x.id === id);
  if (e) return { title: `Conduit · ${e.id}`, rows: [["From", e.from], ["To", e.to], ["Dimensions", "not canonical", "text-stale"]] };
  return null;
}
