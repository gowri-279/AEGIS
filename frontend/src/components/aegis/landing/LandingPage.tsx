import { Link } from "@tanstack/react-router";
import { ArrowRight, HardHat, Radar, Waves } from "lucide-react";
import { LandingNetwork } from "./LandingNetwork";

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="landing-brand"><Waves size={15} /><strong>AEGIS</strong><small>Stormwater Intelligence</small></span>
        <span className="landing-nav-meta">Synthetic Illustrative · Demonstration</span>
      </header>
      <main className="landing-hero">
        <section className="landing-copy">
          <p className="landing-eyebrow">URBAN RESILIENCE SYSTEMS</p>
          <h1 className="landing-wordmark">AEGIS</h1>
          <p className="landing-subtitle">Reliability-Aware Stormwater Intelligence</p>
          <p className="landing-tagline">See the network. Understand its risks. Make better decisions.</p>
          <div className="landing-cards">
            <Link to="/monitor" className="landing-card" aria-label="Open AEGIS Monitor">
              <span className="landing-card-icon"><Radar size={22} /></span>
              <span className="landing-card-body">
                <strong>Monitor</strong>
                <small>Observe network health, detect risks, and understand changing stormwater conditions.</small>
              </span>
              <ArrowRight size={16} className="landing-card-arrow" />
            </Link>
            <Link to="/build" className="landing-card" aria-label="Open AEGIS Build">
              <span className="landing-card-icon"><HardHat size={22} /></span>
              <span className="landing-card-body">
                <strong>Build</strong>
                <small>Design and explore stormwater infrastructure before it reaches the real world.</small>
              </span>
              <ArrowRight size={16} className="landing-card-arrow" />
            </Link>
          </div>
        </section>
        <aside className="landing-visual" aria-label="Interactive stormwater demo network model">
          <LandingNetwork />
        </aside>
      </main>
    </div>
  );
}
