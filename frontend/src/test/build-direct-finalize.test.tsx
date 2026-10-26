import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EngineeringReview } from "@/components/aegis/build/EngineeringReview";
import { getBuildDraft, saveBuildDraft } from "@/services/api";
import { renderWithRouter } from "./renderWithRouter";

afterEach(cleanup);
it("opens the finalization confirmation directly from engineering review when the simulation is current", async () => {
  renderWithRouter(<EngineeringReview path="new" design="B" />);
  fireEvent.click(await screen.findByRole("button", { name: /Finalize Design/ }));
  expect(await screen.findByRole("dialog", { name: /Finalize This Design/ })).toBeTruthy();
  expect((screen.getByRole("button", { name: /Confirm Finalization/ })).hasAttribute("disabled")).toBe(true);
});
it("retains the current-simulation requirement before finalization", async () => {
  const draft = getBuildDraft("new", "C");
  saveBuildDraft({ ...draft, revision: 2, simulatedRevision: 1 });
  renderWithRouter(<EngineeringReview path="new" design="C" />);
  expect((await screen.findByRole("button", { name: /Finalize Design/ })).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("dialog")).toBeNull();
  saveBuildDraft(draft);
});
