import { describe, expect, it } from "vitest";
import { canConfirmFinalization } from "./buildFinalize";

describe("Build finalization rules", () => {
  it("stays disabled until the engineer approves", () => { expect(canConfirmFinalization(false, 0)).toBe(false); expect(canConfirmFinalization(true, 0)).toBe(true); });
  it("never finalizes with a blocking issue", () => { expect(canConfirmFinalization(true, 1)).toBe(false); });
});
