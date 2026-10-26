import { createFileRoute } from "@tanstack/react-router";
import { RedesignNetworkSetup } from "@/components/aegis/build/BuildSetup";

export const Route = createFileRoute("/build_/redesign")({
  head: () => ({
    meta: [
      { title: "AEGIS Build — Redesign Network Selection" },
      { name: "description", content: "Select the existing AEGIS network region you want to improve." },
      { property: "og:title", content: "AEGIS Build — Redesign Network Selection" },
      { property: "og:description", content: "Step 01: select an existing AEGIS network region to redesign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RedesignNetworkSetup,
});
