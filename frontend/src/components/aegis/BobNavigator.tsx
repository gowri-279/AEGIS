import { useState } from "react";
import { Bot, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanonicalResponse } from "@/data/types";

export function BobNavigator({ data, onSelect }: { data: CanonicalResponse; onSelect: (id: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("Try “Show me J3” or name a component from the inventory.");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = prompt.trim().replace(/^(show me|show|select|focus on|focus)\s+/i, "").replace(/[.!?]+$/, "").trim();
    if (!query) return;
    const match = data.network.nodes.find((node) => node.id.toLowerCase() === query.toLowerCase() || node.label.toLowerCase() === query.toLowerCase())
      ?? data.network.edges.find((edge) => edge.id.toLowerCase() === query.toLowerCase())
      ?? data.sensors.find((sensor) => sensor.id.toLowerCase() === query.toLowerCase());
    if (match) { onSelect(match.id); setMessage(`Selected ${match.id}. The network and component profile are focused on this selection.`); }
    else setMessage(`No canonical component matches “${query}”.`);
    setPrompt("");
  }
  const first = data.network.nodes[0]?.id ?? "a component";
  return <section className="bob-navigator" aria-label="Bob network navigator">
    <div className="bob-navigator-heading"><Bot size={17} /><strong>BOB</strong><span>NETWORK NAVIGATOR</span></div>
    <p aria-live="polite">{message}</p>
    <form onSubmit={submit}><input value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Ask Bob to select a component" placeholder={`Ask Bob, e.g. “Show me ${first}”`} /><Button type="submit" aria-label="Send to Bob"><CornerDownLeft size={15} /></Button></form>
  </section>;
}
