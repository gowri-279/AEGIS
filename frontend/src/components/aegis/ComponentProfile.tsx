import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanonicalResponse } from "@/data/types";
import { resolveComponentProfile, resolveEdgeProfile } from "@/data/componentIntelligence";

const unavailable = "Unavailable";
const value = (input: string | number | boolean | null | undefined) => input == null || input === "" ? unavailable : String(input);

export function ComponentProfile({ data, id, onClose }: { data: CanonicalResponse; id: string; onClose: () => void }) {
  const profile = resolveComponentProfile(data, id);
  const edge = data.network.edges.find((item) => item.id === id);
  const edgeIntel = resolveEdgeProfile(id);
  const selectedSensor = data.sensors.find((sensor) => sensor.id === id);
  const sample = !profile && !edge && !selectedSensor && /^V[5-8]$/.test(id);
  if (!profile && !edge && !selectedSensor && !sample) return null;

  if (profile) {
    return <aside className="component-profile" aria-label={`${id} component profile`} data-component-id={profile.component_id}>
      <header className="component-profile-header"><div><span className="eyebrow">CANONICAL COMPONENT</span><h2>{profile.component_id}</h2><p>{profile.name}</p></div><Button variant="ghost" size="icon" className="profile-close" aria-label="Close component profile" onClick={onClose}><X size={19} /></Button></header>
      <ProfileSection title="Identity">
        <ProfileRow label="Type" value={profile.component_type} />
        <ProfileRow label="Status" value={profile.status} />
      </ProfileSection>
      <ProfileSection title="Operational Data">
        {profile.operational.length ? profile.operational.map((row) => <ProfileRow key={row.label} label={row.label} value={row.value} unit={row.unit} />) : <p className="engineering-note">Not applicable</p>}
      </ProfileSection>
      <ProfileSection title="Sensors">
        {profile.sensors.length ? profile.sensors.map((sensor) => <div className="profile-item" key={sensor.id}><strong>{sensor.id}</strong><span>{sensor.summary}</span><small>{sensor.detail}</small></div>) : <p className="engineering-note">—</p>}
      </ProfileSection>
      <ProfileSection title="Risks / Attention">
        {profile.risks.length ? profile.risks.map((risk) => <div className="profile-item" key={risk.title}><strong>{risk.title}</strong><span>{risk.severity}</span><small>{risk.detail}</small></div>) : <p className="engineering-note">No canonical findings for this component.</p>}
      </ProfileSection>
      <ProfileSection title="Connections">
        {profile.connections.length ? profile.connections.map((connection) => <div className="profile-item" key={connection.id}><strong>{connection.id}</strong><span>{connection.from} → {connection.to}</span>{connection.summary && <small>{connection.summary}</small>}</div>) : <p className="engineering-note">Unavailable</p>}
        <p className="engineering-note">Upstream: {profile.upstream.join(", ") || "—"} · Downstream: {profile.downstream.join(", ") || "—"}</p>
      </ProfileSection>
      {profile.intervention && <ProfileSection title="Intervention / Candidate">
        <ProfileRow label="Candidate" value={profile.intervention.candidate_id} />
        <ProfileRow label="Feasibility" value={profile.intervention.feasibility} />
        {profile.intervention.available_storage_m3 != null && <ProfileRow label="Available Storage" value={String(profile.intervention.available_storage_m3)} unit="m³" />}
        {profile.intervention.constraints.map((constraint) => <div className="profile-item" key={`${constraint.description}:${constraint.status}`}><strong>{constraint.description}</strong><span>{constraint.status.replaceAll("_", " ")}</span></div>)}
      </ProfileSection>}
      <p className="engineering-note">{profile.engineering_significance}</p>
    </aside>;
  }

  return <aside className="component-profile" aria-label={`${id} component profile`}>
    <header className="component-profile-header"><div><span className="eyebrow">{sample ? "VISUALIZATION SAMPLE" : edge ? "CANONICAL CONDUIT" : "CANONICAL SENSOR"}</span><h2>{id}</h2><p>{edge ? `${edge.from} → ${edge.to}` : selectedSensor ? `${selectedSensor.variable} at ${selectedSensor.node_id}` : `${id} sample visualization`}</p></div><Button variant="ghost" size="icon" className="profile-close" aria-label="Close component profile" onClick={onClose}><X size={19} /></Button></header>
    {sample ? <p className="engineering-note">Frontend-only sample visualization. Canonical status, measurements, connections, and operational data are unavailable.</p> : <>
      <ProfileSection title="Identity">
        <ProfileRow label="Type" value={edge ? (edgeIntel?.type ?? "Conduit") : "Sensor"} />
        {selectedSensor && <ProfileRow label="Status" value={selectedSensor.status} />}
        {edge && <><ProfileRow label="From" value={edge.from} /><ProfileRow label="To" value={edge.to} /></>}
        {edgeIntel && <><ProfileRow label="Nominal Capacity" value={String(edgeIntel.nominal_capacity_m3_s)} unit="m³/s" /><ProfileRow label="Observed Loading" value={String(edgeIntel.observed_loading_m3_s)} unit="m³/s" /><ProfileRow label="Status" value={edgeIntel.status} /></>}
        {selectedSensor && <><ProfileRow label="Variable" value={selectedSensor.variable} /><ProfileRow label="Unit" value={selectedSensor.unit} /><ProfileRow label="Node" value={selectedSensor.node_id} /></>}
      </ProfileSection>
      {selectedSensor && <ProfileSection title="Sensors"><div className="profile-item"><strong>{selectedSensor.id}</strong><span>{selectedSensor.variable}: {value(selectedSensor.effective_value)}{selectedSensor.effective_value != null ? ` ${selectedSensor.unit}` : ""}</span><small>Status: {selectedSensor.status} · Confidence: {value(selectedSensor.confidence)}</small></div></ProfileSection>}
    </>}
  </aside>;
}

/** @deprecated Prefer resolveComponentProfile — retained for any callers still importing the name. */
export function CanonicalNodeSections({ data, node }: { data: CanonicalResponse; node: { id: string } }) {
  const profile = resolveComponentProfile(data, node.id);
  if (!profile) return null;
  return <>
    <ProfileSection title="Operational Data">{profile.operational.map((row) => <ProfileRow key={row.label} label={row.label} value={row.value} unit={row.unit} />)}</ProfileSection>
    <ProfileSection title="Sensors">{profile.sensors.length ? profile.sensors.map((sensor) => <div className="profile-item" key={sensor.id}><strong>{sensor.id}</strong><span>{sensor.summary}</span><small>{sensor.detail}</small></div>) : <p className="engineering-note">—</p>}</ProfileSection>
    <ProfileSection title="Risks / Attention">{profile.risks.length ? profile.risks.map((risk) => <div className="profile-item" key={risk.title}><strong>{risk.title}</strong><span>{risk.severity}</span><small>{risk.detail}</small></div>) : <p className="engineering-note">No canonical findings for this component.</p>}</ProfileSection>
    <ProfileSection title="Connections">{profile.connections.map((connection) => <div className="profile-item" key={connection.id}><strong>{connection.id}</strong><span>{connection.from} → {connection.to}</span></div>)}</ProfileSection>
  </>;
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="profile-section"><h3>{title}</h3>{children}</section>; }
function ProfileRow({ label, value: content, unit }: { label: string; value: string; unit?: string | undefined }) { return <div className="profile-row"><span>{label}</span><strong>{content}{unit ? ` ${unit}` : ""}</strong></div>; }
