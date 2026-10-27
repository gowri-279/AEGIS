import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SCENARIOS } from "@/data/simulationScenarios";
import { fixtures } from "@/data/mockCanonicalResponse";
import { simulationPlan } from "@/data/simulationPlans";
import { mockSimBobReply } from "@/data/simBob";
import { explainHydraulicResult, parseBobHydraulicAction, runHydraulicSimulation } from "@/data/hydraulicSimulation";
import { EngineeringApp } from "@/components/aegis/EngineeringApp";
import { renderWithRouter } from "./renderWithRouter";
import { recommendationLabel } from "@/lib/aegis";

vi.mock("@/services/api", async () => {
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    getCanonicalResponse: async () => fixtures.standard,
    runScenario: async (req: { fixture: keyof typeof fixtures; scenarioOptionId: string }) => ({
      ...fixtures[req.fixture],
      simulation: { ...fixtures[req.fixture].simulation, scenario_option_id: req.scenarioOptionId },
    }),
    runHydraulicSimulate: async (req: { condition?: string; action?: string; parameters?: Record<string, unknown> }) =>
      runHydraulicSimulation({ condition: req.condition, action: req.action, parameters: req.parameters }),
    getSimBobReply: async (q: string) => {
      const parsed = parseBobHydraulicAction(q);
      if (parsed) {
        const hydraulic = runHydraulicSimulation({
          condition: (parsed.parameters.condition as string | undefined) ?? undefined,
          action: parsed.action,
          parameters: parsed.parameters,
        });
        return {
          source: "mock" as const,
          text: explainHydraulicResult(hydraulic, parsed.explanation),
          fixture: hydraulic.fixture,
          scenarioOptionId: hydraulic.condition_id,
          visual: { edgeStages: hydraulic.visual.edgeStages, nodeStates: hydraulic.visual.nodeStates },
          hydraulic,
        };
      }
      return mockSimBobReply(q, fixtures.standard);
    },
  };
});
vi.mock("@/components/aegis/workspace/NetworkCanvas", () => ({ NetworkCanvas: () => <div /> }));
afterEach(cleanup);

it.each(SCENARIOS)("preserves $label evaluation and decision in its own normal action plan", (scenario) => {
  const response = fixtures[scenario.fixture];
  const plan = simulationPlan(response, scenario.id, "2026-10-26T04:12:00Z");
  expect(plan?.simulationEvidence).toEqual({ scenarioOptionId: scenario.id, response });
  expect(plan?.priority).toBe(false);
  expect(plan?.simulationEvidence?.response.recommendation.recommendation_status).toBe(response.recommendation.recommendation_status);
  if (response.recommendation.selected_candidate_id === null) expect(plan?.intervention).not.toContain("Implement recommended");
});

it("keeps Heavy Storm and Flooding plans distinct despite their shared stress fixture", () => {
  expect(simulationPlan(fixtures.stress, "heavy_storm", "now")?.id).not.toBe(simulationPlan(fixtures.stress, "flooding", "now")?.id);
});

it.each([
  ["What happens if normal rainfall occurs?", "normal_rainfall"],
  ["What happens if heavy rainfall occurs?", "heavy_storm"],
  ["What happens if flooding occurs?", "flooding"],
  ["What happens under extreme rainfall?", "extreme_rainfall"],
  ["What happens in a cloudburst?", "cloudburst"],
])("Bob resolves %s to hydraulic condition %s", (question, conditionId) => {
  const parsed = parseBobHydraulicAction(question);
  expect(parsed?.action).toBe("run_condition");
  expect(parsed?.parameters.condition).toBe(conditionId);
});

it.each(SCENARIOS)("$label reaches evaluation → decision → Review from Scenario and Bob", async (scenario) => {
  for (const input of ["scenario", "bob"]) {
    const view = renderWithRouter(<EngineeringApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Simulate" }));
    if (input === "scenario") {
      fireEvent.click(screen.getByRole("button", { name: /Scenario ·/ }));
      fireEvent.click(screen.getByRole("menuitemradio", { name: new RegExp(`^${scenario.label}`) }));
      expect(screen.queryByRole("button", { name: /Recommended · C-L2/ })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Run Scenario/ }));
    } else {
      fireEvent.click(within(screen.getByRole("group", { name: "Simulation input method" })).getByRole("button", { name: "Bob" }));
      const questions: Record<string, string> = {
        normal_rainfall: "What happens if normal rainfall occurs?",
        heavy_storm: "What happens if heavy rainfall occurs?",
        flooding: "What happens if flooding occurs?",
        extreme_rainfall: "What happens under extreme rainfall?",
        cloudburst: "What happens in a cloudburst?",
      };
      fireEvent.change(screen.getByLabelText("Ask Bob a simulation question"), { target: { value: questions[scenario.id] } });
      fireEvent.click(screen.getByRole("button", { name: "Send to Bob" }));
    }
    const supplied = fixtures[scenario.fixture];
    const banner = await screen.findByRole("button", { name: new RegExp(recommendationLabel[supplied.recommendation.recommendation_status]) });
    fireEvent.click(banner);
    const review = await screen.findByRole("complementary", { name: "Review controls" });
    const menu = within(review).getByLabelText("Action plan");
    fireEvent.click(within(menu).getByRole("button", { name: /—/ }));
    expect(within(menu).getByText(/Supplied simulation/).textContent).toContain(supplied.simulation.scenario_id);
    expect(within(menu).getByText(/Supplied simulation/).textContent).toContain(`${supplied.simulation.diverted_volume_m3} m³`);
    expect(within(menu).queryByText("PRIORITY")).toBeNull();
    view.unmount();
  }
});
