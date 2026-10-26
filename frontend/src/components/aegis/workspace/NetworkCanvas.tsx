import { lazy, Suspense, useState } from "react";
import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BobVisualScenario } from "@/data/bobInterventions";
import type { Severity } from "@/data/types";
import type { CanonicalResponse } from "@/data/types";
import type { Tone } from "@/lib/aegis";
import type { WorkspaceMode } from "./types";
import type { ModelRepresentation } from "./inspectionPresentation";

const CatchmentScene = lazy(() => import("./CatchmentScene").then((m) => ({ default: m.CatchmentScene })));
interface Props {
  initialRepresentation?: ModelRepresentation;
  bobVisual?: BobVisualScenario | null;
  bobSignal?: { title: string; severity: Severity; onOpen: () => void } | null;
  data: CanonicalResponse;
  mode: WorkspaceMode;
  selectedId: string | null;
  selectionRevision: number;
  onSelect: (id: string | null) => void;
  healthPhase: "idle" | "scanning" | "done";
  scanStartedAt: number | null;
  simPhase: "idle" | "running" | "done";
  selectedFindingId?: string | null;
  onSelectHealthFinding?: (findingId: string) => void;
}

export function NetworkCanvas(props: Props) {
  const [resetKey, setResetKey] = useState(0);
  const [zoomRequest, setZoomRequest] = useState({ revision: 0, factor: 1 });
  const zoom = (factor: number) => setZoomRequest((r) => ({ revision: r.revision + 1, factor }));
  const [representation, setRepresentation] = useState<ModelRepresentation>(props.initialRepresentation ?? "terrain");
  return <div className="net-canvas spatial-canvas" data-mode={props.mode}>
    <div className="model-viewport" data-representation={representation}><Suspense fallback={<div className="model-loading">Loading catchment model…</div>}><CatchmentScene {...props} representation={representation} resetKey={resetKey} zoomRequest={zoomRequest} /></Suspense></div>
    <div className="model-tools">
      <div className="model-representations" role="group" aria-label="Model representation">{(["terrain", "blueprint"] as const).map((view) => <Button key={view} variant="ghost" size="sm" aria-pressed={view === representation} onClick={() => setRepresentation(view)}>{view === "terrain" ? "Terrain" : "Blueprint"}</Button>)}</div>
      {props.mode === "simulate" && <><Button variant="outline" size="icon" title="Zoom in" aria-label="Zoom in" onClick={() => zoom(1.25)}><Plus size={14} /></Button><Button variant="outline" size="icon" title="Zoom out" aria-label="Zoom out" onClick={() => zoom(.8)}><Minus size={14} /></Button></>}
      <Button variant="outline" size="icon" title="Reset model view" aria-label="Reset model view" onClick={() => { props.onSelect(null); setResetKey((key) => key + 1); }}><RotateCcw size={14} /></Button>
      {props.selectedId && <Button variant="outline" size="icon" title="Clear component selection" aria-label="Clear component selection" onClick={() => props.onSelect(null)}><Crosshair size={14} /></Button>}
    </div>
    <div className="model-disclosure">{representation === "terrain" ? "Abstract catchment" : "Topology drawing"} · not to scale<br />Illustrative geometry · no surveyed elevations</div>
    {props.healthPhase === "scanning" && props.mode === "health" && <div className="model-phase">Scanning canonical findings…</div>}
    {props.simPhase === "running" && props.mode === "simulate" && <div className="model-phase">Evaluating scenario…</div>}
    {props.bobVisual && (props.mode === "health" || props.mode === "simulate") && <div className="bob-model-status" role="status">Synthetic Simulation · Illustrative<br />{props.bobVisual.scenarioId.replaceAll("_", " ")} · {props.bobVisual.running ? "running" : "demonstration result"}</div>}
    <div className="net-legend" aria-label="Legend">
      <span className="model-legend-title">{{ network: "Infrastructure", health: "Health", simulate: "Simulate", review: "Review" }[props.mode]}</span>
      {legendFor(props.mode).map(([tone, label]) => <span key={label}><i className={`lg-dot tone-${tone}`} />{label}</span>)}
      <div className="model-component-legend" aria-label="Component types">
        <span>C — Collection Inlet</span><span>J — Junction</span><span>L — Storage</span><span>R — Recharge</span><span>O — Outlet</span>
      </div>
    </div>
  </div>;
}

function legendFor(mode: WorkspaceMode): [Tone, string][] {
  if (mode === "health") return [["ok", "Fresh"], ["info", "Low"], ["warn", "Attention"], ["crit", "High / Critical"], ["unknown", "Unknown / Stale"]];
  if (mode === "simulate") return [["ok", "Feasible Route"], ["crit", "Infeasible"], ["unknown", "Not Determined"]];
  if (mode === "review") return [["ok", "Recommended Route"], ["neutral", "Other Connections"]];
  return [["neutral", "Conduit → Direction"], ["ok", "Sensor Fresh"], ["warn", "Sensor Attention"], ["unknown", "Sensor Unknown"]];
}
