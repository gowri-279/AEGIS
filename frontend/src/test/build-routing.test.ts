import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { BUILD_STEPS } from "@/data/buildDemo";

describe("Build routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  it.each([["/build", "/build"], ["/build/new", "/build_/new"], ["/build/redesign", "/build_/redesign"], ["/build/workspace", "/build_/workspace"], ["/build/assessment", "/build_/assessment"], ["/monitor", "/monitor"]])("%s resolves to its own page", (path, id) => {
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(id);
  });
  it("shows five future steps per path", () => {
    expect(BUILD_STEPS.new).toEqual(["Terrain", "Requirements", "Design Brief", "Network Assessment", "Build Workspace"]);
    expect(BUILD_STEPS.redesign[0]).toBe("Network");
  });
});

import { terrainSetupComplete } from "@/data/buildSetupDemo";
describe("Terrain setup continue rule", () => {
  it("needs a terrain and a connection choice", () => {
    expect(terrainSetupComplete(null, "no", [])).toBe(false);
    expect(terrainSetupComplete("north", null, [])).toBe(false);
  });
  it("Yes needs at least one connection point; No needs none", () => {
    expect(terrainSetupComplete("north", "yes", [])).toBe(false);
    expect(terrainSetupComplete("north", "yes", ["J3"])).toBe(true);
    expect(terrainSetupComplete("north", "no", [])).toBe(true);
  });
  it("requirements page resolves", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/build/requirements").at(-1)?.routeId).toBe("/build_/requirements");
  });
});

import { DEFAULT_REQUIREMENTS, designIntent, requirementsComplete } from "@/data/buildRequirements";
describe("Design requirements rules", () => {
  it("demo defaults: Balanced, three secondaries, Extreme, four constraints, and complete", () => {
    expect(DEFAULT_REQUIREMENTS.primary).toBe("balanced");
    expect(DEFAULT_REQUIREMENTS.secondary).toEqual(["lake", "reuse", "resilience"]);
    expect(DEFAULT_REQUIREMENTS.scenario).toBe("extreme");
    expect(DEFAULT_REQUIREMENTS.constraints).toEqual(["infra", "water", "nobuild", "connections"]);
    expect(requirementsComplete(DEFAULT_REQUIREMENTS)).toBe(true);
  });
  it("blocks the brief without a constraint, but no longer needs a secondary objective", () => {
    expect(requirementsComplete({ ...DEFAULT_REQUIREMENTS, secondary: [] })).toBe(true);
    expect(requirementsComplete({ ...DEFAULT_REQUIREMENTS, constraints: [] })).toBe(false);
  });
  it("intent follows scenario changes", () => {
    expect(designIntent({ ...DEFAULT_REQUIREMENTS, scenario: "heavy" }, "new")).toContain("under heavy rainfall");
  });
});
