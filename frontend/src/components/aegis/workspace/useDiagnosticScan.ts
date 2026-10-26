import { useEffect, useRef, useState } from "react";

/** Wall-clock presentation timing only; never evaluates network health. */
export const DIAGNOSTIC_SWEEP_MS = 4200;
export function useDiagnosticScan() {
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function scan() {
    if (timer.current) clearTimeout(timer.current);
    setStartedAt(performance.now());
    setPhase("scanning");
    timer.current = setTimeout(() => setPhase("done"), DIAGNOSTIC_SWEEP_MS);
  }
  return { phase, startedAt, scan };
}