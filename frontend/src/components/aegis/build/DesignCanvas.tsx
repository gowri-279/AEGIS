import { TERRAIN_SCENE } from "@/data/buildSetupDemo";
import { PROTECTED_ZONE, SNAP_POINTS, type Design, type ToolId } from "@/data/buildWorkspace";

interface Props {
  design: Design; tool: ToolId; selectedId: string | null; pendingFrom: string | null;
  onSelectNode: (id: string) => void; onSelectLink: (id: string) => void;
  onCanvasClick: (x: number, y: number) => void; onSnap: (x: number, y: number) => void;
}

/** Interactive design canvas over the display-only terrain schematic (unitless viewBox geometry). */
export function DesignCanvas({ design, tool, selectedId, pendingFrom, onSelectNode, onSelectLink, onCanvasClick, onSnap }: Props) {
  const byId = new Map(design.nodes.map((n) => [n.id, n]));
  const snaps = SNAP_POINTS[tool] ?? [];
  const connecting = tool === "pipe" || tool === "channel";
  function bgClick(e: React.MouseEvent<SVGRectElement>) {
    const svg = e.currentTarget.ownerSVGElement!; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse()); onCanvasClick(p.x, p.y);
  }
  const key = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  return (
    <svg viewBox="0 0 800 480" role="img" aria-label="Network design canvas" className={`sys-canvas dc ${tool !== "select" ? "is-placing" : ""}`}>
      <defs>
        <pattern id="dc-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" className="bt-grid" /></pattern>
        <radialGradient id="dc-relief" cx="30%" cy="20%" r="85%"><stop offset="0" className="bt-relief-hi" /><stop offset="1" className="bt-relief-lo" /></radialGradient>
        <marker id="dc-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" className="bt-arrow-head" /></marker>
      </defs>
      <rect width="800" height="480" fill="url(#dc-grid)" onClick={bgClick} />
      <g pointerEvents="none">
        <path d={TERRAIN_SCENE.boundary} fill="url(#dc-relief)" />
        {TERRAIN_SCENE.contours.map((d, i) => <path key={i} d={d} className={i % 2 ? "bt-contour" : "bt-contour is-index"} />)}
        {TERRAIN_SCENE.roads.map((d, i) => <path key={i} d={d} className="dc-road" />)}
        <path d={TERRAIN_SCENE.boundary} className="bt-boundary" />
        {TERRAIN_SCENE.flows.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="dc-terrain-flow" markerEnd="url(#dc-arrow)" />)}
        <ellipse {...PROTECTED_ZONE} className="dc-protected" />
        <text x={PROTECTED_ZONE.cx} y={PROTECTED_ZONE.cy - PROTECTED_ZONE.ry - 6} className="dc-zone-label">Protected Area</text>
        <path d="M500 230 C 520 200, 590 205, 594 245 C 598 285, 540 296, 515 280 C 494 266, 488 248, 500 230 Z" className="bt-water" />
        {[{ x: 250, y: 245 }, { x: 380, y: 270 }, { x: 520, y: 340 }, { x: 610, y: 390 }].map((p, i) => <g key={i} className="bt-low"><circle cx={p.x} cy={p.y} r="8" /><circle cx={p.x} cy={p.y} r="2.5" /></g>)}
        <text x="560" y="468" className="dc-zone-label">Eastern Low-Point Corridor</text>
      </g>
      {design.links.map((l) => {
        const a = byId.get(l.from), b = byId.get(l.to); if (!a || !b) return null;
        const d = `M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 20} ${b.x} ${b.y}`;
        const w = l.proposed ? 1.6 + l.capacity / 60 : 2.2;
        return <g key={l.id} role="button" tabIndex={0} aria-label={`${l.proposed ? "Proposed " : ""}${l.id}`} onClick={() => onSelectLink(l.id)} onKeyDown={key(() => onSelectLink(l.id))}
          className={`dc-link ${l.proposed ? "is-proposed" : "is-existing"} is-${l.kind} ${l.warn ? "is-warn" : ""} ${selectedId === l.id ? "is-on" : ""}`}>
          <path d={d} className="rn-hit" /><path d={d} className="dc-pipe" style={{ strokeWidth: w }} /><path d={d} className="dc-flow" markerEnd="url(#dc-arrow)" />
          <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 16}>{l.id}</text>
          {l.warn && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} className="dc-warn-tag">Bottleneck</text>}
        </g>;
      })}
      {design.nodes.map((n) => {
        const on = selectedId === n.id || pendingFrom === n.id;
        return <g key={n.id} role="button" tabIndex={0} aria-label={`${n.proposed ? "Proposed " : ""}${n.id}`} onClick={() => onSelectNode(n.id)} onKeyDown={key(() => onSelectNode(n.id))}
          className={`dc-node is-${n.kind} ${n.proposed ? "is-proposed" : "is-existing"} ${n.warn ? "is-warn" : ""} ${on ? "is-on" : ""} ${connecting ? "is-target" : ""}`}>
          {n.kind === "storage" || n.kind === "detention" ? <rect x={n.x - 15} y={n.y - 10} width="30" height="20" />
            : n.kind === "outfall" ? <path d={`M${n.x - 11} ${n.y - 10}H${n.x + 11}L${n.x} ${n.y + 11}Z`} />
            : n.kind === "recharge" ? <path d={`M${n.x} ${n.y - 12}L${n.x + 12} ${n.y}L${n.x} ${n.y + 12}L${n.x - 12} ${n.y}Z`} />
            : <circle cx={n.x} cy={n.y} r="9" />}
          <text x={n.x} y={n.y + 26}>{n.id}</text>
          {n.proposed && <text x={n.x} y={n.y - 17} className="dc-prop-tag">Proposed</text>}
          {n.id === "O1" && <text x={n.x} y={n.y - 18} className="dc-warn-tag">78% Utilization</text>}
        </g>;
      })}
      {snaps.map((s) => <g key={s.id} className="dc-snap" role="button" tabIndex={0} aria-label={`Placement point ${s.id}`} onClick={() => onSnap(s.x, s.y)} onKeyDown={key(() => onSnap(s.x, s.y))}>
        <circle cx={s.x} cy={s.y} r="11" /><path d={`M${s.x - 5} ${s.y}H${s.x + 5}M${s.x} ${s.y - 5}V${s.y + 5}`} />
      </g>)}
    </svg>
  );
}
