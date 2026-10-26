import { useCallback, useState } from "react";

/** Shared selection source for inventory, scene, and future navigation surfaces. */
export function useNetworkSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectionRevision((revision) => revision + 1);
  }, []);
  return { selectedId, selectionRevision, select };
}
