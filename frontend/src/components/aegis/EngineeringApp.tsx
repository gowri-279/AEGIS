import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CloudRain, Droplets, Gauge, Map, Play, RotateCcw, ShieldAlert, Square, Waves, X } from "lucide-react";
import { getCanonicalResponse, runScenario } from "@/services/api";
import type { FixtureId } from "@/data/mockCanonicalResponse";
import type { CanonicalResponse, NetworkEdge, NetworkNode } from "@/data/types";
import { EngineeringScene, type EngineeringView } from "./EngineeringScene";
import "./engineering.css";
import { cn } from "@/lib/utils";

type Mode = "network" | "health" | "simulate" | "review";
type WhatIf = "standard" | "heavy-rain" | "flooding" | "sensor-failure";

const modes: { id: Mode; label: string }[] = [
  { id: "network", label: "NETWORK" },
  { id: "health", label: "HEALTH" },
  { id: "simulate", label: "SIMULATE" },
  { id: "review", label: "REVIEW" },
];

const whatIfs: { id: WhatIf; label: string; detail: string; fixture: FixtureId }[] = [
  { id: "standard", label: "Normal rainfall", detail: "Baseline network state", fixture: "standard" },
  { id: "heavy-rain", label: "Heavy rain", detail: "High inflow / stress condition", fixture: "stress" },
  { id: "flooding", label: "Flooding", detail: "Local surface accumulation", fixture: "stress" },
  { id: "sensor-failure", label: "Sensor failure", detail: "J3 water-level data unavailable", fixture: "critical_stale" },
];

const sampleNodes: NetworkNode[] = [
  { id: "V5", type: "storage", label: "V5 sample structure", sensor_ids: [], attributes: {} },
  { id: "V6", type: "recharge", label: "V6 sample structure", sensor_ids: [], attributes: {} },
  { id: "V7", type: "junction", label: "V7 sample structure", sensor_ids: [], attributes: {} },
  { id: "V8", type: "storage", label: "V8 sample structure", sensor_ids: [], attributes: {} },
];

