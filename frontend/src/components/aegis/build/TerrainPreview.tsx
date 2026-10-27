import { CONNECTION_POINTS, terrainScene } from "@/data/buildSetupDemo";

const REGION_LABELS: Record<string, { label: string; x: number; y: number }[]> = {
  north: [{ label: "Catchment North", x: 400, y: 65 }, { label: "High Elevation", x: 180, y: 108 }, { label: "Natural Drainage", x: 440, y: 260 }, { label: "Collection Zone", x: 255, y: 230 }, { label: "Existing Water Body", x: 610, y: 405 }],
  east: [{ label: "Catchment East", x: 400, y: 90 }, { label: "Natural Drainage", x: 655, y: 305 }, { label: "Low Point / Collection Zone", x: 390, y: 325 }, { label: "Existing Water Body", x: 475, y: 435 }],
  south: [{ label: "Catchment South", x: 400, y: 65 }, { label: "High Elevation", x: 610, y: 135 }, { label: "Natural Drainage", x: 480, y: 265 }, { label: "Collection Zone", x: 250, y: 315 }, { label: "Existing Water Body", x: 205, y: 447 }],
};

/** Engineering terrain analysis view (illustrative display geometry only). */
export function TerrainPreview({ terrainId, showPoints, selectedPoints, onTogglePoint, annotateRegions = false }: { terrainId?: string | null; showPoints: boolean; selectedPoints: string[]; onTogglePoint: (id: string) => void; annotateRegions?: boolean }) {
  const s = terrainScene(terrainId);
  return (
    <figure className="bt-view">
      <svg viewBox="0 0 800 480" role="img" aria-label="Terrain analysis preview">
        <defs>
          <pattern id="bt-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" className="bt-grid" /></pattern>
          <radialGradient id="bt-relief" cx="35%" cy="25%" r="80%">
            <stop offset="0" className="bt-relief-hi" /><stop offset="1" className="bt-relief-lo" />
          </radialGradient>
          <marker id="bt-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" className="bt-arrow-head" /></marker>
          <clipPath id="bt-clip"><path d={s.boundary} /></clipPath>
        </defs>
        <rect width="800" height="480" fill="url(#bt-grid)" />
        <path d={s.boundary} fill="url(#bt-relief)" />
        <g clipPath="url(#bt-clip)">
          {s.contours.map((d, i) => <path key={i} d={d} className={i % 2 ? "bt-contour" : "bt-contour is-index"} />)}
        </g>
        {s.blocks?.map(([x, y, w, h], i) => <rect key={`b${i}`} x={x} y={y} width={w} height={h} className="bt-block" />)}
        {s.roads.map((d) => <path key={d} d={d} className="bt-road" />)}
        <path d={s.water} className="bt-water" />
        <path d={s.boundary} className="bt-boundary" />
        {s.flows.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="bt-flow" markerEnd="url(#bt-arrow)" />)}
        {s.lowPoints.map((p, i) => <g key={i} className="bt-low"><circle cx={p.x} cy={p.y} r="9" /><circle cx={p.x} cy={p.y} r="2.5" /></g>)}
        {showPoints && CONNECTION_POINTS.map((p) => {
          const on = selectedPoints.includes(p.id);
          return <g key={p.id} className={on ? "bt-cp is-on" : "bt-cp"} role="button" tabIndex={0} aria-pressed={on} aria-label={`Connection point ${p.id}`}
            onClick={() => onTogglePoint(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTogglePoint(p.id); } }}>
            <rect x={p.x - 9} y={p.y - 9} width="18" height="18" /><text x={p.x + 14} y={p.y - 10}>{p.id}</text>
          </g>;
        })}
        <text x="74" y="78" className="bt-label">Catchment Boundary</text>
        {annotateRegions && (REGION_LABELS[terrainId ?? "north"] ?? REGION_LABELS["north"])?.map(({ label, x, y }) => <text key={label} x={x} y={y} className="bt-region-label">{label}</text>)}
      </svg>
      <figcaption className="bt-legend">
        <span><i className="lg-terrain" /><b>Terrain</b>Elevation</span>
        <span><i className="lg-flow" /><b>Flow</b>Natural drainage direction</span>
        <span><i className="lg-low" /><b>Low Point</b>Potential collection area</span>
        <span><i className="lg-water" /><b>Water Body</b>Protected / environmental area</span>
      </figcaption>
    </figure>
  );
}
