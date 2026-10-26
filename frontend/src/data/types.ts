// Canonical AEGIS data contracts (mirrors backend concepts).
// These shapes are consumed as-is; the frontend never derives them.

export type NodeType = "collection_inlet" | "junction" | "storage" | "recharge" | "downstream_junction" | "outlet";

export interface NetworkNode {
  id: string;
  type: NodeType;
  label: string;
  sensor_ids: string[];
  candidate_id?: string | undefined;
  attributes: Record<string, string | number | boolean | null>;
}

export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
}

export interface Network {
  network_id: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export type SensorStatus = "fresh" | "degraded" | "stale" | "missing" | "invalid" | "conflicting";

export interface Sensor {
  id: string;
  node_id: string;
  variable: string;
  unit: string;
  critical: boolean;
  raw_value: number | null;
  effective_value: number | null;
  status: SensorStatus;
  confidence: number | null; // data usability, NOT hazard probability
  timestamp: string | null;
  issue?: string | undefined;
}

export type RiskCategory =
  | "hydraulic_overload"
  | "overflow"
  | "bottleneck"
  | "infrastructure_anomaly"
  | "water_quality"
  | "downstream_propagation"
  | "data_reliability";

export type Severity = "low" | "moderate" | "high" | "critical";

export interface RiskFinding {
  id: string;
  category: RiskCategory;
  target_id: string;
  title: string;
  observed_value: number | null;
  threshold: number | null;
  unit?: string | undefined;
  severity: Severity;
  confidence: number | null;
  evidence: string[];
  potential_impact: string;
}

export type ConstraintStatus = "pass" | "fail" | "not_evaluated";

export interface ConstraintEvaluation {
  constraint_id: string;
  description: string;
  status: ConstraintStatus;
  observed: number | null;
  limit: number | null;
  unit: string;
  note?: string | undefined;
}

export interface Candidate {
  id: string;
  node_id: string;
  kind: "storage" | "recharge";
  route_edge_ids: string[];
  available_storage_m3: number | null;
  eligible: boolean;
  feasible: boolean | null;
  constraints: ConstraintEvaluation[];
  rank: number | null;
}

export interface SimulationResult {
  /** Service-authored session outcome; baseline measurements are not recalculated. */
  session_resolution?: { plan_id: string; status: "feasible" };
  /** Input identity when several scenario options share a supplied fixture. */
  scenario_option_id?: string;
  scenario_id: string;
  diverted_volume_m3: number;
  duration_s: number;
  proposed_flow_m3s: number;
  model_note: string;
}

export type RecommendationStatus = "recommended" | "no_feasible_candidate" | "abstained";

export interface Recommendation {
  recommendation_status: RecommendationStatus;
  selected_candidate_id: string | null;
  recommendation_scope: string;
  safety_qualified: boolean;
  rationale: string[];
  uncertainty: string[];
  data_limitations: string[];
}

export interface CanonicalResponse {
  fixture_id: string;
  fixture_label: string;
  data_provenance: "synthetic_illustrative";
  generated_at: string;
  network: Network;
  sensors: Sensor[];
  risks: RiskFinding[];
  simulation: SimulationResult;
  candidates: Candidate[];
  recommendation: Recommendation;
}
