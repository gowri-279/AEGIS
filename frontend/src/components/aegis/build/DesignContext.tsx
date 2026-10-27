import { DEMO_TERRAINS, DEMO_TERRAIN_ID, REDESIGN_LINKS, REDESIGN_NODES, REDESIGN_REGION } from "@/data/buildSetupDemo";
import type { BuildPathKind } from "@/data/buildRequirements";
import type { BuildFlowState } from "./buildFlowStore";

export interface ContextRow { label: string; value: string; warn?: boolean }

/** Context rows from previous-step selections (falls back to demo values on direct entry). */
export function designContextRows(path: BuildPathKind, flow: BuildFlowState, detailed = false): ContextRow[] {
  if (path === "new") {
    const t = DEMO_TERRAINS.find((x) => x.id === (flow.terrainId ?? DEMO_TERRAIN_ID))!;
    const network = flow.connection === "yes" ? `Connected${flow.points.length ? ` · ${flow.points.join(", ")}` : ""}` : flow.connection === "no" ? "Independent" : "Not specified";
    return [
      { label: "Terrain", value: t.name },
      { label: detailed ? "Area" : "Catchment", value: t.analysis.area },
      ...(detailed ? [{ label: "Elevation", value: t.analysis.elevation }, { label: "Average Slope", value: t.analysis.slope }] : []),
      { label: detailed ? "Network" : "Network Connection", value: network },
    ];
  }
  const scope = flow.redesignScope;
  const label = !scope || scope === "region" ? REDESIGN_REGION.label : scope;
  return [
    { label: "Selected Region", value: label },
    ...(detailed ? [] : [{ label: "Current Condition", value: REDESIGN_REGION.condition }]),
    { label: "Network Utilization", value: REDESIGN_REGION.utilization },
    detailed ? { label: "Detected Issue", value: REDESIGN_REGION.condition, warn: true } : { label: "Risk", value: REDESIGN_REGION.risk, warn: true },
  ];
}

export function ContextList({ rows }: { rows: ContextRow[] }) {
  return <dl className="bs-stats">{rows.map((r) => <div key={r.label}><dt>{r.label}</dt><dd className={r.warn ? "is-warn" : ""}>{r.value}</dd></div>)}</dl>;
}

/** Compact redesign schematic with the selected scope highlighted (display only). */
export function MiniNetwork({ scope }: { scope: string | null }) {
  const node = (id: string) => REDESIGN_NODES.find((n) => n.id === id)!;
  const region = !scope || scope === "region";
  const on = (id: string, kind: "node" | "link") => region ? (kind === "node" ? REDESIGN_REGION.nodeIds : REDESIGN_REGION.linkIds).includes(id) : scope === id;
  return (
    <svg viewBox="60 100 700 340" className="brief-mini" role="img" aria-label="Selected redesign scope">
      {REDESIGN_LINKS.map((l) => { const a = node(l.from), b = node(l.to);
        return <path key={l.id} d={`M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 24} ${b.x} ${b.y}`} className={`rn-pipe ${on(l.id, "link") ? "is-on" : ""}`} />; })}
      {REDESIGN_NODES.map((n) => <g key={n.id} className={`rn-node is-${n.kind} ${on(n.id, "node") ? "is-on" : ""}`}>
        {n.kind === "storage" ? <rect x={n.x - 16} y={n.y - 11} width="32" height="22" /> : <circle cx={n.x} cy={n.y} r="10" />}
        <text x={n.x} y={n.y + 30}>{n.id}</text>
      </g>)}
    </svg>
  );
}