export function EngineeringApp() {
  const [data, setData] = useState<CanonicalResponse | null>(null);
  const [mode, setMode] = useState<Mode>("network");
  const [view, setView] = useState<EngineeringView>("terrain");
  const [selected, setSelected] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIf>("standard");
  const [running, setRunning] = useState(false);
  const [bobOpen, setBobOpen] = useState(true);

  useEffect(() => {
    getCanonicalResponse("standard").then(setData);
  }, []);

  const canonicalNodes = useMemo(() => data?.network.nodes ?? [], [data]);
  const selectedNode = useMemo(() => {
    if (!selected || !data) return null;
    return canonicalNodes.find((node) => node.id === selected) ?? sampleNodes.find((node) => node.id === selected) ?? null;
  }, [canonicalNodes, data, selected]);
  const selectedEdge = useMemo(() => data?.network.edges.find((edge) => edge.id === selected) ?? null, [data, selected]);

  async function simulate() {
    const scenario = whatIfs.find((item) => item.id === whatIf);
    if (!scenario) return;
    setRunning(true);
    try {
      setData(await runScenario({ fixture: scenario.fixture }));
    } finally {
      setRunning(false);
    }
  }

  if (!data) {
    return <div className="engineering-loading"><span>AEGIS</span><small>LOADING SYNTHETIC CATCHMENT MODEL</small></div>;
  }

  const rainActive = mode === "simulate" && (whatIf === "heavy-rain" || whatIf === "flooding");
  const floodActive = mode === "simulate" && whatIf === "flooding";
  const simulationActive = mode === "simulate" && whatIf !== "sensor-failure";

  return <main className="engineering-app">
    <EngineeringScene
      data={data}
      view={view}
      selected={selected}
      onSelect={setSelected}
      healthMode={mode === "health" || mode === "review"}
      simulationActive={simulationActive}
      rainActive={rainActive}
      floodActive={floodActive}
    />

    <header className="engineering-header">
      <button className="engineering-brand" onClick={() => { setMode("network"); setSelected(null); }}>
        <span className="engineering-brand-mark"><Waves size={18} /></span>
        <span><strong>AEGIS</strong><small>BENGALURU CATCHMENT · SYNTHETIC MODEL 01</small></span>
      </button>
      <nav className="engineering-nav" aria-label="Primary">
        {modes.map((item) => <button key={item.id} className={cn(item.id === mode && "active")} onClick={() => { setMode(item.id); setSelected(null); }}>
          {item.id === "network" ? <Map size={13} /> : item.id === "health" ? <Activity size={13} /> : item.id === "simulate" ? <Play size={13} /> : <ShieldAlert size={13} />}
          {item.label}
        </button>)}
      </nav>
      <div className="model-status"><i /> LIVE MODEL <span>·</span> SYNTHETIC / ILLUSTRATIVE</div>
    </header>

    <div className="engineering-title">
      <span>{view === "terrain" ? "URBAN CATCHMENT" : view === "blueprint" ? "NETWORK EXOSKELETON" : "UNDERGROUND NETWORK"}</span>
      <small>{mode === "simulate" ? "WHAT-IF SIMULATION" : mode === "health" ? "NETWORK HEALTH LAYER" : mode === "review" ? "ENGINEERING REVIEW QUEUE" : "INTERACTIVE DIGITAL TWIN"}</small>
    </div>

    <aside className="engineering-inspector">
      {selectedNode ? <NodeInspector data={data} node={selectedNode} onClose={() => setSelected(null)} onSimulate={() => { setMode("simulate"); setWhatIf("standard"); }} />
        : selectedEdge ? <EdgeInspector edge={selectedEdge} />
        : mode === "health" ? <HealthInspector data={data} />
        : mode === "simulate" ? <SimulationInspector data={data} whatIf={whatIf} setWhatIf={setWhatIf} running={running} onRun={simulate} />
        : mode === "review" ? <ReviewInspector data={data} onSelect={setSelected} />
        : <NetworkInspector data={data} onSelect={setSelected} />}
    </aside>

    {bobOpen ? <BobInsight data={data} selected={selected} onClose={() => setBobOpen(false)} onSimulate={() => { setMode("simulate"); setWhatIf("standard"); }} /> : <button className="bob-reopen" onClick={() => setBobOpen(true)}><Bot size={15} /> BOB</button>}

    <div className="engineering-legend">
      <span><i className="legend-junction" /> JUNCTION</span><span><i className="legend-storage" /> STORAGE</span><span><i className="legend-recharge" /> RECHARGE</span><span><i className="legend-sensor" /> SENSOR</span><span><i className="legend-flow" /> FLOW</span>
    </div>

    <div className="view-switcher">
      {(["terrain", "blueprint", "underground"] as EngineeringView[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}
      <button className="reset-view" onClick={() => setSelected(null)}><RotateCcw size={12} /> RESET</button>
    </div>

    <div className="engineering-disclaimer">Synthetic / illustrative MVP · flow and terrain visuals are not validated hydraulic outputs.</div>
  </main>;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("engineering-panel", className)}>{children}</section>;
}
function PanelTitle({ children }: { children: React.ReactNode }) { return <div className="engineering-panel-title">{children}</div>; }

function NetworkInspector({ data, onSelect }: { data: CanonicalResponse; onSelect: (id: string) => void }) {
  return <Panel>
    <PanelTitle>NETWORK INVENTORY</PanelTitle>
    <div className="engineering-stat"><strong>8</strong><span>visualized structures</span></div>
    <div className="engineering-stat"><strong>{data.network.edges.length}</strong><span>canonical conduits</span></div>
    <div className="engineering-rule" />
    <div className="engineering-list">
      {data.network.nodes.map((node) => <button key={node.id} onClick={() => onSelect(node.id)}><span>{node.id}</span><small>{node.type.toUpperCase()}</small></button>)}
      {sampleNodes.filter((node) => !data.network.nodes.some((canonical) => canonical.id === node.id)).map((node) => <button key={node.id} onClick={() => onSelect(node.id)}><span>{node.id}</span><small>SAMPLE STRUCTURE</small></button>)}
    </div>
  </Panel>;
}

function NodeInspector({ data, node, onClose, onSimulate }: { data: CanonicalResponse; node: NetworkNode; onClose: () => void; onSimulate: () => void }) {
  const candidate = node.candidate_id ? data.candidates.find((item) => item.id === node.candidate_id) : null;
  return <Panel>
    <div className="engineering-inspector-head"><div><span className="eyebrow">COMPONENT</span><h2>{node.id}</h2><small>{node.type.toUpperCase()}</small></div><button onClick={onClose}><X size={15} /></button></div>
    {node.type === "storage" && <Metric label="AVAILABLE STORAGE" value={`${node.attributes?.available_storage_m3 ?? candidate?.available_storage_m3 ?? "—"} m³`} />}
    {node.type === "junction" && <Metric label="STANDARD DEPTH" value="0.60 m" />}
    {node.type === "recharge" && <Metric label="ELIGIBILITY" value={candidate?.eligible ? "ELIGIBLE" : "INELIGIBLE"} />}
    {candidate && <><div className="engineering-rule" /><Metric label="CANDIDATE" value={candidate.id} /><Metric label="CONSTRAINTS" value={candidate.constraints.every((item) => item.status === "pass") ? "PASS" : "REVIEW"} /></>}
    {node.id.startsWith("V") && <p className="engineering-note">Frontend-only sample structure used to populate the illustrative urban catchment. It is not part of the canonical backend topology.</p>}
    <button className="engineering-action" onClick={onSimulate}><Play size={13} /> SIMULATE ROUTE</button>
  </Panel>;
}

function EdgeInspector({ edge }: { edge: NetworkEdge }) {
  return <Panel><PanelTitle>CONDUIT</PanelTitle><Metric label="EDGE ID" value={edge.id} /><Metric label="FROM" value={edge.from} /><Metric label="TO" value={edge.to} /><p className="engineering-note">Geometry shown in the 3D twin is visualization-only. The frozen contract remains authoritative for network semantics.</p></Panel>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="engineering-metric"><span>{label}</span><strong>{value}</strong></div>; }

function HealthInspector({ data }: { data: CanonicalResponse }) {
  return <Panel>
    <PanelTitle>NETWORK HEALTH</PanelTitle>
    {data.sensors.map((sensor) => <div className="health-row" key={sensor.id}><div><strong>{sensor.id}</strong><small>{sensor.node_id} · {sensor.unit}</small></div><span className={`status-${sensor.status}`}>{sensor.status}</span></div>)}
    <div className="engineering-rule" />
    <p className="engineering-note">Confidence describes data usability, not hazard probability. Risk findings are shown as canonical findings and do not imply validated real-world failure.</p>
    {data.risks.map((risk) => <div className={`risk-row risk-${risk.severity}`} key={risk.id}><strong>{risk.title}</strong><span>{risk.target_id} · {risk.severity}</span></div>)}
  </Panel>;
}

function SimulationInspector({ data, whatIf, setWhatIf, running, onRun }: { data: CanonicalResponse; whatIf: WhatIf; setWhatIf: (value: WhatIf) => void; running: boolean; onRun: () => void }) {
  return <Panel>
    <PanelTitle>WHAT-IF SCENARIO</PanelTitle>
    <div className="scenario-list">
      {whatIfs.map((scenario) => <button key={scenario.id} className={whatIf === scenario.id ? "selected" : ""} onClick={() => setWhatIf(scenario.id)}>
        <span>{scenario.id === "heavy-rain" ? <CloudRain size={14} /> : scenario.id === "flooding" ? <Droplets size={14} /> : scenario.id === "sensor-failure" ? <Gauge size={14} /> : <Waves size={14} />}</span>
        <strong>{scenario.label}</strong><small>{scenario.detail}</small>
      </button>)}
    </div>
    <button className="engineering-action" disabled={running} onClick={onRun}>{running ? <Square size={12} /> : <Play size={13} />}{running ? "RUNNING…" : "RUN SCENARIO"}</button>
    {data.simulation && <div className="simulation-result"><span>LAST CANONICAL RESULT</span><strong>{data.recommendation.recommendation_status.replace(/_/g, " ").toUpperCase()}</strong><small>{data.simulation.diverted_volume_m3} m³ · {data.simulation.duration_s} s · {data.simulation.proposed_flow_m3s.toFixed(3)} m³/s</small></div>}
  </Panel>;
}

function ReviewInspector({ data, onSelect }: { data: CanonicalResponse; onSelect: (id: string) => void }) {
  return <Panel>
    <PanelTitle>REVIEW QUEUE</PanelTitle>
    {data.risks.map((risk) => <button key={risk.id} className="review-row" onClick={() => onSelect(risk.target_id)}><strong>{risk.target_id}</strong><span>{risk.title}</span><small>{risk.severity.toUpperCase()}</small></button>)}
    {!data.risks.length && <p className="engineering-note">No canonical findings in this fixture.</p>}
  </Panel>;
}

function BobInsight({ data, selected, onClose, onSimulate }: { data: CanonicalResponse; selected: string | null; onClose: () => void; onSimulate: () => void }) {
  const sensor = data.sensors.find((item) => item.id === "WL-J3");
  const recommendation = data.recommendation;
  const selectedCandidate = selected ? data.candidates.find((candidate) => candidate.node_id === selected) : null;
  return <aside className="bob-insight">
    <div className="bob-head"><span><Bot size={15} /> BOB · NETWORK ANALYST</span><button onClick={onClose}><X size={14} /></button></div>
    <div className="bob-body">
      {selectedCandidate ? <><span className="eyebrow">SELECTED CANDIDATE</span><h3>{selectedCandidate.id}</h3><p>{selectedCandidate.feasible ? "This candidate is feasible under the current modeled scenario." : selectedCandidate.feasible === false ? "This candidate is not feasible under the current modeled scenario." : "This candidate was not evaluated under the current data state."}</p></> : <><span className="eyebrow">CURRENT STATE</span><h3>{sensor?.effective_value != null ? `J3 water level ${sensor.effective_value.toFixed(2)} m` : "J3 water-level data unavailable"}</h3><p>{sensor?.effective_value != null ? `The hard threshold is 0.80 m. Sensor status is ${sensor.status}.` : "AEGIS is abstaining because the critical sensor cannot provide a usable effective value."}</p>{recommendation.recommendation_status === "recommended" && <p><strong>{recommendation.selected_candidate_id}</strong> is currently recommended within the modeled MVP scope.</p>}</>}
      <div className="bob-limitation">BOB explains canonical results; it does not calculate hydraulic physics or independently rank routes.</div>
      <button className="bob-action" onClick={onSimulate}><Play size={12} /> SIMULATE THIS NETWORK</button>
    </div>
  </aside>;
}
