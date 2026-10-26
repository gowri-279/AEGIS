import { createFileRoute } from "@tanstack/react-router";
import { DesignBriefScreen } from "@/components/aegis/build/DesignBriefScreen";

export const Route = createFileRoute("/build_/brief")({
  validateSearch: (s: Record<string, unknown>): { path: "new" | "redesign" } => ({ path: s["path"] === "redesign" ? "redesign" : "new" }),
  head: () => ({
    meta: [
      { title: "AEGIS Build — Design Brief" },
      { name: "description", content: "Step 03: the assembled terrain, network and requirements design context." },
      { property: "og:title", content: "AEGIS Build — Design Brief" },
      { property: "og:description", content: "Terrain, network and requirements in a single design context." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Brief,
});

function Brief() {
  const { path } = Route.useSearch();
  return <DesignBriefScreen path={path} />;
}
