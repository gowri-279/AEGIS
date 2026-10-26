<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## AEGIS architecture
- Canonical data (src/data/types.ts, mockCanonicalResponse.ts) is consumed as-is; the UI never computes feasibility, ranking, reliability or physics — those belong to the future FastAPI backend.
- Display-only node positions are generated from topology in src/data/networkLayout.ts; never treat them as engineering geometry.
- All synthetic scenarios share the approved topology in the existing canonical fixture model; new structural nodes carry no invented measurements, keeping future service replacement and the generic renderer independent of scenario outcomes.
- All data access goes through src/services/api.ts so mocks can be swapped for backend calls without touching UI.
- simulationScenarios owns input-to-fixture mappings; Scenario and Simulate Bob share the service pipeline, retaining input identity for shared fixtures. simulationPlans captures supplied responses including abstention/infeasibility without inventing a candidate or outcome.
- NetworkCanvas lazily mounts R3F; Terrain/Blueprint share graph and selection across modes. Closable overlays and analytical splits keep the canvas and selection mounted.
- inspectionPresentation owns only unitless camera targets and connected-context framing, illustrative surface relief and angle-driven terrain opacity; camera interaction never changes canonical data or supplies engineering geometry.
- Each canonical edge has one subsurface conduit body shared by Terrain/Blueprint; selection/status colour the body and a transparent hit area is interaction-only, preventing duplicate-looking pipes. Unitless depth is presentation-only, never engineering elevation.
- useDiagnosticScan and DiagnosticSweep share presentation timing for a surface/subsurface sweep; completion only reveals supplied canonical findings and never evaluates health.
- Health-only mock findings come through services/api; other modes retain canonical responses. HealthProblemMarkers project findings onto real nodes in both representations. Finding-ID inspection shares selection/camera: HealthProblemPanel (issue, severity, observations, evidence, impact) left, ComponentProfile right, selected component centered. Close/reset never resolves findings. Previous/next cycles only active-finding components using the marker-click path.
- In Health after a scan, a node's problem ring shows the strongest supplied finding severity in every representation; selection or default component colour never overrides it, and healthy components get no problem ring. Blueprint renders each structural role as a distinct wireframe symbol (grate inlet, circular junction, basin storage, rectangular recharge, pipe outlet).
- simulationFlowPresentation selects directed existing-edge animation stages from topology: running shows illustrative baseline entry/branches, completed results filter candidate branches by supplied recommendation/feasibility, and recharge never forwards flow. Shared fixed pulse timing follows the same conduit curve in both representations; upstream/downstream context never asserts modeled capacity or engineering travel time. Candidate focus does not change routing.
- networkFlowPresentation selects normal Network visual hops from existing directed topology, excludes supplied ineligible nodes and stops at recharge; reuse conduit particles with a quieter cadence so no new geometry or simulation feasibility is presented as operational flow.
- Shared selection includes a request revision so explicitly reselecting the same component can refocus after manual camera navigation without changing canonical selection semantics.
- spatialPresentation classifies structures and converts topology layout to unitless display geometry; it never changes canonical data or supplies engineering geometry.
- Model material colours are read from global CSS semantic tokens, keeping WebGL and DOM status colours consistent. Abstract procedural cutaway structures deliberately avoid implying surveyed infrastructure.
- Presentation helpers in src/lib/aegis.ts only format/look up canonical values; Bob (src/components/aegis/bob/) only narrates response fields behind an abstract provider boundary.
- Health Bob uses one state machine and service-authored mock scenarios; visuals never mutate canonical data or calculate hydraulics. Its node-projected orb enters left-panel conversation hiding canonical details; legacy Bob stays independent. EngineeringApp owns session plans; Review menus filter active plans while open details read the full session collection and reuse ActionPlanCard completion controls, so completion preserves the open detail and filtering/navigation never changes health.
- Specs live in docs/ (CONTRACT, EXOSKELETON, data spec, handoff) and govern frontend behaviour.
- Routes: `/` is the landing page, `/monitor` hosts the EngineeringApp workspace, `/build` is a placeholder; the Monitor brand links home. UI labels use Title Case; "Synthetic · Illustrative" keeps that exact capitalization.
- The landing network lazily mounts a client-only isolated structured demo through services/api; it reuses Monitor structure/palette/conduit/flow primitives with a landing-only floating Blueprint base and perspective orbit rig. Highlight targets belong to demo configuration, not canonical status; camera motion never alters topology or Monitor state.
