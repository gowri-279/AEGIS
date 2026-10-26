import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanonicalResponse, NetworkNode } from "@/data/types";

const unavailable = "Unavailable";
const value = (input: string | number | boolean | null | undefined) =>
  input == null || input === "" ? unavailable : String(input);

export function ComponentProfile({
  data,
  id,
  onClose,
}: {
  data: CanonicalResponse;
  id: string;
  onClose: () => void;
}) {
  const node = data.network.nodes.find((item) => item.id === id);
  const edge = data.network.edges.find((item) => item.id === id);
  const selectedSensor = data.sensors.find((sensor) => sensor.id === id);
  const sample = !node && !edge && !selectedSensor && /^V[5-8]$/.test(id);
  if (!node && !edge && !selectedSensor && !sample) return null;
  const sensors = selectedSensor
    ? [selectedSensor]
    : node
      ? data.sensors.filter(
          (sensor) => node.sensor_ids.includes(sensor.id) || sensor.node_id === node.id,
        )
      : [];
  const risks = data.risks.filter(
    (risk) => risk.target_id === id || (node && risk.target_id === node.id),
  );
  const candidate = node?.candidate_id
    ? data.candidates.find((item) => item.id === node.candidate_id)
    : undefined;
  const connections = node
    ? data.network.edges.filter((item) => item.from === node.id || item.to === node.id)
    : edge
      ? [edge]
      : [];
  const title =
    node?.label ??
    (edge
      ? edge.id
      : selectedSensor
        ? `${selectedSensor.variable} at ${selectedSensor.node_id}`
        : `${id} sample visualization`);

  return (
    <aside className="component-profile" aria-label={`${id} component profile`}>
      <header className="component-profile-header">
        <div>
          <span className="eyebrow">
            {sample
              ? "VISUALIZATION SAMPLE"
              : edge
                ? "CANONICAL CONDUIT"
                : selectedSensor && !node
                  ? "CANONICAL SENSOR"
                  : "CANONICAL COMPONENT"}
          </span>
          <h2>{id}</h2>
          <p>{title}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="profile-close"
          aria-label="Close component profile"
          onClick={onClose}
        >
          <X size={19} />
        </Button>
      </header>
      {sample ? (
        <p className="engineering-note">
          Frontend-only sample visualization. Canonical status, measurements, connections, and
          operational data are unavailable.
        </p>
      ) : node ? (
        <>
          <ProfileSection title="Identity">
            <ProfileRow label="Type" value={node.type} />
            <ProfileRow
              label="Status"
              value={
                sensors[0]?.status ??
                (candidate
                  ? candidate.feasible === true
                    ? "Feasible"
                    : candidate.feasible === false
                      ? "Infeasible"
                      : "Not Evaluated"
                  : unavailable)
              }
            />
          </ProfileSection>
          <CanonicalNodeSections data={data} node={node} />
        </>
      ) : (
        <>
          <ProfileSection title="Identity">
            <ProfileRow label="Type" value={edge ? "Conduit" : "Sensor"} />
            {selectedSensor && (
              <ProfileRow label="Status" value={sensors[0]?.status ?? unavailable} />
            )}
            {edge && (
              <>
                <ProfileRow label="From" value={edge.from} />
                <ProfileRow label="To" value={edge.to} />
              </>
            )}
            {selectedSensor && (
              <>
                <ProfileRow label="Variable" value={selectedSensor.variable} />
                <ProfileRow label="Unit" value={selectedSensor.unit} />
                <ProfileRow label="Node" value={selectedSensor.node_id} />
              </>
            )}
          </ProfileSection>
          <ProfileSection title="Sensors">
            {sensors.length ? (
              sensors.map((sensor) => (
                <div className="profile-item" key={sensor.id}>
                  <strong>{sensor.id}</strong>
                  <span>
                    {sensor.variable}: {value(sensor.effective_value)}
                    {sensor.effective_value != null ? ` ${sensor.unit}` : ""}
                  </span>
                  <small>
                    Status: {sensor.status} · Confidence: {value(sensor.confidence)}
                  </small>
                </div>
              ))
            ) : (
              <p className="engineering-note">Unavailable</p>
            )}
          </ProfileSection>
          <ProfileSection title="Risks / Attention">
            {risks.length ? (
              risks.map((risk) => (
                <div className="profile-item" key={risk.id}>
                  <strong>{risk.title}</strong>
                  <span>
                    {risk.severity} · {risk.category.replaceAll("_", " ")}
                  </span>
                  <small>{risk.potential_impact}</small>
                </div>
              ))
            ) : (
              <p className="engineering-note">No canonical findings for this component.</p>
            )}
          </ProfileSection>
          <ProfileSection title="Connections">
            {connections.length ? (
              connections.map((connection) => (
                <div className="profile-item" key={connection.id}>
                  <strong>{connection.id}</strong>
                  <span>
                    {connection.from} → {connection.to}
                  </span>
                </div>
              ))
            ) : (
              <p className="engineering-note">Unavailable</p>
            )}
          </ProfileSection>
          <ProfileSection title="Limitations / Uncertainty">
            {data.recommendation.data_limitations.map((item) => (
              <p className="profile-note" key={item}>
                {item}
              </p>
            ))}
            {data.recommendation.uncertainty.map((item) => (
              <p className="profile-note" key={item}>
                {item}
              </p>
            ))}
          </ProfileSection>
        </>
      )}
    </aside>
  );
}

