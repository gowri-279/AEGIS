import { createFileRoute } from "@tanstack/react-router";
import { DesignRequirementsScreen } from "@/components/aegis/build/DesignRequirementsScreen";

export const Route = createFileRoute("/build_/requirements")({
  validateSearch: (s: Record<string, unknown>): { path: "new" | "redesign" } => ({ path: s["path"] === "redesign" ? "redesign" : "new" }),
  head: () => ({
    meta: [
      { title: "AEGIS Build — Design Requirements" },
      { name: "description", content: "Step 02: define what the AEGIS network design should optimize and which constraints it must respect." },
      { property: "og:title", content: "AEGIS Build — Design Requirements" },
      { property: "og:description", content: "Define the design objectives, scenario and constraints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Requirements,
});

function Requirements() {
  const { path } = Route.useSearch();
  return <DesignRequirementsScreen path={path} />;
}
