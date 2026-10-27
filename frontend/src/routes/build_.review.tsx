import { createFileRoute } from "@tanstack/react-router";
import { EngineeringReview } from "@/components/aegis/build/EngineeringReview";

export const Route = createFileRoute("/build_/review")({
  validateSearch: (s: Record<string, unknown>): { path: "new" | "redesign"; design: "A" | "B" | "C" } => ({
    path: s["path"] === "new" ? "new" : "redesign",
    design: s["design"] === "B" || s["design"] === "C" ? s["design"] : "A",
  }),
  head: () => ({
    meta: [
      { title: "AEGIS Build — Engineering Review" },
      { name: "description", content: "Step 08: review, modify and re-simulate the selected design before finalization." },
      { property: "og:title", content: "AEGIS Build — Engineering Review" },
      { property: "og:description", content: "Review, modify and prepare the selected design for finalization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Review,
});

function Review() {
  const { path, design } = Route.useSearch();
  return <EngineeringReview key={design} path={path} design={design} />;
}
