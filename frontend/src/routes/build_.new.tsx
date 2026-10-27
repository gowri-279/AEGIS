import { createFileRoute } from "@tanstack/react-router";
import { NewNetworkSetup } from "@/components/aegis/build/BuildSetup";

export const Route = createFileRoute("/build_/new")({
  head: () => ({
    meta: [
      { title: "AEGIS Build — New Network Terrain Setup" },
      { name: "description", content: "Define the terrain and catchment where a new AEGIS stormwater network will be designed." },
      { property: "og:title", content: "AEGIS Build — New Network Terrain Setup" },
      { property: "og:description", content: "Step 01: define the terrain and catchment for a new network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewNetworkSetup,
});
