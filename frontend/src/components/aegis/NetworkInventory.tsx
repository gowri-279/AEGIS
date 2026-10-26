import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { CanonicalResponse, NetworkEdge, NetworkNode } from "@/data/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "nodes" | "edges";
type Entry = { id: string; label: string; kind: string; status?: string | undefined; group: Exclude<Filter, "all"> };

export function NetworkInventory({ data, selectedId, onSelect, onSamplesFilter }: { data: CanonicalResponse; selectedId: string | null; onSelect: (id: string) => void; onSamplesFilter?: (visible: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const entries = useMemo<Entry[]>(() => [
    ...data.network.nodes.map((node: NetworkNode) => {
      const sensorStatuses = node.sensor_ids.map((id) => data.sensors.find((sensor) => sensor.id === id)?.status).filter(Boolean);
      const candidate = data.candidates.find((item) => item.id === node.candidate_id);
      const status = sensorStatuses[0] ?? (candidate ? candidate.feasible === true ? "feasible" : candidate.feasible === false ? "infeasible" : "not evaluated" : undefined);
      return { id: node.id, label: node.label, kind: node.type, status, group: "nodes" as const };
    }),
    ...data.sensors.map((sensor) => ({ id: sensor.id, label: `${sensor.variable} at ${sensor.node_id}`, kind: "sensor", status: sensor.status, group: "nodes" as const })),
    ...data.network.edges.map((edge: NetworkEdge) => ({ id: edge.id, label: `${edge.from} → ${edge.to}`, kind: "conduit", group: "edges" as const })),
  ], [data]);
  const visible = entries.filter((entry) => (filter === "all" || entry.group === filter) && `${entry.id} ${entry.label} ${entry.kind} ${entry.status ?? ""}`.toLowerCase().includes(query.toLowerCase().trim()));

  return <section className="engineering-panel network-inventory" aria-label="Network inventory">
    <div className="engineering-panel-title">NETWORK INVENTORY <span>{entries.length}</span></div>
    <label className="inventory-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" aria-label="Search network components" /></label>
    <div className="inventory-filters" role="group" aria-label="Filter inventory">
      {(["all", "nodes", "edges"] as Filter[]).map((item) => <button key={item} className={cn(filter === item && "active")} onClick={() => setFilter(item)}>{item}</button>)}
    </div>
    <div className="inventory-list">
      {visible.map((entry) => <button key={entry.id} className={cn("inventory-entry", selectedId === entry.id && "selected")} onClick={() => onSelect(entry.id)} aria-current={selectedId === entry.id ? "true" : undefined}>
        <span className="inventory-entry-mark" aria-hidden="true" />
        <span className="inventory-entry-copy"><strong>{entry.id}</strong><small>{entry.label} · {entry.kind}</small></span>
        {entry.status && <span className={`inventory-status status-${entry.status.replaceAll(" ", "-")}`}>{entry.status}</span>}
      </button>)}
      {!visible.length && <p className="engineering-note inventory-empty">No matching components.</p>}
    </div>
  </section>;
}
