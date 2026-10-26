import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { EngineeringApp } from "@/components/aegis/EngineeringApp";
import { renderWithRouter } from "./renderWithRouter";

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  const { mockHealthFindings } = await import("@/data/mockHealthFindings");
  return { ...actual, getCanonicalResponse: async () => fixtures.standard, getHealthFindings: async (id: string) => mockHealthFindings(id), runScenario: async () => fixtures.critical_stale };
});
vi.mock("@/components/aegis/workspace/NetworkCanvas", () => ({ NetworkCanvas: () => null }));
afterEach(cleanup);
describe("analytical workspace state", () => {
  it("runs the Health scan without any scan-evidence panel or button", async () => {
    renderWithRouter(<EngineeringApp />);
    await screen.findByRole("button", { name: "Health" });
    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    expect(screen.queryByRole("complementary", { name: "Health controls" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Contextual Bob" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run Health Scan" }));
    expect(screen.getByRole("button", { name: "Scanning…" })).toBeDisabled();
    await screen.findByRole("button", { name: "Run Health Scan" }, { timeout: 6000 });
    expect(screen.queryByRole("button", { name: "Scan evidence" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Health controls" })).toBeNull();
  }, 10000);
  it("minimizes Simulate without resetting the canonical result or candidate selection", async () => {
    renderWithRouter(<EngineeringApp />);
    await screen.findByRole("button", { name: "Simulate" });
    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Scenario" }));
    await waitFor(() => expect(screen.getAllByText("Abstained").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /C-L2 storage at L2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize Simulate panel" }));
    expect(screen.getByRole("complementary", { name: "Inspector" })).toHaveTextContent("L2");
    fireEvent.click(screen.getAllByRole("button", { name: "Simulate" })[1] ?? screen.getByRole("button", { name: "Simulate" }));
    expect(screen.getAllByText("Not evaluated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Abstained").length).toBeGreaterThan(0);
  });
});