// 3D scene palette (WebGL materials need concrete colors; mirrors CSS tokens).
import type { SensorStatus, Severity } from "@/data/types";

export const P = {
  bg: "#07090c",
  grid: "#16313d",
  gridSection: "#1f5566",
  structure: "#1a232b",
  structureEdge: "#4fd1e6",
  water: "#2fd4ee",
  waterDeep: "#0e6f85",
  bob: "#a68cff",
  ok: "#3ddc97",
  warn: "#f5b544",
  crit: "#ff5a3c",
  muted: "#5b6670",
  terrain: "#1b2420",
};

export const sensorColor: Record<SensorStatus, string> = {
  fresh: P.ok, degraded: P.warn, stale: P.muted, missing: P.muted, invalid: P.crit, conflicting: P.warn,
};

export const severityColor: Record<Severity, string> = {
  low: P.water, moderate: P.warn, high: P.crit, critical: P.crit,
};
