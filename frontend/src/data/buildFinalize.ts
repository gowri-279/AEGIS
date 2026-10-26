/** Build Step 10 — Finalize Design + Add To AEGIS Network mock data. Synthetic, illustrative; nothing is persisted or deployed. */
export const FINALIZE_STEPS = ["Terrain", "Requirements", "Design Brief", "Network Assessment", "Build Workspace", "Simulation", "Engineering Review"];
export const FINAL_INFRASTRUCTURE: [string, string][] = [["J5", "Junction"], ["P21", "Pipe / Drain"], ["D01", "Detention / Storage"], ["R01", "Recharge / Infiltration"], ["O1", "Existing Outfall Retained"]];
export const FINAL_RESULTS: [string, string, string, string?][] = [
  ["Flood Risk", "100", "69", "−31%"], ["J3 Utilization", "87%", "61%"], ["O1 Utilization", "78%", "74%"],
  ["Downstream Load", "100", "82", "−18%"], ["Lake Impact", "High", "Low"], ["Network Resilience", "68", "84", "+24%"],
];
export const DEMO_NOTE = "Design retains the existing O1 outfall, reduces the J3 bottleneck, adds detention and recharge capacity, and avoids transferring excessive hydraulic load downstream.";
export const FINALIZE_SEQUENCE = ["Locking Design Revision", "Recording Engineering Decision", "Attaching Simulation Result", "Preparing Network Update", "Finalization Complete"];
export const NETWORK_SEQUENCE = ["Loading Current Network", "Applying Design Revision", "Updating Network Model", "Updating Risk State", "Updating Network Health", "Network Update Complete"];
export const NETWORK_CHANGES = ["Add J5", "Add P21", "Add D01", "Add R01", "Retain O1", "Update network risk state", "Update network capacity model"];
export const NETWORK_RESULT: [string, string][] = [["Network Status", "Updated"], ["Network Health", "84/100"], ["Flood Risk", "Reduced"], ["Downstream Risk", "Controlled"], ["Environmental Impact", "Acceptable"]];

/** Finalization requires explicit engineer approval and no blocking issues. */
export function canConfirmFinalization(approved: boolean, blockingIssues: number) {
  return approved && blockingIssues === 0;
}
