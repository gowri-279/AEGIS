import { buildBackdropNetwork } from "@/data/buildDemo";

/** Decorative schematic network in the Monitor blueprint language. Illustrative only. */
export function BuildBackdrop() {
  const { nodes, links } = buildBackdropNetwork;
  const at = (id: string) => nodes.find((n) => n.id === id)!;
  return (
    <svg className="build-backdrop" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id="build-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" className="build-grid-line" />
        </pattern>
      </defs>
      <rect width="1200" height="700" fill="url(#build-grid)" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} className="build-contour" d={`M-20 ${520 - i * 70} C 260 ${430 - i * 60}, 520 ${600 - i * 80}, 820 ${470 - i * 60} S 1140 ${380 - i * 50}, 1240 ${420 - i * 60}`} />
      ))}
      {links.map(([a, b]) => { const p = at(a), q = at(b); return <line key={`${a}-${b}`} className="build-link-line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />; })}
      {links.map(([a, b]) => { const p = at(a), q = at(b); return <line key={`f-${a}-${b}`} className="build-link-flow" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />; })}
      {nodes.map((n) => n.kind === "storage"
        ? <rect key={n.id} className="build-node is-storage" x={n.x - 16} y={n.y - 10} width="32" height="20" />
        : <circle key={n.id} className={`build-node is-${n.kind}`} cx={n.x} cy={n.y} r={n.kind === "design" ? 6 : 4} />)}
    </svg>
  );
}
