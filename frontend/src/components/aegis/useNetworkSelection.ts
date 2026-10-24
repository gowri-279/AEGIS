import { useCallback, useState } from "react";

/** Shared selection source for inventory, scene, and future navigation surfaces. */
export function useNetworkSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const select = useCallback((id: string | null) => setSelectedId(id), []);
  return { selectedId, select };
}
