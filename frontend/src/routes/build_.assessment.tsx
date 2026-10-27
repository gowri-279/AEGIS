import { createFileRoute } from "@tanstack/react-router";
import { NetworkAssessmentScreen } from "@/components/aegis/build/NetworkAssessmentScreen";

export const Route = createFileRoute("/build_/assessment")({
  validateSearch: (s: Record<string, unknown>): { path: "new" | "redesign" } => ({ path: s["path"] === "redesign" ? "redesign" : "new" }),
  head: () => ({
    meta: [
      { title: "AEGIS Build — Network Assessment" },
      { name: "description", content: "Step 04: AEGIS assesses terrain, network, reliability and downstream constraints before design." },
      { property: "og:title", content: "AEGIS Build — Network Assessment" },
      { property: "og:description", content: "Terrain, network, reliability and downstream assessment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assessment,
});

function Assessment() {
  const { path } = Route.useSearch();
  return <NetworkAssessmentScreen path={path} />;
}
