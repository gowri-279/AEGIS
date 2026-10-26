/** In-memory mock network registry; never persisted and never computes engineering outcomes. */
import { fixtureStandard } from "./mockCanonicalResponse";
import { candidateDesign, KIND_LABEL, type CandidateId, type Design } from "./buildWorkspace";
import { layoutNetwork, registerNetworkPresentation } from "./networkLayout";
import type { BuildPathKind } from "./buildRequirements";
import type { CanonicalResponse, Network, NetworkNode } from "./types";

export const EXISTING_NETWORK_ID = "BLR-SYNTHETIC-01";
export const NEW_NETWORK_ID = "BLR-SYNTHETIC-02";
export interface BuildDraft { path: BuildPathKind; candidate: CandidateId; design: Design; revision: number; simulatedRevision: number; notes: string }
export interface SessionNetwork {
  id: string; name: string; status: "Active" | "Updated" | "New"; revision: number;
  response: CanonicalResponse; design: BuildDraft | null;
}
const original: SessionNetwork = { id: EXISTING_NETWORK_ID, name: "Existing Bengaluru stormwater network", status: "Active", revision: 0, response: fixtureStandard, design: null };
let registry = { activeId: EXISTING_NETWORK_ID, networks: [original] };
const listeners = new Set<() => void>();
const drafts = new Map<string, BuildDraft>();
export const getNetworkSession = () => registry;
export const subscribeNetworkSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => listeners.forEach((listener) => listener());
export function selectSessionNetwork(id: string) {
  if (!registry.networks.some((entry) => entry.id === id)) return;
  registry = { ...registry, activeId: id }; emit();
}
export function getSessionDraft(path: BuildPathKind, candidate: CandidateId): BuildDraft {
  return drafts.get(`${path}:${candidate}`) ?? { path, candidate, design: candidateDesign(candidate, path), revision: 0, simulatedRevision: 0, notes: "" };
}
export function saveSessionDraft(draft: BuildDraft) { drafts.set(`${draft.path}:${draft.candidate}`, structuredClone(draft)); }

function canonicalNode(n: Design["nodes"][number]): NetworkNode {
  return { id: n.id, type: n.kind === "outfall" ? "outlet" : n.kind === "detention" ? "storage" : n.kind,
    label: `${KIND_LABEL[n.kind]} ${n.id}`, sensor_ids: [], attributes: { design_status: "Engineer Approved", ...Object.fromEntries(n.props), ...(n.purpose ? { purpose: n.purpose } : {}) } };
}

export function finalizeSessionNetwork(draft: BuildDraft, approved: boolean, blockingIssues: number): SessionNetwork {
  if (!approved || blockingIssues !== 0 || draft.revision !== draft.simulatedRevision) throw new Error("A current simulation and explicit engineer approval are required.");
  const baseline = fixtureStandard.network;
  const redesign = draft.path === "redesign";
  const id = redesign ? EXISTING_NETWORK_ID : NEW_NETWORK_ID;
  const network: Network = {
    network_id: id,
    nodes: draft.design.nodes.map((n) => baseline.nodes.find((b) => redesign && b.id === n.id) ?? canonicalNode(n)),
    edges: draft.design.links.map(({ id: edgeId, from, to }) => ({ id: edgeId, from, to })),
  };
  const ids = new Set(network.nodes.map((n) => n.id));
  if (network.edges.some((e) => !ids.has(e.from) || !ids.has(e.to))) throw new Error("The approved design contains a connection without its component.");
  const frame = layoutNetwork(baseline);
  // Reuse the original coordinate frame. Existing positions never move; new
  // design positions are translated only as unitless presentation coordinates.
  registerNetworkPresentation(network, { width: frame.width, height: frame.height, nodes: Object.fromEntries(draft.design.nodes.map((n) => [n.id,
    (redesign ? frame.nodes[n.id] : undefined) ?? { x: n.x / 800 * frame.width, y: n.y / 480 * frame.height }])) });
  const response: CanonicalResponse = { ...fixtureStandard, fixture_id: `${id}:R${draft.revision}`, fixture_label: "Finalized Build Design · Synthetic · Illustrative", network,
    sensors: redesign ? fixtureStandard.sensors : [], risks: redesign ? fixtureStandard.risks : [], candidates: [],
    recommendation: { recommendation_status: "abstained", selected_candidate_id: null, recommendation_scope: "finalized_mock_design", safety_qualified: false,
      rationale: ["No Monitor scenario evaluation has been supplied for this finalized design."], uncertainty: ["New infrastructure has no live monitoring observations."], data_limitations: ["Session-only synthetic design. Build approval does not establish operational safety."] },
  };
  const entry: SessionNetwork = { id, name: redesign ? original.name : "Newly designed network", status: redesign ? "Updated" : "New", revision: draft.revision, response, design: structuredClone(draft) };
  registry = { activeId: id, networks: [...registry.networks.filter((n) => n.id !== id), entry].sort((a, b) => a.id.localeCompare(b.id)) }; emit();
  return entry;
}