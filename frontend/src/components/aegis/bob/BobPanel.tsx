import { useEffect, useState } from "react";
import { Bot, CornerDownLeft } from "lucide-react";
import type { CanonicalResponse } from "@/data/types";
import { bobReply, type BobMessage } from "@/data/mockBob";
import { resolveTarget } from "@/lib/aegis";
import { explain } from "./bobExplain";

/** AI interaction boundary. Provider is abstract; today it is the local mock. */
export function BobPanel({
  data,
  selectedId,
  onSelect,
}: {
  data: CanonicalResponse;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [thread, setThread] = useState<BobMessage[]>([]);
  useEffect(() => {
    setThread([]);
  }, [data]);
  const lines = explain(data, selectedId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q) return;
    const target = q
      .replace(/^(show me|show|select|focus on|focus)\s+/i, "")
      .replace(/[.!?]+$/, "")
      .trim()
      .toLowerCase();
    const match = [
      ...data.network.nodes.map((n) => n.id),
      ...data.network.edges.map((x) => x.id),
      ...data.sensors.map((s) => s.id),
      ...data.candidates.map((c) => c.id),
    ].find((id) => id.toLowerCase() === target);
    const reply = match
      ? `Selected ${match}. The network is focused on it and its profile is open.`
      : bobReply(q, data);
    if (match) onSelect(resolveTarget(data, match));
    setThread((t) =>
      [...t, { role: "user" as const, text: q }, { role: "bob" as const, text: reply }].slice(-6),
    );
    setPrompt("");
  }

  return (
    <section className="bob" aria-label="Bob assistant">
      <header className="bob-head">
        <span className="bob-mark">
          <Bot size={14} />
        </span>
        <strong>Bob</strong>
        <small>explains the canonical response</small>
      </header>
      <ul className="bob-lines">
        {lines.map((l) => (
          <li key={l.text}>
            {l.text}
            {l.refs.length > 0 && (
              <span className="bob-refs">
                {[...new Set(l.refs)].map((r) => (
                  <button key={r} onClick={() => onSelect(resolveTarget(data, r))}>
                    {r}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      {thread.length > 0 && (
        <div className="bob-thread" aria-live="polite">
          {thread.map((m, i) => (
            <p key={i} className={`bob-msg is-${m.role}`}>
              {m.text}
            </p>
          ))}
        </div>
      )}
      <form className="bob-form" onSubmit={submit}>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Ask Bob, e.g. “Show me ${data.network.nodes[0]?.id ?? "a component"}”`}
          aria-label="Ask Bob"
        />
        <button type="submit" aria-label="Send">
          <CornerDownLeft size={14} />
        </button>
      </form>
      <p className="bob-foot">Bob does not calculate physics, feasibility, ranking or safety.</p>
    </section>
  );
}
