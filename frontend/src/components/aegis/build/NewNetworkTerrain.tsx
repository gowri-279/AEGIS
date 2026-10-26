import { useEffect, useState } from "react";
import { getBuildFlow, setBuildFlow } from "./buildFlowStore";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BUILD_STEPS } from "@/data/buildDemo";
import { CONNECTION_POINTS, DEMO_TERRAINS, terrainSetupComplete, type ConnectionChoice } from "@/data/buildSetupDemo";
import { BuildProgress, BuildShell } from "./BuildShell";
import { TerrainPreview } from "./TerrainPreview";

export function NewNetworkSetup() {
  const initial = getBuildFlow();
  const [terrainId, setTerrainId] = useState<string | null>(initial.terrainId);
  const [connection, setConnection] = useState<ConnectionChoice>(initial.connection);
  const [points, setPoints] = useState<string[]>(initial.points);
  useEffect(() => { setBuildFlow({ terrainId, connection, points }); }, [terrainId, connection, points]);
  const terrain = DEMO_TERRAINS.find((t) => t.id === terrainId);
  const ready = terrainSetupComplete(terrainId, connection, points);
  const toggle = (id: string) => setPoints((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <BuildShell>
      <main className="build-setup">
        <BuildProgress steps={BUILD_STEPS.new} active={0} />
        <header className="build-setup-panel">
          <p className="build-setup-step">New Network · 01 / Terrain</p>
          <h1 className="build-heading">Define the terrain and catchment</h1>
          <p className="build-lede">Identify the terrain, drainage characteristics and environmental constraints that will shape the proposed network.</p>
        </header>

        <div className="terrain-setup-grid">
        <div className="terrain-setup-column">
        <section className="bs-sources" aria-label="Terrain source">
          <div className="bs-option is-on">
            <div className="bs-option-head"><strong>Available Terrain</strong><small>Select a preconfigured synthetic terrain model.</small></div>
            <ul className="bs-terrains">
              {DEMO_TERRAINS.map((t) => <li key={t.id}>
                <button type="button" className={terrainId === t.id ? "is-on" : ""} aria-pressed={terrainId === t.id} onClick={() => setTerrainId(t.id)}>
                  <strong>{t.name}</strong><span>{t.area} · {t.landUse} · {t.relief}</span>
                </button>
              </li>)}
            </ul>
          </div>
        </section>

        {terrain && <aside className="bs-panel terrain-selected-details">
            <p className="bs-panel-kicker">Terrain Analysis <em>AEGIS-Derived · Synthetic</em></p>
            <h2>{terrain.name}</h2>
            <dl className="bs-stats">
              <div><dt>Elevation</dt><dd>{terrain.analysis.elevation}</dd></div>
              <div><dt>Average Slope</dt><dd>{terrain.analysis.slope}</dd></div>
              <div><dt>Natural Drainage Paths</dt><dd>{terrain.analysis.drainagePaths}</dd></div>
              <div><dt>Low Points</dt><dd>{terrain.analysis.lowPoints}</dd></div>
              <div><dt>Water Bodies</dt><dd>{terrain.analysis.waterBodies}</dd></div>
              <div><dt>Catchment Area</dt><dd>{terrain.analysis.area}</dd></div>
            </dl>
            <p className="bs-note">Derived automatically from the terrain model — not manually entered.</p>
          </aside>}
        </div>

        {terrain && <div className="terrain-setup-column">
          <section className="terrain-selected-visual" aria-label="Terrain preview">
          <TerrainPreview terrainId={terrainId} showPoints={connection === "yes"} selectedPoints={points} onTogglePoint={toggle} annotateRegions />
          </section>

        <section className="bs-connection" aria-label="Existing network connection">
          <p className="bs-panel-kicker">Existing Network Connection</p>
          <h2 className="bs-q">Does this terrain connect to an existing AEGIS stormwater network?</h2>
          <div className="bs-choice">
            <button type="button" className={connection === "yes" ? "is-on" : ""} aria-pressed={connection === "yes"} onClick={() => setConnection("yes")}>
              <span>Yes</span><strong>Connect to existing network</strong><small>Use existing upstream and downstream network context when designing.</small>
            </button>
            <button type="button" className={connection === "no" ? "is-on" : ""} aria-pressed={connection === "no"} onClick={() => { setConnection("no"); setPoints([]); }}>
              <span>No</span><strong>Independent network</strong><small>Design this as a new isolated stormwater network.</small>
            </button>
          </div>
          {connection === "yes" && <div className="bs-points">
            <p className="bs-panel-kicker">Connection Points <em>Select one or more · also on the terrain</em></p>
            <div className="bs-point-list">
              {CONNECTION_POINTS.map((p) => <button key={p.id} type="button" className={points.includes(p.id) ? "is-on" : ""} aria-pressed={points.includes(p.id)} onClick={() => toggle(p.id)}>
                <strong>{p.id}</strong><small>{p.role}</small>
              </button>)}
            </div>
          </div>}
        </section>
        </div>}
        </div>

        <footer className="bs-footer">
          <Link to="/build" className="build-link"><ArrowLeft size={14} />Back</Link>
          {ready
            ? <Link to="/build/requirements" search={{ path: "new" }} className="build-link is-primary">Continue To Requirements<ArrowRight size={14} /></Link>
            : <span className="build-link is-disabled" aria-disabled="true">Continue To Requirements<ArrowRight size={14} /></span>}
        </footer>
      </main>
    </BuildShell>
  );
}
