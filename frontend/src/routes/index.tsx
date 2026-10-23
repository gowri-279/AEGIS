import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { ArrowRight, Waves } from "lucide-react";

const AegisApp = lazy(() => import("@/components/aegis/AegisApp").then((m) => ({ default: m.AegisApp })));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AEGIS — Stormwater Digital Twin for Bengaluru" },
      { name: "description", content: "AI-powered network intelligence for stormwater management: 3D digital twin, sensor reliability, what-if simulation and explained recommendations." },
      { property: "og:title", content: "AEGIS — Stormwater Digital Twin" },
      { property: "og:description", content: "See the network. Predict the risk. Act before the flood." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [stage, setStage] = useState<"entry" | "exiting" | "app">("entry");
  return (
    <>
      {stage !== "entry" && (
        <Suspense fallback={null}><AegisApp /></Suspense>
      )}
      {stage !== "app" && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background blueprint-grid ${stage === "exiting" ? "anim-exit" : ""}`}
          onAnimationEnd={(e) => { if (stage === "exiting" && e.target === e.currentTarget) setStage("app"); }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_70%)]" />
          <div className="relative max-w-3xl px-6 text-center">
            <div className="anim-rise mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-lg border border-water/40 text-water shadow-[var(--shadow-glow)]"><Waves className="h-7 w-7" /></div>
            <div className="anim-rise label-xs mb-4" style={{ animationDelay: "0.1s" }}>Stormwater decision &amp; simulation system · Bengaluru</div>
            <h1 className="anim-rise font-mono text-7xl font-semibold tracking-[0.35em] md:text-8xl" style={{ animationDelay: "0.2s" }}>AEGIS</h1>
            <p className="anim-rise mt-6 text-2xl font-light md:text-3xl" style={{ animationDelay: "0.35s" }}>See the network. Predict the risk. <span className="text-water">Act before the flood.</span></p>
            <p className="anim-rise mt-3 text-muted-foreground" style={{ animationDelay: "0.45s" }}>AI-powered network intelligence for stormwater management.</p>
            <button autoFocus onClick={() => setStage("exiting")} className="anim-rise group mt-10 inline-flex items-center gap-3 rounded-md border border-water/50 bg-water/10 px-6 py-3 font-mono text-sm uppercase tracking-[0.25em] text-water shadow-[var(--shadow-glow)] transition-colors hover:bg-water/20" style={{ animationDelay: "0.6s" }}>
              Enter Digital Twin <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <div className="anim-rise label-xs mt-12 !text-warn/80" style={{ animationDelay: "0.75s" }}>Synthetic / illustrative MVP data · not a validated hydraulic safety model</div>
          </div>
        </div>
      )}
    </>
  );
}
