import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import type { CanonicalResponse } from "@/data/types";
import { nodeRisks } from "@/lib/aegis";
import { EngineeringApp } from "@/components/aegis/EngineeringApp";
import { renderWithRouter } from "./renderWithRouter";
import { HealthProblemMarkers } from "@/components/aegis/workspace/HealthProblemMarkers";

vi.mock("@/services/api", async () => {
  const { mockHealthFindings } = await import("@/data/mockHealthFindings");
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    getCanonicalResponse: async () => fixtures.standard,
    getHealthFindings: async (id: string) => mockHealthFindings(id),
    runScenario: async () => fixtures.standard,
  };
});
vi.mock("@/components/aegis/workspace/useDiagnosticScan", () => ({
  useDiagnosticScan: () => ({ phase: "done", startedAt: null, scan: vi.fn() }),
}));
vi.mock("@/components/aegis/workspace/NetworkCanvas", () => ({
  NetworkCanvas: (props: {
    data: CanonicalResponse;
    mode: string;
    selectedId: string | null;
    selectionRevision: number;
    selectedFindingId: string | null;
    onSelectHealthFinding: (id: string) => void;
  }) => (
    <div
      data-testid="model-selection"
      data-selected={props.selectedId ?? ""}
      data-revision={props.selectionRevision}
    >
      {props.mode === "health" &&
        props.data.network.nodes.map((node) => (
          <HealthProblemMarkers
            key={node.id}
            nodeId={node.id}
            findings={nodeRisks(props.data, node)}
            selectedFindingId={props.selectedFindingId}
            onSelect={props.onSelectHealthFinding}
          />
        ))}
    </div>
  ),
}));
afterEach(cleanup);

async function openScan() {
  renderWithRouter(<EngineeringApp />);
  fireEvent.click(await screen.findByRole("button", { name: "Health" }));
  fireEvent.click(screen.getByRole("button", { name: "Run Health Scan" }));
  await screen.findByRole("button", { name: "L2: Overflow Risk, high" });
}

