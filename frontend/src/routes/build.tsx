import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, HardHat, Radar } from "lucide-react";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "AEGIS Build — Infrastructure Design Studio" },
      {
        name: "description",
        content:
          "AEGIS Build is the upcoming design studio for exploring stormwater infrastructure before it reaches the real world.",
      },
      { property: "og:title", content: "AEGIS Build — Infrastructure Design Studio" },
      {
        property: "og:description",
        content: "Design and explore stormwater infrastructure before it reaches the real world.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildPage,
});

function BuildPage() {
  return (
    <div className="landing">
      <main className="build-placeholder">
        <span className="landing-card-icon build-icon">
          <HardHat size={26} />
        </span>
        <h1 className="build-title">Build</h1>
        <p className="landing-subtitle">Infrastructure Design Studio</p>
        <p className="build-copy">
          Design and explore stormwater infrastructure before it reaches the real world. This mode
          is under construction — the Build experience arrives in a future AEGIS release.
        </p>
        <div className="build-actions">
          <Link to="/" className="build-link">
            <ArrowLeft size={14} />
            Back To Home
          </Link>
          <Link to="/monitor" className="build-link is-primary">
            <Radar size={14} />
            Open Monitor
          </Link>
        </div>
      </main>
    </div>
  );
}
