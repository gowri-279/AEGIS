import { useEffect, useState } from "react";
import { Bot, CornerDownLeft, Loader2 } from "lucide-react";
import type { CanonicalResponse } from "@/data/types";
import { bobReply, type BobMessage } from "@/data/mockBob";
import { resolveTarget } from "@/lib/aegis";
import { askMonitorBob } from "@/services/api";
import { explain } from "./bobExplain";

/** AI interaction boundary. Prefer live Monitor Bob; fall back to local mock narration. */
export function BobPanel({ data, selectedId, onSelect, onWhatIf }: {
  data: CanonicalResponse;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onWhatIf?: (question: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [thread, setThread] = useState<BobMessage[]>([]);
  const [pending, setPending] = useState(false);
  useEffect(() => { setThread([]); }, [data]);
  const lines = explain(data, selectedId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || pending) return;
    const target = q.replace(/^(show me|show|select|focus on|focus)\s+/i, "").replace(/[.!?]+$/, "").trim().toLowerCase();
    const match = [...data.network.nodes.map((n) => n.id), ...data.network.edges.map((x) => x.id), ...data.sensors.map((s) => s.id), ...data.candidates.map((c) => c.id)].find((id) => id.toLowerCase() === target);
    if (match && /^(show me|show|select|focus on|focus)\s+/i.test(q)) {
      onSelect(resolveTarget(data, match));
      setThread((t) => [...t, { role: "user" as const, text: q }, { role: "bob" as const, text: `Selected ${match}. The network is focused on it and its profile is open.` }].slice(-6));
      setPrompt("");
      return;
    }

    setPending(true);
    setPrompt("");
    try {
      const live = await askMonitorBob(q, data);
      if (live.simulation_request && onWhatIf) {
        setThread((t) => [...t, { role: "user" as const, text: q }, { role: "bob" as const, text: live.explanation || live.simulation_request.explanation || "Running allowlisted AEGIS what-if…" }].slice(-6));
        onWhatIf(q);
        return;
      }
      const reply = live.explanation || bobReply(q, data);
      setThread((t) => [...t, { role: "user" as const, text: q }, { role: "bob" as const, text: reply }].slice(-6));
    } catch {
      setThread((t) => [...t, { role: "user" as const, text: q }, { role: "bob" as const, text: bobReply(q, data) }].slice(-6));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bob" aria-label="Bob assistant">
      <header className="bob-head"><span className="bob-mark"><Bot size={14} /></span><strong>Bob</strong><small>explains the canonical response</small></header>
      <ul className="bob-lines">
        {lines.map((l) => (
          <li key={l.text}>{l.text}{l.refs.length > 0 && <span className="bob-refs">{[...new Set(l.refs)].map((r) => <button key={r} onClick={() => onSelect(resolveTarget(data, r))}>{r}</button>)}</span>}</li>
        ))}
      </ul>
      {thread.length > 0 && <div className="bob-thread" aria-live="polite">{thread.map((m, i) => <p key={i} className={`bob-msg is-${m.role}`}>{m.text}</p>)}</div>}
      <form className="bob-form" onSubmit={(e) => void submit(e)}>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={`Ask Bob, e.g. “Show me ${data.network.nodes[0]?.id ?? "a component"}”`} aria-label="Ask Bob" disabled={pending} />
        <button type="submit" aria-label="Send" disabled={pending || !prompt.trim()}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <CornerDownLeft size={14} />}
        </button>
      </form>
      <p className="bob-foot">Bob does not calculate physics, feasibility, ranking or safety.</p>
    </section>
  );
}
