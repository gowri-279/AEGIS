import { useState } from "react";
import { Bot, CornerDownLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanonicalResponse } from "@/data/types";
import { askMonitorBob } from "@/services/api";

export function BobNavigator({
  data,
  onSelect,
  onWhatIf,
}: {
  data: CanonicalResponse;
  onSelect: (id: string) => void;
  /** When Bob returns an allowlisted simulation request, run the existing Simulate pipeline. */
  onWhatIf?: (question: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("Try “Show me J3”, ask why a finding matters, or ask a what-if question.");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const raw = prompt.trim();
    if (!raw || pending) return;

    const navQuery = raw.replace(/^(show me|show|select|focus on|focus)\s+/i, "").replace(/[.!?]+$/, "").trim();
    const isNavIntent = /^(show me|show|select|focus on|focus)\s+/i.test(raw);
    const match = data.network.nodes.find((node) => node.id.toLowerCase() === navQuery.toLowerCase() || node.label.toLowerCase() === navQuery.toLowerCase())
      ?? data.network.edges.find((edge) => edge.id.toLowerCase() === navQuery.toLowerCase())
      ?? data.sensors.find((sensor) => sensor.id.toLowerCase() === navQuery.toLowerCase());

    if (match && (isNavIntent || navQuery.toLowerCase() === match.id.toLowerCase())) {
      onSelect(match.id);
      setMessage(`Selected ${match.id}. The network and component profile are focused on this selection.`);
      setPrompt("");
      return;
    }

    setPending(true);
    setPrompt("");
    try {
      const reply = await askMonitorBob(raw, data);
      if (reply.simulation_request && onWhatIf) {
        setMessage(reply.explanation || reply.simulation_request.explanation || "Running allowlisted AEGIS what-if simulation…");
        onWhatIf(raw);
        return;
      }
      setMessage(reply.explanation || "Bob could not form an explanation from the current AEGIS context.");
    } catch {
      setMessage("Bob is temporarily unavailable. Existing AEGIS assessment outputs remain authoritative.");
    } finally {
      setPending(false);
    }
  }

  const first = data.network.nodes[0]?.id ?? "a component";
  return <section className="bob-navigator" aria-label="Bob network navigator">
    <div className="bob-navigator-heading"><Bot size={17} /><strong>BOB</strong><span>NETWORK NAVIGATOR</span></div>
    <p aria-live="polite">{message}</p>
    <form onSubmit={(e) => void submit(e)}>
      <input value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Ask Bob to select a component" placeholder={`Ask Bob, e.g. “Show me ${first}”`} disabled={pending} />
      <Button type="submit" aria-label="Send to Bob" disabled={pending || !prompt.trim()}>
        {pending ? <Loader2 size={15} className="animate-spin" /> : <CornerDownLeft size={15} />}
      </Button>
    </form>
  </section>;
}
