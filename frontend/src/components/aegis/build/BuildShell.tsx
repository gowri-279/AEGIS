import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Waves } from "lucide-react";
import type { ReactNode } from "react";
import { BuildBackdrop } from "./BuildBackdrop";

/** Shared Build chrome: AEGIS brand, mode label, home link, schematic backdrop. */
export function BuildShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing build">
      <BuildBackdrop />
      <header className="landing-nav build-nav">
        <Link to="/" className="landing-brand build-brand" aria-label="AEGIS — Back To Home">
          <Waves size={15} /><strong>AEGIS</strong><small>Build Network</small>
        </Link>
        <nav className="build-nav-links" aria-label="AEGIS modes">
          <Link to="/monitor" className="build-nav-link">Monitor</Link>
          <span className="build-nav-link is-active" aria-current="page">Build</span>
          <Link to="/" className="build-nav-link"><ArrowLeft size={12} />Home</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}

export function BuildProgress({ steps, active = 0 }: { steps: string[]; active?: number }) {
  return (
    <ol className="build-progress" aria-label="Build steps">
      {steps.map((step, index) => (
        <li key={step} className={index === active ? "is-active" : undefined} aria-current={index === active ? "step" : undefined} aria-disabled={index !== active}>
          <span className="build-progress-num">{String(index + 1).padStart(2, "0")}</span>
          <span>{step}</span>
          {index < steps.length - 1 && <ArrowRight size={12} className="build-progress-sep" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
