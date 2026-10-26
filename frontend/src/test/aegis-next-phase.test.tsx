import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/data/mockCanonicalResponse";
import { mockHealthFindings } from "@/data/mockHealthFindings";
import { mockSimBobReply, simBobIntent } from "@/data/simBob";
import { getSimBobReply } from "@/services/api";
import type { CanonicalResponse } from "@/data/types";
import { nodeRisks } from "@/lib/aegis";
import { EngineeringApp } from "@/components/aegis/EngineeringApp";
import { renderWithRouter } from "./renderWithRouter";
import { ReviewPanel } from "@/components/aegis/workspace/ModePanels";
import type { BobDecision } from "@/data/bobInterventions";
import { HealthProblemMarkers } from "@/components/aegis/workspace/HealthProblemMarkers";

describe("Simulate Bob mock assistant", () => {
  it("answers the L2-unavailable what-if with supplied 800 m³ and an L1-only topology visual", () => {
    const reply = mockSimBobReply("What happens if L2 is unavailable?", fixtures.standard);
    expect(reply.text).toContain("800 m³");
    expect(reply.text).toContain("L1 becomes the limiting storage component");
    expect(reply.fixture).toBe("standard");
    const edges = Object.keys(reply.visual?.edgeStages ?? {});
    expect(edges).toEqual(["E-C1-J3", "E-C2-J3", "E-J3-L1", "E-L1-J4", "E-J4-O1"]);
    expect(
      edges.every((id) => fixtures.standard.network.edges.some((edge) => edge.id === id)),
    ).toBe(true);
    expect(reply.visual?.nodeStates["L1"]).toEqual({
      severity: "critical",
      storageLevel: "raised",
    });
    expect(JSON.stringify(fixtures.standard)).not.toContain("L2_UNAVAILABLE");
  });
  it("runs the supplied stress fixture for rainfall questions and critical_stale for sensor failure", () => {
    expect(mockSimBobReply("What happens if rainfall increases?", fixtures.standard).fixture).toBe(
      "stress",
    );
    expect(mockSimBobReply("What happens if this sensor fails?", fixtures.standard).fixture).toBe(
      "critical_stale",
    );
    expect(simBobIntent("What if we route more water through L1?")).toBe("overview");
  });
  it("reads the limiting storage component from supplied failed constraints without calculating", () => {
    const reply = mockSimBobReply("Which storage is under the most pressure?", fixtures.standard);
    expect(reply.text).toContain("L1 is the limiting storage component");
    expect(reply.text).toContain("observed 200 m³, limit 100 m³");
    const stress = mockSimBobReply("Which storage is under the most pressure?", fixtures.stress);
    expect(stress.text).toContain("L1 is the limiting storage component");
  });
  it("is deterministic and never calls the network", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await getSimBobReply("Can the network handle this volume?", fixtures.standard)).toEqual(
      await getSimBobReply("Can the network handle this volume?", fixtures.standard),
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

vi.mock("@/services/api", async () => {
  const { mockHealthFindings } = await import("@/data/mockHealthFindings");
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    getCanonicalResponse: async () => fixtures.standard,
    getHealthFindings: async (id: string) => mockHealthFindings(id),
    runScenario: async (req: { fixture: keyof typeof fixtures; scenarioOptionId?: string }) => ({
      ...fixtures[req.fixture],
      simulation: { ...fixtures[req.fixture].simulation, scenario_option_id: req.scenarioOptionId },
    }),
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

describe("Health → action plan → Review completion flow", () => {
  it("keeps the problem active after approval and resolves it only when every action is completed", async () => {
    renderWithRouter(<EngineeringApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Health" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Health Scan" }));
    fireEvent.click(await screen.findByRole("button", { name: "J3: Elevated Depth, moderate" }));
    fireEvent.click(screen.getByRole("button", { name: "Bob" }));
    const bob = screen.getByRole("complementary", { name: "Contextual Bob" });

    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(3400); // no-action demonstration
    fireEvent.click(within(bob).getByRole("button", { name: "Run Proposed Solution" }));
    await vi.advanceTimersByTimeAsync(3400); // solution demonstration
    fireEvent.click(within(bob).getByRole("button", { name: "Approve" }));
    fireEvent.click(within(bob).getByRole("button", { name: "Confirm Decision" }));
    vi.useRealTimers();

    // Approval alone must NOT resolve the problem.
    expect(
      screen.getByRole("button", { name: "J3: Elevated Depth, moderate" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const review = await screen.findByRole("complementary", { name: "Review controls" });
    expect(within(review).getByText("J3 — Hydraulic Pressure Overload")).toBeInTheDocument();
    fireEvent.click(
      within(review).getByRole("button", { name: /J3 — Hydraulic Pressure Overload/ }),
    );
    expect(within(review).getByText("Approved · pending")).toBeInTheDocument();
    // Component slab still shows the active problem.
    const slab = within(review).getByRole("button", { name: /^J3 Moderate/ });
    expect(within(slab).getByText("Moderate")).toBeInTheDocument();
    expect(within(slab).getByText("Elevated depth at J3")).toBeInTheDocument();

    const ticks = within(review).getAllByRole("button", { name: /^Complete action:/ });
    expect(ticks).toHaveLength(5);
    for (const tick of ticks.slice(0, 4)) fireEvent.click(tick);
    // Partial completion must NOT resolve the problem.
    expect(within(review).getByRole("button", { name: /^J3 Moderate/ })).toBeInTheDocument();
    expect(within(review).getByText("Approved · pending")).toBeInTheDocument();
    fireEvent.click(ticks[4]!);
    expect(within(review).getByText("Completed · resolved")).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Back to action plan menu" }));
    const completedMenu = within(review).getByLabelText("Action plan");
    expect(
      within(completedMenu).queryByRole("button", { name: /J3 — Hydraulic Pressure Overload/ }),
    ).toBeNull();
    expect(within(completedMenu).getByText("No Action Plans currently")).toBeInTheDocument();

    // Shared state: back in Health the J3 problem is gone, L1/L2 remain.
    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "J3: Elevated Depth, moderate" })).toBeNull(),
    );
    expect(screen.getByRole("button", { name: "L1: Limited Storage, low" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "L2: Overflow Risk, high" })).toBeInTheDocument();

    // And the Review slab now reads Healthy for J3.
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const reviewAfter = await screen.findByRole("complementary", { name: "Review controls" });
    expect(within(reviewAfter).getByRole("button", { name: /^J3 Healthy/ })).toBeInTheDocument();
  }, 20000);
});

describe("Simulate mode Scenario/Bob toggle", () => {
  it("shows Scenario and Bob toggle buttons, and a Bob question populates interpretation plus the same Evaluation/Result sections", async () => {
    renderWithRouter(<EngineeringApp />);
    await screen.findAllByText(/blr-synthetic-01/i, undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    // Toggle present, Scenario selected by default
    const toggle = screen.getByRole("group", { name: /simulation input method/i });
    const scenarioTab = within(toggle).getByRole("button", { name: /^Scenario$/ });
    const bobTab = within(toggle).getByRole("button", { name: /^Bob$/ });
    expect(scenarioTab.getAttribute("aria-pressed")).toBe("true");
    expect(bobTab.getAttribute("aria-pressed")).toBe("false");
    // Switch to Bob: question input replaces the scenario selector
    fireEvent.click(bobTab);
    const input = await screen.findByLabelText(/ask bob a simulation question/i);
    expect(screen.queryByRole("button", { name: /run scenario/i })).toBeNull();
    // Ask a rainfall question — Bob runs the same pipeline
    fireEvent.change(input, { target: { value: "What happens if heavy rainfall occurs?" } });
    fireEvent.click(screen.getByRole("button", { name: /send to bob/i }));
    await screen.findByText(/Heavy-rain scenario · synthetic/i, undefined, { timeout: 5000 });
    // Evaluation and Result sections still present and populated from the stress fixture
    expect(screen.getByText("2 · Evaluation")).toBeTruthy();
    expect(screen.getByText("3 · Result")).toBeTruthy();
    expect(screen.getAllByText(/high-inflow|stress/i).length).toBeGreaterThan(0);
  }, 15000);
});

describe("Simulation recommendation → Review action plan", () => {
  it("clicking the Recommended box creates a normal (non-priority) action plan in Review", async () => {
    renderWithRouter(<EngineeringApp />);
    await screen.findAllByText(/blr-synthetic-01/i, undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    fireEvent.click(screen.getByRole("button", { name: /run scenario/i }));
    const banner = await screen.findByRole("button", { name: /Recommended · C-L2/i });
    fireEvent.click(banner);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const review = await screen.findByRole("complementary", { name: "Review controls" });
    // Simulation plan appears as a normal plan: no PRIORITY badge.
    fireEvent.click(within(review).getByRole("button", { name: /L2 — Standard/ }));
    expect(
      within(review).getByText(/Implement recommended storage candidate C-L2/),
    ).toBeInTheDocument();
    expect(within(review).queryByText("PRIORITY")).toBeNull();
    expect(within(review).getByText("Approved · pending")).toBeInTheDocument();
    // Limitations section is removed from Review.
    expect(within(review).queryByText(/Data & modeling limitations/i)).toBeNull();
    for (const tick of within(review).getAllByRole("button", { name: /^Complete action:/ }))
      fireEvent.click(tick);
    expect(within(review).getByText("Completed · resolved")).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Back to action plan menu" }));
    const completedMenu = within(review).getByLabelText("Action plan");
    expect(within(completedMenu).queryByRole("button", { name: /L2 — Standard/ })).toBeNull();
    expect(within(completedMenu).getByText("No Action Plans currently")).toBeInTheDocument();
  }, 15000);

  it("priority filter and pagination work across health and simulation plans", async () => {
    renderWithRouter(<EngineeringApp />);
    await screen.findAllByText(/blr-synthetic-01/i, undefined, { timeout: 5000 });

    // Simulation plan (normal).
    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    fireEvent.click(screen.getByRole("button", { name: /run scenario/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Recommended · C-L2/i }));

    // Health plan (priority) via the Bob approval flow.
    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Health Scan" }));
    fireEvent.click(await screen.findByRole("button", { name: "J3: Elevated Depth, moderate" }));
    fireEvent.click(screen.getByRole("button", { name: "Bob" }));
    const bob = screen.getByRole("complementary", { name: "Contextual Bob" });
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(3400);
    fireEvent.click(within(bob).getByRole("button", { name: "Run Proposed Solution" }));
    await vi.advanceTimersByTimeAsync(3400);
    fireEvent.click(within(bob).getByRole("button", { name: "Approve" }));
    fireEvent.click(within(bob).getByRole("button", { name: "Confirm Decision" }));
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const review = await screen.findByRole("complementary", { name: "Review controls" });
    // Two headings share one menu page; only Health carries priority.
    const menu = within(review).getByLabelText("Action plan");
    expect(within(menu).getAllByRole("button", { name: /—/ })).toHaveLength(2);
    expect(within(menu).queryByRole("navigation")).toBeNull();
    fireEvent.click(within(menu).getByRole("button", { name: "Priority" }));
    expect(within(menu).getAllByRole("button", { name: /—/ })).toHaveLength(1);
    expect(
      within(menu).getByRole("button", { name: /J3 — Hydraulic Pressure Overload/ }),
    ).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("button", { name: "Priority" }));
    expect(within(menu).getAllByRole("button", { name: /—/ })).toHaveLength(2);
  }, 25000);
});

describe("Review Action Plan heading menu", () => {
  const plans: BobDecision[] = Array.from({ length: 5 }, (_, index) => ({
    id: `plan-${index}`,
    componentId: `L${index + 1}`,
    problem: `Problem ${index + 1}`,
    intervention: `Solution ${index + 1}`,
    outcome: "Supplied mock outcome",
    steps: ["Check supplied evidence"],
    status: "Approved · pending",
    createdAt: "2026-10-26T00:00:00Z",
    doneSteps: [],
    source: "mock",
    priority: index < 3,
  }));
  it("shows two plans per page and navigates forward, backward and by page number", () => {
    render(<ReviewPanel data={fixtures.standard} plans={plans} onSelect={vi.fn()} />);
    const panel = screen.getByLabelText("Action plan");
    expect(within(panel).getAllByRole("button", { name: /—/ })).toHaveLength(2);
    expect(within(panel).queryByRole("button", { name: /L3 —/ })).toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: "Next action plan page" }));
    expect(within(panel).getAllByRole("button", { name: /—/ })).toHaveLength(2);
    expect(within(panel).getByRole("button", { name: /L3 —/ })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Previous action plan page" }));
    expect(within(panel).getByRole("button", { name: /L1 —/ })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Action plan page 3" }));
    expect(within(panel).getAllByRole("button", { name: /—/ })).toHaveLength(1);
    expect(within(panel).getByRole("button", { name: /L5 —/ })).toBeInTheDocument();
  });
  it("opens the same plan completion control, returns to its menu page, and filters by stored priority", () => {
    const toggle = vi.fn();
    render(
      <ReviewPanel
        data={fixtures.standard}
        plans={plans}
        onSelect={vi.fn()}
        onToggleStep={toggle}
      />,
    );
    const panel = screen.getByLabelText("Action plan");
    fireEvent.click(within(panel).getByRole("button", { name: "Action plan page 2" }));
    fireEvent.click(within(panel).getByRole("button", { name: /L3 —/ }));
    fireEvent.click(within(panel).getByRole("button", { name: /^Complete action:/ }));
    expect(toggle).toHaveBeenCalledWith("plan-2", 0);
    fireEvent.click(within(panel).getByRole("button", { name: "Back to action plan menu" }));
    expect(within(panel).getByRole("button", { name: /L3 —/ })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Priority" }));
    expect(within(panel).getAllByRole("button", { name: /—/ })).toHaveLength(2);
    fireEvent.click(within(panel).getByRole("button", { name: "Next action plan page" }));
    expect(within(panel).getAllByRole("button", { name: /—/ })).toHaveLength(1);
    expect(within(panel).getByRole("button", { name: /L3 —/ })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Priority" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Action plan page 3" }));
    expect(within(panel).getByRole("button", { name: /L5 —/ })).toBeInTheDocument();
  });
  it.each([true, false])(
    "retains completed details until back, excluding the plan from both menu filters (priority=%s)",
    (priority) => {
      const pending: BobDecision = {
        id: "completion-plan",
        componentId: "L2",
        problem: "Overflow Risk",
        priority,
        intervention: "Supplied solution",
        outcome: "Supplied mock outcome",
        steps: ["First check", "Second check"],
        status: "Approved · pending",
        createdAt: "2026-10-26T00:00:00Z",
        doneSteps: [],
        source: "mock",
      };
      const select = vi.fn();
      const toggle = vi.fn();
      const { rerender } = render(
        <ReviewPanel
          data={fixtures.standard}
          plans={[pending]}
          onSelect={select}
          onToggleStep={toggle}
        />,
      );
      const panel = screen.getByLabelText("Action plan");
      fireEvent.click(within(panel).getByRole("button", { name: /L2 — Overflow Risk/ }));
      rerender(
        <ReviewPanel
          data={fixtures.standard}
          plans={[{ ...pending, doneSteps: [0] }]}
          onSelect={select}
          onToggleStep={toggle}
        />,
      );
      fireEvent.click(within(panel).getByRole("button", { name: "Back to action plan menu" }));
      expect(within(panel).getByRole("button", { name: /L2 — Overflow Risk/ })).toBeInTheDocument();
      fireEvent.click(within(panel).getByRole("button", { name: /L2 — Overflow Risk/ }));
      rerender(
        <ReviewPanel
          data={fixtures.standard}
          plans={[{ ...pending, doneSteps: [0, 1], status: "Completed · resolved" }]}
          onSelect={select}
          onToggleStep={toggle}
        />,
      );
      expect(within(panel).getByText("Completed · resolved")).toBeInTheDocument();
      expect(within(panel).getAllByRole("button", { name: /^Reopen action:/ })).toHaveLength(2);
      fireEvent.click(within(panel).getByRole("button", { name: "Back to action plan menu" }));
      expect(within(panel).queryByRole("button", { name: /L2 — Overflow Risk/ })).toBeNull();
      expect(within(panel).getByText("No Action Plans currently")).toBeInTheDocument();
      fireEvent.click(within(panel).getByRole("button", { name: "Priority" }));
      expect(within(panel).queryByRole("button", { name: /L2 — Overflow Risk/ })).toBeNull();
      expect(within(panel).getByText("No Action Plans currently")).toBeInTheDocument();
    },
  );
  it("repaginates remaining active plans when the last page's plan completes", () => {
    const select = vi.fn();
    const { rerender } = render(
      <ReviewPanel data={fixtures.standard} plans={plans} onSelect={select} />,
    );
    const panel = screen.getByLabelText("Action plan");
    fireEvent.click(within(panel).getByRole("button", { name: "Action plan page 3" }));
    fireEvent.click(within(panel).getByRole("button", { name: /L5 —/ }));
    const updated = plans.map((plan) =>
      plan.id === "plan-4"
        ? { ...plan, doneSteps: [0], status: "Completed · resolved" as const }
        : plan,
    );
    rerender(<ReviewPanel data={fixtures.standard} plans={updated} onSelect={select} />);
    expect(within(panel).getByText("Completed · resolved")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Back to action plan menu" }));
    expect(within(panel).queryByRole("button", { name: /L5 —/ })).toBeNull();
    expect(within(panel).getAllByRole("button", { name: /—/ })).toHaveLength(2);
    expect(within(panel).getByRole("button", { name: /L3 —/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Action plan page 3" })).toBeNull();
  });
});
