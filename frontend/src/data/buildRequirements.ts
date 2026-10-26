/** Build Step 3 requirement options (frontend demo configuration; replaceable by API). */
export type BuildPathKind = "new" | "redesign";

export interface Option { id: string; label: string; short: string; description?: string }

export const PRIMARY_OBJECTIVES: Option[] = [
  { id: "flooding", label: "Reduce Flooding", short: "Flood Reduction", description: "Reduce flood exposure and peak overflow across the catchment." },
  { id: "capacity", label: "Increase Drainage Capacity", short: "Drainage Capacity", description: "Improve the ability of the network to safely convey stormwater." },
  { id: "downstream", label: "Reduce Downstream Load", short: "Downstream Load", description: "Reduce pressure transferred to downstream infrastructure." },
  { id: "lake", label: "Protect Lake / Water Body", short: "Lake Protection", description: "Prioritize protection of downstream lakes and sensitive water bodies." },
  { id: "resilience", label: "Improve Resilience", short: "Resilience", description: "Improve network performance under severe rainfall conditions." },
  { id: "balanced", label: "Balanced Optimization", short: "Balanced Optimization", description: "Balance flood risk, network capacity, downstream impact and environmental protection." },
];

export const SECONDARY_OBJECTIVES: Option[] = [
  { id: "flooding", label: "Reduce Flooding", short: "Flood Reduction" },
  { id: "lake", label: "Protect Lake / Water Body", short: "Lake Protection" },
  { id: "downstream", label: "Reduce Downstream Load", short: "Downstream Load" },
  { id: "reuse", label: "Reuse Existing Infrastructure", short: "Existing Infrastructure" },
  { id: "minimal", label: "Minimize Construction", short: "Minimal Construction" },
  { id: "resilience", label: "Improve Network Resilience", short: "Resilience" },
];

export const SCENARIOS: Option[] = [
  { id: "normal", label: "Normal", short: "Normal Rainfall", description: "Typical rainfall conditions." },
  { id: "heavy", label: "Heavy", short: "Heavy Rainfall", description: "High rainfall event." },
  { id: "extreme", label: "Extreme", short: "Extreme Rainfall", description: "Severe rainfall event." },
];

export const CONSTRAINTS: Option[] = [
  { id: "infra", label: "Protect Existing Infrastructure", short: "Existing Infrastructure", description: "Avoid unnecessary modification of functioning infrastructure." },
  { id: "water", label: "Avoid Protected Water Bodies", short: "Protected Water Body", description: "Do not place proposed infrastructure inside protected water-body zones." },
  { id: "nobuild", label: "Avoid No-Build Zones", short: "No-Build Zones", description: "Respect designated construction restrictions." },
  { id: "footprint", label: "Minimize Construction Footprint", short: "Compact Footprint", description: "Prefer compact interventions where possible." },
  { id: "connections", label: "Preserve Existing Connections", short: "Existing Connections", description: "Maintain important upstream/downstream network connections." },
];

export const INFRA_PRIORITIES = ["Preserve wherever possible", "Preserve critical infrastructure", "Allow redesign where beneficial"] as const;
export const ENV_PRIORITIES = ["Standard", "High", "Critical"] as const;

export interface DesignRequirements {
  primary: string | null;
  secondary: string[];
  scenario: string | null;
  constraints: string[];
  maxFootprint: string;
  infraPriority: (typeof INFRA_PRIORITIES)[number];
  envPriority: (typeof ENV_PRIORITIES)[number];
}

export const DEFAULT_REQUIREMENTS: DesignRequirements = {
  primary: "balanced",
  secondary: ["lake", "reuse", "resilience"],
  scenario: "extreme",
  constraints: ["infra", "water", "nobuild", "connections"],
  maxFootprint: "No limit",
  infraPriority: "Preserve critical infrastructure",
  envPriority: "High",
};

export const shortOf = (list: Option[], id: string | null) => list.find((o) => o.id === id)?.short ?? "—";

export function requirementsComplete(r: DesignRequirements): boolean {
  return !!r.primary && !!r.scenario && r.constraints.length > 0;
}

const PRIMARY_PHRASE: Record<string, string> = {
  flooding: "optimized to reduce flooding",
  capacity: "optimized for increased drainage capacity",
  downstream: "optimized to reduce downstream load",
  lake: "optimized to protect lakes and water bodies",
  resilience: "optimized for resilience",
  balanced: "optimized for balanced performance",
};
const CONSTRAINT_PHRASE: Record<string, string> = {
  infra: "preserving critical existing infrastructure",
  water: "protecting downstream water bodies",
  nobuild: "respecting no-build zones",
  footprint: "minimizing construction footprint",
  connections: "maintaining existing network connections",
};

const join = (parts: string[]) => parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

/** Deterministic sentence assembled from selections — not AI-generated. */
export function designIntent(r: DesignRequirements, path: BuildPathKind): string {
  const resilient = r.secondary.includes("resilience") || r.primary === "resilience" ? "resilient " : "";
  const subject = path === "new" ? `Design a ${resilient}stormwater network` : `Redesign the selected region as a ${resilient}network`;
  const goal = r.primary ? ` ${PRIMARY_PHRASE[r.primary]}` : "";
  const scenario = r.scenario ? ` under ${shortOf(SCENARIOS, r.scenario).toLowerCase()}` : "";
  const cons = r.constraints.map((c) => CONSTRAINT_PHRASE[c]).filter(Boolean) as string[];
  return `${subject}${goal}${scenario}${cons.length ? `, while ${join(cons)}` : ""}.`;
}
