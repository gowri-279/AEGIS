import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const EngineeringApp = lazy(() =>
  import("@/components/aegis/EngineeringApp").then((m) => ({ default: m.EngineeringApp })),
);

export const Route = createFileRoute("/monitor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AEGIS Monitor — Stormwater Network Decision Support" },
      {
        name: "description",
        content:
          "Engineering digital twin for a stormwater network: topology, sensor reliability, what-if simulation and explained recommendations.",
      },
      { property: "og:title", content: "AEGIS Monitor — Stormwater Network Decision Support" },
      {
        property: "og:description",
        content: "See the network. Understand the risk. Review the decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Monitor,
});

function Monitor() {
  return (
    <Suspense
      fallback={
        <div className="ws-loading">
          <span className="ws-loading-mark">AEGIS</span>
        </div>
      }
    >
      <EngineeringApp />
    </Suspense>
  );
}
