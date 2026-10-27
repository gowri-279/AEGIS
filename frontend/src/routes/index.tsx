import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/aegis/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AEGIS — Reliability-Aware Stormwater Intelligence" },
      { name: "description", content: "AEGIS is a reliability-aware stormwater intelligence platform: see the network, understand its risks, and make better infrastructure decisions." },
      { property: "og:title", content: "AEGIS — Reliability-Aware Stormwater Intelligence" },
      { property: "og:description", content: "See the network. Understand its risks. Make better decisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