describe("Health Step 2 inspection", () => {
  it("Bob Decision Mode hides the finding and canonical panels, and Back restores them", async () => {
    await openScan();
    fireEvent.click(screen.getByRole("button", { name: "J3: Elevated Depth, moderate" }));
    fireEvent.click(screen.getByRole("button", { name: "Bob" }));
    const bob = screen.getByRole("complementary", { name: "Contextual Bob" });
    expect(bob).toHaveAttribute("data-component", "J3");
    expect(screen.queryByRole("complementary", { name: "Health problem details" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Inspector" })).toBeNull();
    fireEvent.click(within(bob).getByRole("button", { name: "Close Bob" }));
    expect(screen.queryByRole("complementary", { name: "Contextual Bob" })).toBeNull();
    expect(
      screen.getByRole("complementary", { name: "Health problem details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByTestId("model-selection")).toHaveAttribute("data-selected", "J3");
  });
  it("selects the real J3, preserves supplied 0.60/0.80 m and 0.94 confidence, and leaves Bob closed", async () => {
    await openScan();
    const before = JSON.stringify(fixtures);
    fireEvent.click(screen.getByRole("button", { name: "J3: Elevated Depth, moderate" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("J3");
    const panel = screen.getByRole("complementary", { name: "Health problem details" });
    expect(within(panel).getByText("0.60 m")).toBeInTheDocument();
    expect(within(panel).getByText("0.80 m")).toBeInTheDocument();
    expect(within(panel).getByText("0.94")).toBeInTheDocument();
    expect(
      within(panel).getByText("Surcharge risk toward upstream catchment if inflow rises."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "J3: Elevated Depth, moderate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(panel).queryByText("Operational Data")).toBeNull();
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getByText("CANONICAL COMPONENT")).toBeInTheDocument();
    expect(within(inspector).getByText("Operational Data")).toBeInTheDocument();
    expect(within(inspector).getByText("Risks / Attention")).toBeInTheDocument();
    expect(within(inspector).getByText("Connections")).toBeInTheDocument();
    expect(within(inspector).getByText("WL-J3")).toBeInTheDocument();
    expect(within(inspector).getByText(/water_depth: 0\.6 m/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(J3|L1|L2):/ })).toHaveLength(3);
    expect(screen.queryByRole("complementary", { name: "Contextual Bob" })).toBeNull();
    expect(JSON.stringify(fixtures)).toBe(before);
  });

  it("switches J3 to L1 in the same panel and refocuses repeated selection without changing severities", async () => {
    await openScan();
    fireEvent.click(screen.getByRole("button", { name: "J3: Elevated Depth, moderate" }));
    const panel = screen.getByRole("complementary", { name: "Health problem details" });
    fireEvent.click(screen.getByRole("button", { name: "L1: Limited Storage, low" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("L1");
    expect(screen.getByRole("complementary", { name: "Health problem details" })).toBe(panel);
    expect(within(panel).getByText("100 m³")).toBeInTheDocument();
    expect(within(panel).getByText("200 m³")).toBeInTheDocument();
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getAllByText("Available Storage").length).toBeGreaterThan(0);
    expect(within(inspector).getAllByText("100 m³").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "J3: Elevated Depth, moderate" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const revision = Number(screen.getByTestId("model-selection").dataset["revision"]);
    fireEvent.click(screen.getByRole("button", { name: "L1: Limited Storage, low" }));
    expect(Number(screen.getByTestId("model-selection").dataset["revision"])).toBeGreaterThan(
      revision,
    );
  });

  it("keeps all L2 measurements unknown and closing restores overview without resolving any problem", async () => {
    await openScan();
    fireEvent.click(screen.getByRole("button", { name: "L2: Overflow Risk, high" }));
    const panel = screen.getByRole("complementary", { name: "Health problem details" });
    expect(within(panel).getAllByText("Unknown")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Close problem details" }));
    await waitFor(() =>
      expect(screen.queryByRole("complementary", { name: "Health problem details" })).toBeNull(),
    );
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("");
    expect(screen.getAllByRole("button", { name: /^(J3|L1|L2):/ })).toHaveLength(3);
    expect(screen.queryByRole("complementary", { name: "Contextual Bob" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "L2: Overflow Risk, high" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("L2");
  });

  it("shows a single-line component title and cycles circularly through problem components", async () => {
    await openScan();
    fireEvent.click(screen.getByRole("button", { name: "J3: Elevated Depth, moderate" }));
    const panel = screen.getByRole("complementary", { name: "Health problem details" });
    expect(within(panel).getByRole("heading", { name: "J3 Junction" })).toBeInTheDocument();
    expect(within(panel).queryByText("Junction J3")).toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: "Next problem" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("L1");
    expect(within(panel).getByRole("heading", { name: "L1 Storage" })).toBeInTheDocument();
    expect(within(panel).getByText("100 m³")).toBeInTheDocument();
    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getAllByText("Available Storage").length).toBeGreaterThan(0);
    fireEvent.click(within(panel).getByRole("button", { name: "Next problem" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("L2");
    expect(within(panel).getByRole("heading", { name: "L2 Storage" })).toBeInTheDocument();
    expect(within(panel).getAllByText("Unknown")).toHaveLength(3);
    fireEvent.click(within(panel).getByRole("button", { name: "Next problem" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("J3");
    expect(within(panel).getByRole("heading", { name: "J3 Junction" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Previous problem" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Previous problem" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("L2");
    expect(within(panel).getByRole("heading", { name: "L2 Storage" })).toBeInTheDocument();
    expect(within(panel).getAllByText("Unknown")).toHaveLength(3);
    fireEvent.click(within(panel).getByRole("button", { name: "Previous problem" }));
    expect(screen.getByTestId("model-selection").dataset["selected"]).toBe("L1");
    expect(within(panel).getByRole("heading", { name: "L1 Storage" })).toBeInTheDocument();
    expect(within(panel).getByText("100 m³")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Contextual Bob" })).toBeNull();
  });
});
