import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { BUILD_PATHS, type BuildPath } from "@/data/buildDemo";
import { BuildShell } from "./BuildShell";

export function BuildModeCard({ path }: { path: BuildPath }) {
  return (
    <Link to={path.to} className="build-mode-card" aria-label={path.cta}>
      <span className="build-mode-index">Path {path.index}</span>
      <h2>{path.title}</h2>
      <p>{path.description}</p>
      <ol className="build-mode-details">
        {path.details.map((d, i) => <li key={d}><span>{String(i + 1).padStart(2, "0")}</span>{d}</li>)}
      </ol>
      <span className="build-mode-cta">{path.cta}<ArrowRight size={14} /></span>
    </Link>
  );
}

export function BuildHome() {
  return (
    <BuildShell>
      <main className="build-home">
        <section className="build-intro">
          <p className="landing-eyebrow">AEGIS · Build Network</p>
          <h1 className="build-heading">AI-Assisted Stormwater Network Design</h1>
          <p className="build-lede">Design a new network or redesign an existing AEGIS network using terrain, network intelligence, reliability intelligence and simulation.</p>
          <p className="build-loop"><span>Monitor</span> understand the network <ArrowRight size={11} /> <span className="is-build">Build</span> design the network <ArrowRight size={11} /> <span>Monitor</span> observe the result</p>
        </section>
        <section className="build-modes" aria-label="Design paths">
          {BUILD_PATHS.map((p) => <BuildModeCard key={p.id} path={p} />)}
        </section>
      </main>
    </BuildShell>
  );
}
