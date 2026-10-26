import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { BUILD_STEPS } from "@/data/buildDemo";
import type { BuildPathKind } from "@/data/buildRequirements";
import { DOWNSTREAM, NETWORK_INTEL, RELIABILITY, RISKS, TERRAIN_INTEL } from "@/data/buildAssessment";
import { BuildProgress, BuildShell } from "./BuildShell";
import { useBuildFlow } from "./buildFlowStore";
import { SystemCanvas } from "./SystemCanvas";
import { TerrainPreview } from "./TerrainPreview";

const HEAD: Record<BuildPathKind, { kicker: string; lede: string }> = {
  new: { kicker: "New Network · 04 / Network Assessment", lede: "Before generating a design, AEGIS evaluates the terrain, existing network context, reliability of available observations and downstream constraints." },
  redesign: { kicker: "Redesign Existing · 04 / Network Assessment", lede: "Before proposing changes, AEGIS evaluates the selected network region, its connected infrastructure, current risks and downstream constraints." },
};

const Rows = ({ rows }: { rows: [string, string][] }) => <dl className="bs-stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
const Block = ({ title, tag, children, className = "" }: { title: string; tag?: string; children: React.ReactNode; className?: string }) =>
  <section className={`bs-panel na-block ${className}`} aria-label={title}><p className="bs-panel-kicker">{title}{tag && <em>{tag}</em>}</p>{children}</section>;

export function NetworkAssessmentScreen({ path }: { path: BuildPathKind }) {
  const flow = useBuildFlow();
  const h = HEAD[path];
  const networkRows = path === "redesign" ? NETWORK_INTEL.redesign : flow.connection === "no" ? NETWORK_INTEL.independent : NETWORK_INTEL.connected;

  return (
    <BuildShell>
      <main className="build-setup na">
        <BuildProgress steps={BUILD_STEPS[path]} active={3} />
        <header className="build-setup-panel">
          <p className="build-setup-step">{h.kicker}</p>
          <h1 className="build-heading">AEGIS Network Assessment</h1>
          <p className="build-lede">{h.lede}</p>
        </header>

        <div className="na-stack">
          <div className="na-column">
          <Block title="Terrain Intelligence" tag="AEGIS-Derived">
            <Rows rows={TERRAIN_INTEL.rows} />
            <p className="na-obs">{TERRAIN_INTEL.observation}</p>
          </Block>
          <Block title="Network Intelligence"><Rows rows={networkRows} /></Block>
          <Block title="Identified Risks">
            <ul className="na-risks is-stacked">{RISKS.map((r) => <li key={r.title} className={`is-${r.tone}`}><span>{r.level}</span><strong>{r.title}</strong><small>{r.detail}</small></li>)}</ul>
          </Block>
          </div>
          <div className="na-column">
        <div className="na-canvas" aria-label="Terrain diagram">
          {path === "new"
            ? <TerrainPreview terrainId={flow.terrainId} showPoints selectedPoints={flow.connection === "yes" ? flow.points : []} onTogglePoint={() => {}} annotateRegions />
            : <><SystemCanvas scope={flow.redesignScope ?? "region"} /><figcaption className="bt-legend"><span><i className="lg-node" /><b>Existing</b>Network</span><span><i className="lg-flow" /><b>Flow</b>Direction</span><span><i className="lg-water" /><b>Lake</b>Water body</span><span><i className="lg-active" /><b>Selected</b>Region</span></figcaption></>}
        </div>

          <Block title="Reliability Intelligence" tag="Observations are not assumed trustworthy" className="na-reliability">
            <div className="na-gauge"><span>Network Observation Confidence</span><strong>{RELIABILITY.observationConfidence}%</strong><i style={{ width: `${RELIABILITY.observationConfidence}%` }} /></div>
            <table className="na-table">
              <thead><tr><th>Observation</th><th>Status</th><th>Reliability</th><th>Confidence</th></tr></thead>
              <tbody>{RELIABILITY.observations.map((o) => <tr key={o.id} className={o.status === "Stale" ? "is-stale" : ""}><td>{o.label}</td><td>{o.status}</td><td>{o.reliability}%</td><td>{o.confidence}%</td></tr>)}</tbody>
            </table>
            <p className="na-warn"><AlertTriangle size={13} /><span><b>Reliability Warning</b>{RELIABILITY.warning}</span></p>
          </Block>

          <Block title="Downstream Analysis">
            <Rows rows={DOWNSTREAM.rows} />
            <p className="na-obs">{DOWNSTREAM.observation}</p>
          </Block>

          </div>
        </div>

        <footer className="bs-footer">
          <Link to="/build/brief" search={{ path }} className="build-link"><ArrowLeft size={14} />Edit Design Brief</Link>
          <Link to="/build/workspace" search={{ path }} className="build-link is-primary">Ask Bob To Design<ArrowRight size={14} /></Link>
        </footer>
      </main>
    </BuildShell>
  );
}
