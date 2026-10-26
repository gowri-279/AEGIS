import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BUILD_STEPS } from "@/data/buildDemo";
import { CONSTRAINTS, PRIMARY_OBJECTIVES, SCENARIOS, designIntent, shortOf, type BuildPathKind } from "@/data/buildRequirements";
import { BuildProgress, BuildShell } from "./BuildShell";
import { useBuildFlow } from "./buildFlowStore";
import { ContextList, MiniNetwork, designContextRows } from "./DesignContext";
import { TerrainPreview } from "./TerrainPreview";

export function DesignBriefScreen({ path }: { path: BuildPathKind }) {
  const flow = useBuildFlow();
  const r = flow.requirements;
  return (
    <BuildShell>
      <main className="build-setup">
        <BuildProgress steps={BUILD_STEPS[path]} active={2} />
        <header className="build-setup-panel">
          <p className="build-setup-step">Design Brief · 03 / Design Brief</p>
          <h1 className="build-heading">Ready to analyze</h1>
          <p className="build-lede">AEGIS has assembled the terrain, network and design requirements into a single design context.</p>
        </header>

        <div className="brief-layout">
          <div className="brief-main">
            <section className="bs-panel">
              <p className="bs-panel-kicker">{path === "new" ? "Terrain / Network Context" : "Network Context"}</p>
              <ContextList rows={designContextRows(path, flow, true)} />
            </section>
            <section className="bs-panel">
              <p className="bs-panel-kicker">Design Objective</p>
              <dl className="bs-stats">
                <div><dt>Primary</dt><dd>{shortOf(PRIMARY_OBJECTIVES, r.primary)}</dd></div>
                <div><dt>Scenario</dt><dd>{shortOf(SCENARIOS, r.scenario)}</dd></div>
              </dl>
            </section>
          </div>
          <aside className="brief-visual" aria-label="Design context visualization">
            {path === "new"
              ? <TerrainPreview terrainId={flow.terrainId} showPoints={flow.connection === "yes"} selectedPoints={flow.points} onTogglePoint={() => {}} />
              : <figure className="bt-view"><MiniNetwork scope={flow.redesignScope} /><figcaption className="bt-legend"><span><i className="lg-active" /><b>Selected</b>Redesign scope</span></figcaption></figure>}
          </aside>
            <section className="bs-panel">
              <p className="bs-panel-kicker">Constraints</p>
              <ul className="brief-tags">{r.constraints.map((id) => <li key={id}>{shortOf(CONSTRAINTS, id)}</li>)}</ul>
              <p className="bs-note">Footprint: {r.maxFootprint || "No limit"} · Infrastructure: {r.infraPriority} · Environmental Priority: {r.envPriority}</p>
            </section>
            <section className="rq-intent">
              <p className="bs-panel-kicker">AEGIS Design Intent</p>
              <blockquote>{designIntent(r, path)}</blockquote>
            </section>
        </div>

        <footer className="bs-footer">
          <Link to="/build/requirements" search={{ path }} className="build-link"><ArrowLeft size={14} />Edit Requirements</Link>
          <Link to="/build/assessment" search={{ path }} className="build-link is-primary">Analyze &amp; Design<ArrowRight size={14} /></Link>
        </footer>
      </main>
    </BuildShell>
  );
}

