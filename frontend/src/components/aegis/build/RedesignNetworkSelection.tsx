import { useEffect, useState } from "react";
import { getBuildFlow, setBuildFlow } from "./buildFlowStore";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { BUILD_STEPS } from "@/data/buildDemo";
import { REDESIGN_LINKS, REDESIGN_NODES, REDESIGN_REGION, TERRAIN_SCENE } from "@/data/buildSetupDemo";
import { BuildProgress, BuildShell } from "./BuildShell";

type Sel = { kind: "node" | "link"; id: string } | { kind: "region" } | null;

export function RedesignNetworkSetup() {
  const [sel, setSel] = useState<Sel>(() => {
    const scope = getBuildFlow().redesignScope;
    if (!scope) return null;
    if (scope === "region") return { kind: "region" };
    return { kind: REDESIGN_LINKS.some((e) => e.id === scope) ? "link" : "node", id: scope };
  });
  useEffect(() => { setBuildFlow({ redesignScope: !sel ? null : sel.kind === "region" ? "region" : sel.id }); }, [sel]);
  const node = (id: string) => REDESIGN_NODES.find((n) => n.id === id)!;
  const region = sel?.kind === "region";
  const isOn = (kind: "node" | "link", id: string) =>
    (sel && sel.kind === kind && sel.id === id) || (region && (kind === "node" ? REDESIGN_REGION.nodeIds : REDESIGN_REGION.linkIds).includes(id));
  const key = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  const selNode = sel?.kind === "node" ? node(sel.id) : null;
  const selLink = sel?.kind === "link" ? REDESIGN_LINKS.find((l) => l.id === sel.id) : null;

  return (
    <BuildShell>
      <main className="build-setup">
        <BuildProgress steps={BUILD_STEPS.redesign} active={0} />
        <header className="build-setup-panel">
          <p className="build-setup-step">Redesign Existing · 01 / Network</p>
          <h1 className="build-heading">Select the network region to redesign</h1>
          <p className="build-lede">BLR-SYNTHETIC-01 · Existing Bengaluru stormwater network</p>
        </header>

        <section className="bs-split" aria-label="Existing network">
          <figure className="bt-view">
            <div className="bs-canvas-tools">
              <button type="button" className={`build-link ${region ? "is-active" : ""}`} aria-pressed={region} onClick={() => setSel(region ? null : { kind: "region" })}>Select Region</button>
            </div>
            <svg viewBox="0 0 800 480" role="img" aria-label="Existing network canvas">
              <defs>
                <pattern id="rn-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" className="bt-grid" /></pattern>
                <marker id="rn-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" className="bt-arrow-head" /></marker>
              </defs>
              <rect width="800" height="480" fill="url(#rn-grid)" />
              <path d={TERRAIN_SCENE.boundary} className="bt-boundary" />
              {TERRAIN_SCENE.contours.map((d, i) => <path key={i} d={d} className="bt-contour" />)}
              <path d="M500 230 C 520 200, 590 205, 594 245 C 598 285, 540 296, 515 280 C 494 266, 488 248, 500 230 Z" className="bt-water" />
              {REDESIGN_LINKS.map((l) => {
                const a = node(l.from), b = node(l.to);
                const d = `M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 24} ${b.x} ${b.y}`;
                const pick = () => setSel({ kind: "link", id: l.id });
                return <g key={l.id} className={`rn-link ${isOn("link", l.id) ? "is-on" : ""} ${l.warn ? "is-warn" : ""}`} role="button" tabIndex={0} aria-label={`Pipe ${l.id}`} aria-pressed={!!isOn("link", l.id)} onClick={pick} onKeyDown={key(pick)}>
                  <path d={d} className="rn-hit" /><path d={d} className="rn-pipe" /><path d={d} className="rn-flow" />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 22}>{l.id}</text>
                </g>;
              })}
              {REDESIGN_NODES.map((n) => {
                const pick = () => setSel({ kind: "node", id: n.id });
                return <g key={n.id} className={`rn-node is-${n.kind} ${isOn("node", n.id) ? "is-on" : ""} ${n.warn ? "is-warn" : ""}`} role="button" tabIndex={0} aria-label={`Component ${n.id}`} aria-pressed={!!isOn("node", n.id)} onClick={pick} onKeyDown={key(pick)}>
                  {n.kind === "storage" ? <rect x={n.x - 16} y={n.y - 11} width="32" height="22" /> : n.kind === "outlet" ? <path d={`M${n.x - 11} ${n.y - 10}H${n.x + 11}L${n.x} ${n.y + 11}Z`} /> : <circle cx={n.x} cy={n.y} r="10" />}
                  <text x={n.x} y={n.y + 30}>{n.id}</text>
                </g>;
              })}
            </svg>
            <figcaption className="bt-legend">
              <span><i className="lg-node" /><b>Junction</b>Existing</span>
              <span><i className="lg-flow" /><b>Flow</b>Pipe direction</span>
              <span><i className="lg-water" /><b>Lake</b>Storage / water body</span>
              <span><i className="lg-active" /><b>Selected</b>Redesign scope</span>
            </figcaption>
          </figure>

          <aside className="bs-panel" aria-live="polite">
            {!sel && <><p className="bs-panel-kicker">Selection</p><p className="bs-note">Click a junction, pipe or use Select Region to define the redesign scope.</p></>}
            {selNode && <><p className="bs-panel-kicker">Component</p><h2>{selNode.id}</h2>
              <dl className="bs-stats">
                <div><dt>Type</dt><dd>{selNode.kind === "storage" ? "Lake / Storage" : selNode.kind === "outlet" ? "Outlet" : "Junction"}</dd></div>
                <div><dt>Elevation</dt><dd>{selNode.elevation}</dd></div>
                <div><dt>Current Utilization</dt><dd>{selNode.utilization === null ? "Not supplied" : `${selNode.utilization}%`}</dd></div>
                <div><dt>Status</dt><dd className={selNode.warn ? "is-warn" : ""}>{selNode.warn && <AlertTriangle size={12} />} {selNode.status}</dd></div>
                <div><dt>Connected Downstream</dt><dd>{selNode.downstream}</dd></div>
              </dl></>}
            {selLink && <><p className="bs-panel-kicker">Pipe</p><h2>{selLink.id}</h2>
              <dl className="bs-stats">
                <div><dt>Type</dt><dd>Conduit</dd></div>
                <div><dt>Connects</dt><dd>{selLink.from} → {selLink.to}</dd></div>
                <div><dt>Current Utilization</dt><dd>{selLink.utilization === null ? "Not supplied" : `${selLink.utilization}%`}</dd></div>
                <div><dt>Status</dt><dd className={selLink.warn ? "is-warn" : ""}>{selLink.warn && <AlertTriangle size={12} />} {selLink.status}</dd></div>
              </dl></>}
            {region && <><p className="bs-panel-kicker">Selected Region</p><h2>{REDESIGN_REGION.label}</h2>
              <dl className="bs-stats">
                <div><dt>Current Condition</dt><dd>{REDESIGN_REGION.condition}</dd></div>
                <div><dt>Network Utilization</dt><dd>{REDESIGN_REGION.utilization}</dd></div>
                <div><dt>Risk</dt><dd className="is-warn">{REDESIGN_REGION.risk}</dd></div>
              </dl></>}
            {sel && <div className="bs-why"><p className="bs-panel-kicker">Why Redesign?</p>
              <ul>{REDESIGN_REGION.issues.map((i) => <li key={i}><AlertTriangle size={12} />{i}</li>)}</ul>
            </div>}
          </aside>
        </section>

        <footer className="bs-footer">
          <Link to="/build" className="build-link"><ArrowLeft size={14} />Back</Link>
          {sel
            ? <Link to="/build/requirements" search={{ path: "redesign" }} className="build-link is-primary">Continue To Requirements<ArrowRight size={14} /></Link>
            : <span className="build-link is-disabled" aria-disabled="true">Continue To Requirements<ArrowRight size={14} /></span>}
        </footer>
      </main>
    </BuildShell>
  );
}
