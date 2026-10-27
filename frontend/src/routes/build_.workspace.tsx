import { createFileRoute } from "@tanstack/react-router";
import { BuildWorkspace } from "@/components/aegis/build/BuildWorkspace";

export const Route = createFileRoute("/build_/workspace")({
  validateSearch: (s: Record<string, unknown>): { path: "new" | "redesign"; view?: "results" } => ({ path: s["path"] === "redesign" ? "redesign" : "new", ...(s["view"] === "results" ? { view: "results" as const } : {}) }),
  head: () => ({
    meta: [
      { title: "AEGIS Build — Build Workspace" },
      { name: "description", content: "Step 05: the AEGIS Build workspace with Bob candidate designs." },
      { property: "og:title", content: "AEGIS Build — Build Workspace" },
      { property: "og:description", content: "Design tools, terrain canvas and Bob intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const { path, view } = Route.useSearch();
  return <BuildWorkspace path={path} showResults={view === "results"} />;
}
