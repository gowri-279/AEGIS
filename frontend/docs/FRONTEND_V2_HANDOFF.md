# AEGIS Frontend V2 Handoff

## Status

This branch (`feature/aegis-frontend-v2`) is the clean working baseline for the next presentation-layer rebuild.

The previous incremental 3D/terrain visual approach is intentionally not the direction for V2.

## Source of truth

1. `CONTRACT.md` — canonical engineering/data semantics.
2. `EXOSKELETON.md` — product, UX, presentation and frontend requirements.
3. `AEGIS_FRONTEND_DATA_SPEC.md` — provisional P1/P2/P3 frontend interface specification; it becomes final only after P1/P2/P3 integration is validated.
4. Backend implementation — authoritative implementation of the integrated response once validated.

## Preserve

- `frontend/src/data/` — canonical frontend types, fixtures and Bob mock/context data.
- `frontend/src/services/` — API boundary and scenario interface.
- `frontend/src/components/aegis/NetworkInventory.tsx`
- `frontend/src/components/aegis/ComponentProfile.tsx`
- `frontend/src/components/aegis/BobNavigator.tsx`
- `frontend/src/components/aegis/useNetworkSelection.ts`
- functional mode/inspector behavior where useful
- tests, routing, build configuration and dependency setup unless the new presentation implementation has a justified replacement.

## Rebuild

The presentation layer is deliberately open to redesign. The next frontend agent may choose SVG, Canvas, WebGL/Three, 2.5D, map-like rendering, or a hybrid approach.

The network renderer must consume `network.nodes[]` and `network.edges[]` generically. No node-specific rendering logic may depend on J3/L1/R1/L2 or future IDs.

Presentation geometry is not engineering geometry. Generated positions, paths, animation routes and layout coordinates must remain presentation-only.

## Do not reintroduce

Do not continue the previous procedural low-poly urban/catchment scene as the primary AEGIS interface. The old visual experiments are retained in Git history for reference only.

Do not invent physical capacities, elevations, coordinates, hydraulic values, risk scores, or safety conclusions in the frontend.

## Bob

The frontend should expose an AI/Bob interaction boundary that explains canonical state, evidence, risks, candidates, simulation results, recommendations and limitations. The presentation layer must not independently calculate hydraulic physics, feasibility, ranking, risk scores or safety qualification.

## Backend integration

P1 owns canonical topology and response assembly. P2 owns sensor reliability and risk assessment. P3 owns candidate evaluation, simulation and recommendation. Their final integrated canonical response supersedes provisional schema details in `AEGIS_FRONTEND_DATA_SPEC.md`.

The standard-scenario recommendation conflict identified by P3 must be resolved through contract/change-control before the final frontend data spec is frozen. No fabricated physical metrics should be introduced to force a recommendation.

## Branch / PR cleanup

The obsolete visual PRs #2, #3 and #4 were closed without merging. Their branches should be retired later when branch deletion is available/approved; they are not part of the V2 baseline.

Backend P1/P2/P3 branches remain preserved while integration is in progress.

## Definition of done for the new frontend

- Premium engineering decision-support interface, not a game-like city scene or generic AI dashboard.
- Network is the primary interface.
- Health, simulation and review are contextual views over the same canonical network.
- Dynamic topology works for arbitrary node/edge IDs.
- Unknown/degraded/unevaluated states are visible rather than silently replaced.
- AI explanations are grounded in canonical response data.
- Synthetic/illustrative limitations remain explicit.
- Existing functional/data skeleton remains usable or is replaced only with an equivalent, better-defined implementation.
- Build and tests remain passing.
