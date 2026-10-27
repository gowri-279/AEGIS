import { createFileRoute } from "@tanstack/react-router";
import { BuildHome } from "@/components/aegis/build/BuildHome";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "AEGIS Build — AI-Assisted Stormwater Network Design" },
      { name: "description", content: "Design a new stormwater network or redesign an existing AEGIS network using terrain, reliability intelligence and simulation." },
      { property: "og:title", content: "AEGIS Build — AI-Assisted Stormwater Network Design" },
      { property: "og:description", content: "Design a new network or redesign an existing AEGIS network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildHome,
});
