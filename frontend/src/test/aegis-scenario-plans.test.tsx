import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SCENARIOS } from "@/data/simulationScenarios";
import { fixtures } from "@/data/mockCanonicalResponse";
import { simulationPlan } from "@/data/simulationPlans";
import { mockSimBobReply } from "@/data/simBob";
import { EngineeringApp } from "@/components/aegis/EngineeringApp";
import { renderWithRouter } from "./renderWithRouter";
import { recommendationLabel } from "@/lib/aegis";

vi.mock("@/services/api", async () => {
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return { ...actual, getCanonicalResponse: async () => fixtures.standard, runScenario: async (req: { fixture: keyof typeof fixtures; scenarioOptionId: string }) => ({ ...fixtures[req.fixture], simulation: { ...fixtures[req.fixture].simulation, scenario_option_id: req.scenarioOptionId } }), getSimBobReply: async (q: string, data: typeof fixtures.standard) => mockSimBobReply(q, data) };
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

it("keeps Heavy rain and Flooding plans distinct despite their shared stress evaluation", () => {
  expect(simulationPlan(fixtures.stress, "heavy-rain", "now")?.id).not.toBe(simulationPlan(fixtures.stress, "flooding", "now")?.id);
});

it.each([
  ["What happens if normal rainfall occurs?", "standard"],
  ["What happens if heavy rainfall occurs?", "heavy-rain"],
  ["What happens if L2 overflows?", "flooding"],
  ["What happens if the sensor degrades?", "degraded"],
  ["What happens if the sensor fails?", "sensor-failure"],
])("Bob resolves %s to supplied scenario %s", (question, optionId) => {
  const option = SCENARIOS.find((item) => item.id === optionId);
  const reply = mockSimBobReply(question, fixtures.standard);
  expect(reply.fixture).toBe(option?.fixture);
  expect(reply.scenarioOptionId).toBe(optionId);
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
      const questions: Record<string, string> = { standard: "What happens if normal rainfall occurs?", "heavy-rain": "What happens if heavy rain occurs?", flooding: "What happens if L2 overflows?", degraded: "What happens if the sensor degrades?", "sensor-failure": "What happens if the sensor fails?" };
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