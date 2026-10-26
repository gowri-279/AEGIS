import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { useDiagnosticScan } from "@/components/aegis/workspace/useDiagnosticScan";

afterEach(() => vi.useRealTimers());
describe("diagnostic presentation timing", () => {
  it("reveals findings only after the complete diagnostic sweep", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDiagnosticScan());
    act(() => result.current.scan());
    act(() => vi.advanceTimersByTime(4199));
    expect(result.current.phase).toBe("scanning");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.phase).toBe("done");
  });
  it("never alters canonical findings or sensor statuses during a scan", () => {
    vi.useFakeTimers();
    const before = JSON.stringify(fixtures.standard);
    const { result } = renderHook(() => useDiagnosticScan());
    act(() => result.current.scan());
    act(() => vi.advanceTimersByTime(4200));
    expect(result.current.phase).toBe("done");
    expect(JSON.stringify(fixtures.standard)).toBe(before);
  });
});