/** Canonical detail sections for one node, shared by the component profile and the
 *  unified health inspection panel. Renders supplied values only; missing stays Unavailable. */
export function CanonicalNodeSections({
  data,
  node,
}: {
  data: CanonicalResponse;
  node: NetworkNode;
}) {
  const sensors = data.sensors.filter(
    (sensor) => node.sensor_ids.includes(sensor.id) || sensor.node_id === node.id,
  );
  const risks = data.risks.filter((risk) => risk.target_id === node.id);
  const candidate = node.candidate_id
    ? data.candidates.find((item) => item.id === node.candidate_id)
    : undefined;
  const connections = data.network.edges.filter(
    (item) => item.from === node.id || item.to === node.id,
  );
  return (
    <>
      <ProfileSection title="Operational Data">
        {node.type === "junction" && (
          <ProfileRow
            label="Water Depth"
            value={value(
              sensors.find((sensor) => sensor.variable === "water_depth")?.effective_value,
            )}
            unit={
              sensors.find((sensor) => sensor.variable === "water_depth")?.effective_value != null
                ? sensors.find((sensor) => sensor.variable === "water_depth")?.unit
                : undefined
            }
          />
        )}
        {node.type === "storage" && (
          <ProfileRow
            label="Available Storage"
            value={value(
              node.attributes["available_storage_m3"] ?? candidate?.available_storage_m3,
            )}
            unit={
              node.attributes["available_storage_m3"] != null ||
              candidate?.available_storage_m3 != null
                ? "m³"
                : undefined
            }
          />
        )}
        {node.type === "recharge" && (
          <ProfileRow
            label="Recharge Eligibility"
            value={value(
              node.attributes["recharge_eligibility"] ??
                (candidate ? (candidate.eligible ? "Eligible" : "Ineligible") : undefined),
            )}
          />
        )}
        {Object.entries(node.attributes)
          .filter(([key]) => !["available_storage_m3", "recharge_eligibility"].includes(key))
          .map(([key, item]) => (
            <ProfileRow key={key} label={key.replaceAll("_", " ")} value={value(item)} />
          ))}
        {!sensors.length && node.type === "junction" && (
          <ProfileRow label="Water Depth" value={unavailable} />
        )}
      </ProfileSection>
      <ProfileSection title="Sensors">
        {sensors.length ? (
          sensors.map((sensor) => (
            <div className="profile-item" key={sensor.id}>
              <strong>{sensor.id}</strong>
              <span>
                {sensor.variable}: {value(sensor.effective_value)}
                {sensor.effective_value != null ? ` ${sensor.unit}` : ""}
              </span>
              <small>
                Status: {sensor.status} · Confidence: {value(sensor.confidence)}
              </small>
            </div>
          ))
        ) : (
          <p className="engineering-note">Unavailable</p>
        )}
      </ProfileSection>
      <ProfileSection title="Risks / Attention">
        {risks.length ? (
          risks.map((risk) => (
            <div className="profile-item" key={risk.id}>
              <strong>{risk.title}</strong>
              <span>
                {risk.severity} · {risk.category.replaceAll("_", " ")}
              </span>
              <small>{risk.potential_impact}</small>
            </div>
          ))
        ) : (
          <p className="engineering-note">No canonical findings for this component.</p>
        )}
      </ProfileSection>
      <ProfileSection title="Connections">
        {connections.length ? (
          connections.map((connection) => (
            <div className="profile-item" key={connection.id}>
              <strong>{connection.id}</strong>
              <span>
                {connection.from} → {connection.to}
              </span>
            </div>
          ))
        ) : (
          <p className="engineering-note">Unavailable</p>
        )}
      </ProfileSection>
      {candidate && (
        <ProfileSection title="Intervention / Candidate">
          <ProfileRow label="Candidate" value={candidate.id} />
          <ProfileRow
            label="Feasibility"
            value={
              candidate.feasible == null
                ? "Not Evaluated"
                : candidate.feasible
                  ? "Feasible"
                  : "Infeasible"
            }
          />
          <ProfileRow
            label="Available Storage"
            value={value(candidate.available_storage_m3)}
            unit={candidate.available_storage_m3 == null ? undefined : "m³"}
          />
          {candidate.constraints.map((constraint) => (
            <div className="profile-item" key={constraint.constraint_id}>
              <strong>{constraint.description}</strong>
              <span>{constraint.status.replaceAll("_", " ")}</span>
            </div>
          ))}
        </ProfileSection>
      )}
      <ProfileSection title="Limitations / Uncertainty">
        {data.recommendation.data_limitations.map((item) => (
          <p className="profile-note" key={item}>
            {item}
          </p>
        ))}
        {data.recommendation.uncertainty.map((item) => (
          <p className="profile-note" key={item}>
            {item}
          </p>
        ))}
      </ProfileSection>
    </>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="profile-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function ProfileRow({
  label,
  value: content,
  unit,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
}) {
  return (
    <div className="profile-row">
      <span>{label}</span>
      <strong>
        {content}
        {unit ? ` ${unit}` : ""}
      </strong>
    </div>
  );
}
