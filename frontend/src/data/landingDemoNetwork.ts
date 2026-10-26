import type { Network, NetworkNode } from "./types";

/** Isolated landing demonstration: no readings, capacity or evaluated outcomes. */
const component = (id: string, type: NetworkNode["type"], label: string): NetworkNode => ({
  id, type, label, sensor_ids: [], attributes: {},
});

export const landingDemoModel: { network: Network; flowStages: Record<string, number>; highlights: { compartmentId: string; sensorNodeId: string } } = {
  highlights: { compartmentId: "L1", sensorNodeId: "J1" },
  network: {
    network_id: "AEGIS Landing Demo",
    nodes: [
      component("C1", "collection_inlet", "Collection Inlet"),
      component("C2", "collection_inlet", "Collection Inlet"),
      component("C3", "collection_inlet", "Collection Inlet"),
      component("J1", "junction", "Junction"),
      component("J2", "junction", "Junction"),
      component("L1", "storage", "Storage"),
      component("R1", "recharge", "Recharge"),
      component("J3", "downstream_junction", "Downstream Junction"),
      component("O1", "outlet", "Outlet"),
    ],
    edges: [
      { id: "D1", from: "C1", to: "J1" },
      { id: "D2", from: "C2", to: "J1" },
      { id: "D3", from: "C3", to: "J2" },
      { id: "D4", from: "J1", to: "L1" },
      { id: "D5", from: "J1", to: "R1" },
      { id: "D6", from: "J2", to: "J3" },
      { id: "D7", from: "L1", to: "J3" },
      { id: "D8", from: "J3", to: "O1" },
    ],
  },
  // Authored illustrative animation stages, not hydraulic travel times.
  flowStages: { D1: 0, D2: 0, D3: 0, D4: 1, D5: 1, D6: 1, D7: 2, D8: 3 },
};