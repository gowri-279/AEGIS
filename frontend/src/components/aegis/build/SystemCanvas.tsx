import { REDESIGN_LINKS, REDESIGN_NODES, REDESIGN_REGION, TERRAIN_SCENE } from "@/data/buildSetupDemo";
import { PROPOSED_PATH } from "@/data/buildAssessment";

/** Terrain + existing network schematic (display only). */
export function SystemCanvas({ scope = "region", proposed = false, label = "System overview" }: { scope?: string | null; proposed?: boolean; label?: string }) {
  const node = (id: string) => REDESIGN_NODES.find((n) => n.id === id)!;
  const region = scope === "region";
  const on = (id: string, kind: "node" | "link") => scope && (region ? (kind === "node" ? REDESIGN_REGION.nodeIds : REDESIGN_REGION.linkIds).includes(id) : scope === id);
  return (
    <svg viewBox="0 0 800 480" role="img" aria-label={label} className="sys-canvas">
      <defs>
        <pattern id="sys-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" className="bt-grid" /></pattern>
        <radialGradient id="sys-relief" cx="30%" cy="20%" r="85%"><stop offset="0" className="bt-relief-hi" /><stop offset="1" className="bt-relief-lo" /></radialGradient>
      </defs>
      <rect width="800" height="480" fill="url(#sys-grid)" />
      <path d={TERRAIN_SCENE.boundary} fill="url(#sys-relief)" />
      {TERRAIN_SCENE.contours.map((d, i) => <path key={i} d={d} className={i % 2 ? "bt-contour" : "bt-contour is-index"} />)}
      <path d={TERRAIN_SCENE.boundary} className="bt-boundary" />
      <path d="M500 230 C 520 200, 590 205, 594 245 C 598 285, 540 296, 515 280 C 494 266, 488 248, 500 230 Z" className="bt-water" />
      {TERRAIN_SCENE.lowPoints.map((p, i) => <g key={i} className="bt-low"><circle cx={p.x} cy={p.y + 40} r="8" /><circle cx={p.x} cy={p.y + 40} r="2.5" /></g>)}
      {REDESIGN_LINKS.map((l) => { const a = node(l.from), b = node(l.to); const d = `M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 24} ${b.x} ${b.y}`;
        return <g key={l.id} className={`rn-link ${on(l.id, "link") ? "is-on" : ""} ${l.warn ? "is-warn" : ""}`}><path d={d} className="rn-pipe" /><path d={d} className="rn-flow" /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 22}>{l.id}</text></g>; })}
      {proposed && <g className="sys-proposed"><path d={PROPOSED_PATH} /><text x="470" y="362">Proposed · Design A (placeholder)</text></g>}
      {REDESIGN_NODES.map((n) => <g key={n.id} className={`rn-node is-${n.kind} ${on(n.id, "node") ? "is-on" : ""} ${n.warn ? "is-warn" : ""}`}>
        {n.kind === "storage" ? <rect x={n.x - 16} y={n.y - 11} width="32" height="22" /> : n.kind === "outlet" ? <path d={`M${n.x - 11} ${n.y - 10}H${n.x + 11}L${n.x} ${n.y + 11}Z`} /> : <circle cx={n.x} cy={n.y} r="10" />}
        <text x={n.x} y={n.y + 30}>{n.id}</text>
      </g>)}
    </svg>
  );
}
