# AEGIS --- EXOSKELETON

**Document role:** Frontend/product requirements and design
constitution\
**Project:** AEGIS --- AI-powered network-level stormwater decision and
simulation system\
**Status:** Working baseline for the next frontend rebuild\
**Primary companion document:** `CONTRACT.md`

------------------------------------------------------------------------

## 1. Purpose

This document defines what the AEGIS frontend must accomplish, the
information architecture, interaction requirements, data-boundary rules,
and visual quality bar.

It intentionally does **not** prescribe a particular visual
implementation, 3D engine, component library, or artistic technique.

The next frontend agent must first inspect the repository and understand
the existing functional skeleton, then preserve useful functionality
while replacing obsolete presentation code.

### Core principle

> **The frontend should make the network understandable, inspectable,
> explainable, and actionable.**

AEGIS is not a game, generic dashboard, chatbot with a map attached, or
decorative 3D visualization.

------------------------------------------------------------------------

# 2. Source-of-truth hierarchy

The frontend rebuild must respect this hierarchy:

1.  **`CONTRACT.md`** --- authoritative engineering/data semantics.
2.  **`EXOSKELETON.md`** --- authoritative frontend/product experience
    requirements.
3.  **Existing repository** --- implementation context, reusable
    functional infrastructure, APIs, tests, and integration points.
4.  Frontend implementation --- presentation and interaction only.

If a visual idea conflicts with the contract, the contract wins.

If an implementation detail is not required by this document, the agent
may choose the best technical and artistic approach after inspecting the
repository.

------------------------------------------------------------------------

# 3. What AEGIS is

AEGIS is an AI-powered network-level stormwater decision and simulation
system for Bengaluru.

The system should help a user:

-   understand the stormwater network spatially;
-   inspect network components;
-   understand sensor/data reliability;
-   identify risks and attention areas;
-   compare intervention candidates;
-   run predefined and what-if scenarios;
-   understand simulation outcomes;
-   review recommendations;
-   understand uncertainty and limitations;
-   use AI assistance without allowing AI to replace authoritative
    deterministic constraints.

The current dataset is synthetic/illustrative according to
`CONTRACT.md`.

The frontend must never present synthetic/illustrative data as validated
real-world hydraulic truth.

------------------------------------------------------------------------

# 4. Core UX principle

## THE NETWORK IS THE INTERFACE

The network should be the primary spatial and conceptual organizing
element of the application.

The user should be able to understand:

-   where a component is;
-   what connects to it;
-   what its current state is;
-   what data supports that state;
-   what risks are associated with it;
-   what interventions are available;
-   what happens under a scenario;
-   what the system recommends;
-   what remains uncertain.

The interface should connect spatial understanding with structured
engineering information.

------------------------------------------------------------------------

# 5. Primary application modes

The application has four primary modes:

1.  **Network**
2.  **Health**
3.  **Simulate**
4.  **Review**

There should not be a separate permanent "Pipeline Analysis" mode.

There should not be a separate explicit "Underground" application mode.

Subsurface infrastructure should be understandable through the spatial
view, camera, section/cutaway, or another appropriate visualization
chosen by the frontend agent.

------------------------------------------------------------------------

# 6. Network mode

Network mode is the primary experience.

## 6.1 Network inventory

Provide a persistent mechanism for navigating the network.

It should support:

-   component listing;
-   search;
-   filtering;
-   component selection;
-   navigation to a component;
-   clear distinction between authoritative network components and any
    presentation-only context.

The inventory is a navigation mechanism, not a duplicate of the entire
component profile.

It must be capable of handling future topology growth.

Do not design around exactly four nodes.

------------------------------------------------------------------------

## 6.2 Spatial network

The spatial view should make the canonical network immediately legible.

It should communicate:

-   nodes/components;
-   connections;
-   component types;
-   storage/recharge infrastructure;
-   sensor state;
-   risk/attention;
-   candidate intervention routes;
-   scenario state;
-   selection/focus.

The network must be rendered dynamically from canonical `network.nodes`
and `network.edges`.

Do not hardcode specific node IDs such as J3, L1, L2, or R1 into visual
components.

Future topology must render without rebuilding the renderer.

------------------------------------------------------------------------

## 6.3 Component selection

Selecting a component should produce a strong spatial and informational
relationship.

Expected behavior:

1.  User selects a component from the spatial view or inventory.
2.  The spatial view focuses the component.
3.  A contextual component profile appears.
4.  The profile contains only information supported by the canonical
    data.
5.  Closing the profile returns to the normal network view.
6.  Selecting another component replaces the existing profile.

The exact visual treatment is intentionally left open to the frontend
agent.

------------------------------------------------------------------------

# 7. Component profile

The contextual profile should be rich enough for engineering
decision-making without inventing information.

Depending on available data, it may contain:

### Identity

-   component ID;
-   type;
-   label;
-   status/attention state.

### Technical representation

-   supported geometric/spatial representation;
-   operational state;
-   available attributes.

### Sensors

For each relevant sensor: - sensor ID; - variable; - measurement; -
unit; - status; - freshness/timestamp; - confidence/data usability; -
issue if provided.

### Risk / attention

Show supported findings including: - category; - severity; - target; -
observed value; - threshold; - confidence; - evidence; - potential
impact.

Use the contract's uncertainty language.

Do not convert suspected/potential/anomalous conditions into confirmed
failures.

### Connections

Show supported incoming/outgoing relationships.

### Interventions / candidates

Where applicable: - candidate ID; - type; - eligibility; -
feasibility; - available storage; - constraints; - route edge IDs; -
supported capacity/constraint information.

### Limitations

Show relevant: - uncertainty; - data limitations; - modeling
limitations; - unmodeled downstream implications.

If a field is unavailable, explicitly communicate that it is unavailable
rather than inventing a value.

------------------------------------------------------------------------

# 8. Health mode

Health mode is still a network experience.

It is not a generic analytics dashboard.

The user should be able to:

1.  initiate a network health scan;
2.  see the system inspect/scan the network;
3.  identify components requiring attention;
4.  spatially highlight those components;
5.  select an attention item;
6.  focus the spatial view on it;
7.  inspect the same contextual component profile.

The interface should communicate:

-   needs attention;
-   data reliability issues;
-   risks;
-   severity;
-   evidence;
-   confidence.

### Color semantics

-   Normal/healthy states should remain restrained.
-   Amber is appropriate for attention/warning.
-   Red is reserved for high/critical states.
-   Confidence must not be visually confused with probability of danger.

The health experience must not claim that a component is physically
"broken" unless the canonical data actually supports that conclusion.

------------------------------------------------------------------------

# 9. Simulation mode

Simulation should support two pathways.

## 9.1 Predefined scenarios

Support the canonical scenario classes defined by the
application/backend, including the currently defined standard,
stress/heavy-rain, flooding, and sensor-failure/degraded-data cases
where applicable.

The frontend should expose:

-   scenario parameters;
-   relevant controls;
-   affected network components;
-   candidate routes;
-   feasibility;
-   constraints;
-   simulation result;
-   before/after state where supported;
-   explanation;
-   uncertainty;
-   limitations.

The frontend must display the backend result rather than independently
recomputing its meaning.

------------------------------------------------------------------------

## 9.2 Authority/Bob-driven what-if scenarios

A future/expanded simulation experience should allow an authorized AI
assistant or structured scenario builder to form a what-if scenario
from:

-   current sensors;
-   network topology;
-   interventions;
-   constraints;
-   risks;
-   user parameters.

The flow should be:

**current state → structured scenario → simulation → implications →
limitations/uncertainty**

The AI may explain and help formulate scenarios, but deterministic
backend constraints remain authoritative.

------------------------------------------------------------------------

# 10. Review mode

Review is the decision-review experience.

It should communicate:

-   recommendation status;
-   selected candidate;
-   decision basis;
-   candidate constraints;
-   risks;
-   relevant component-level confidence;
-   uncertainty;
-   data limitations;
-   modeling limitations;
-   review priorities.

The interface must clearly distinguish:

### Confidence

Confidence in the assessment/data.

### Safety qualification

Whether the recommendation is actually safety-qualified under the
contract.

These are not interchangeable.

The frontend must never turn a confidence score into a probability of
safety or hazard.

------------------------------------------------------------------------

# 11. AI / Bob interaction

AI assistance should complement the spatial and structured interface.

The assistant may explain:

-   current situation;
-   risks;
-   data reliability;
-   candidates;
-   selected candidate;
-   simulation outcome;
-   implications;
-   uncertainty;
-   limitations.

The assistant should not become the sole interface.

When an AI response references a component, the UI should be capable of
connecting that explanation back to the spatial network and relevant
component profile.

For example:

> "Show me J3"

should be able to result in:

**J3 selected → spatial focus → J3 profile opened.**

The exact implementation is open.

------------------------------------------------------------------------

# 12. Data architecture rules

These rules are non-negotiable.

## Backend owns meaning

The backend/contract owns:

-   topology;
-   measurements;
-   sensor states;
-   risks;
-   constraints;
-   candidates;
-   simulation outputs;
-   recommendations;
-   confidence;
-   uncertainty;
-   limitations;
-   engineering semantics.

## Frontend owns presentation

The frontend owns:

-   visualization;
-   camera/navigation;
-   layout;
-   geometry used purely for presentation;
-   interaction;
-   animation;
-   typography;
-   visual hierarchy;
-   spatial composition.

## Never do these

Do not:

-   hardcode engineering measurements into visual components;
-   hardcode specific node IDs into rendering logic;
-   invent elevations;
-   invent hydraulic capacities;
-   invent sensor measurements;
-   invent risk values;
-   invent topology;
-   silently reinterpret backend semantics;
-   calculate a new engineering conclusion in the frontend;
-   display presentation geometry as if it were surveyed engineering
    geometry.

Presentation-only geometry is permitted when clearly treated as
visualization.

------------------------------------------------------------------------

# 13. Dynamic topology requirement

The frontend must be graph-driven.

The canonical graph consists of:

``` text
network.nodes
network.edges
```

The renderer and interaction model must operate generically over those
structures.

The current eight-node synthetic topology is a fixture, not the permanent UI
design. Its approved connectivity is C1/C2 → J3 → L1/R1/L2,
L1/L2 → J4 → O1, with no R1 → J4 connection. Added collection,
downstream and outlet structures have no supplied engineering measurements;
connectivity does not imply modeled downstream hydraulic capacity.

Future nodes and edges must appear without:

-   adding new ID-specific branches;
-   rewriting the renderer;
-   manually creating new component cases.

Node-type-specific presentation is acceptable when based on the
canonical `node.type`.

Unknown/future types should degrade gracefully rather than break the
application.

------------------------------------------------------------------------

# 14. Spatial visualization philosophy

The spatial visualization is important, but the frontend should not
force itself into a specific rendering technology.

The agent may choose:

-   3D;
-   2.5D;
-   map-like spatial rendering;
-   SVG/canvas;
-   WebGL;
-   Three.js;
-   a hybrid;
-   another appropriate approach.

The decision should be based on the product requirements and repository
constraints.

### Required outcome

The user should perceive a coherent **engineering digital twin**, not a
game world.

The spatial representation should make infrastructure, topology, state,
and decisions understandable.

------------------------------------------------------------------------

# 15. Visual quality bar

## Desired

The frontend should feel like:

-   a premium engineering digital twin;
-   infrastructure planning/decision software;
-   a sophisticated spatial analysis tool;
-   technically credible;
-   polished enough for a national-level technical demonstration;
-   information-dense without becoming cluttered;
-   visually distinctive without becoming gimmicky.

## Avoid

-   low-poly game aesthetics;
-   cartoon-like buildings;
-   procedural-looking cities;
-   generic cubes scattered around;
-   cone-shaped game trees;
-   giant empty terrain;
-   giant road grids that visually overpower infrastructure;
-   neon cyberpunk styling;
-   excessive cyan glow;
-   purple "AI" gradients;
-   excessive glassmorphism;
-   tiny HUD typography;
-   scanline-heavy interfaces;
-   decorative 3D objects without informational purpose;
-   generic dashboard-card overload.

The design should not look like an AI template.

------------------------------------------------------------------------

# 16. Color semantics

Color should communicate meaning, not decoration.

Suggested semantic hierarchy:

-   infrastructure: neutral/off-white/grey;
-   water: blue/cyan;
-   normal environment: restrained natural/neutral tones;
-   attention: amber;
-   high/critical: red;
-   selection: clear but restrained highlight.

The exact palette is open to the designer.

Avoid making the entire interface cyan.

------------------------------------------------------------------------

# 17. Typography and information hierarchy

The interface should prioritize:

1.  primary decision/information;
2.  component identity;
3.  state;
4.  evidence;
5.  technical details;
6.  uncertainty/limitations;
7.  secondary metadata.

Typography should be:

-   highly readable;
-   appropriately sized;
-   professional;
-   clearly hierarchical.

Do not compress engineering information into tiny HUD labels.

------------------------------------------------------------------------

# 18. Motion and interaction

Motion should explain spatial relationships.

Good uses include:

-   camera focus;
-   component transitions;
-   network scanning;
-   flow visualization where meaningful;
-   scenario state changes;
-   opening/closing contextual information;
-   before/after transitions.

Avoid:

-   constant animation;
-   decorative pulsing;
-   excessive glow;
-   motion that makes technical information harder to read.

Motion should be purposeful and restrained.

------------------------------------------------------------------------

# 19. Terrain and environmental context

Environmental context exists to explain the stormwater network.

It must not become the product.

If terrain/environment is used, it should communicate concepts such as:

-   catchment;
-   runoff;
-   drainage;
-   storage;
-   recharge;
-   urban context.

It should not become a miniature game city.

The frontend may use a highly abstracted or engineering-oriented site
model if that communicates the system better than photorealism.

No invented geographic/topographic claims should be presented as real
data.

------------------------------------------------------------------------

# 20. Storage and recharge representation

Storage and recharge interventions should have visually distinct,
understandable representations.

Storage should communicate concepts such as:

-   retention/storage;
-   water;
-   inlet/outlet;
-   intervention location;
-   current state where supported.

Recharge should communicate concepts such as:

-   infiltration/recharge;
-   intervention location;
-   eligibility;
-   operational state where supported.

The visual representation must not imply physical dimensions or
capacities that are not supported by the contract.

------------------------------------------------------------------------

# 21. Subsurface infrastructure

There is no requirement for a permanent "Underground" mode.

Subsurface infrastructure may be represented through:

-   section/cutaway;
-   camera angle;
-   transparency;
-   layer toggles;
-   schematic representation;
-   another appropriate interaction.

The objective is to make buried infrastructure understandable without
creating a separate disconnected application mode.

------------------------------------------------------------------------

# 22. Responsive information architecture

The UI should maintain a clear relationship between:

**navigation → spatial state → contextual information → decision**

Avoid duplicating the same information in multiple panels.

For example:

-   Network Inventory navigates.
-   Spatial view explains location/connectivity.
-   Component Profile explains the selected component.
-   Bob explains or contextualizes.
-   Review explains the decision.

Each part should have a reason to exist.

------------------------------------------------------------------------

# 23. Reuse and cleanup

The new frontend agent must inspect the entire repository before
implementing.

It should classify existing code into:

### Preserve

-   functional application shell;
-   API/service integration;
-   canonical data types;
-   contract-aligned data;
-   state management;
-   routing;
-   tests;
-   reusable functional components;
-   selection behavior where sound;
-   backend integration;
-   mock data where needed for development.

### Replace

-   obsolete visual implementation;
-   failed procedural 3D scene;
-   duplicated presentation logic;
-   hardcoded visual layouts;
-   visual-only code that conflicts with this document;
-   obsolete styling/design-system code.

### Remove

Only code that is confirmed obsolete and no longer referenced.

Do not delete functionality simply because its current visual
implementation is being replaced.

------------------------------------------------------------------------

# 24. Repository inspection requirement for the next frontend agent

Before changing code, the agent must:

1.  inspect the repository structure;
2.  inspect `CONTRACT.md`;
3.  inspect `EXOSKELETON.md`;
4.  inspect package/dependency configuration;
5.  inspect application entry points;
6.  inspect API/services;
7.  inspect types;
8.  inspect state and routing;
9.  inspect current modes;
10. inspect tests;
11. identify the actual production path;
12. identify obsolete/duplicate frontend code;
13. identify what can be preserved;
14. propose the rebuild architecture before performing destructive
    cleanup.

The agent should not assume that the current Three.js scene is the
correct foundation.

------------------------------------------------------------------------

# 25. Implementation freedom

The next frontend agent is intentionally given artistic and technical
freedom.

It should determine:

-   the best visual language;
-   whether 3D is necessary everywhere;
-   how spatial data should be presented;
-   how panels should behave;
-   how the network should be visualized;
-   how terrain/environment should be represented;
-   how motion should work;
-   how responsive behavior should work.

The requirements in this document define the **experience and quality
bar**, not a fixed implementation.

------------------------------------------------------------------------

# 26. Demo-quality requirement

AEGIS will be presented as a serious technical project.

The frontend must therefore communicate:

-   technical credibility;
-   engineering intent;
-   system intelligence;
-   spatial understanding;
-   decision support;
-   uncertainty awareness.

A visually impressive interface is useful only if it improves
understanding.

The goal is not to maximize visual effects.

The goal is:

> **Make a technically complex stormwater decision system feel
> understandable, trustworthy, and powerful.**

------------------------------------------------------------------------

# 27. Non-negotiable principles

1.  **Contract before aesthetics.**
2.  **Network before decoration.**
3.  **Meaning before animation.**
4.  **Data before invented visuals.**
5.  **Engineering credibility before game aesthetics.**
6.  **AI assists; authoritative backend logic decides.**
7.  **Confidence is not danger probability.**
8.  **Uncertainty must remain visible.**
9.  **Synthetic data must remain clearly synthetic.**
10. **Future topology must not require frontend rewrites.**
11. **The frontend may visualize; it must not invent engineering
    truth.**
12. **The spatial experience and structured information must reinforce
    each other.**

------------------------------------------------------------------------

# 28. Definition of success

The rebuild is successful when a technically literate user can open
AEGIS and immediately understand:

-   what network they are looking at;
-   what the important components are;
-   what requires attention;
-   what data supports that assessment;
-   what interventions are available;
-   what happens if a scenario is simulated;
-   what the system recommends;
-   why it recommends it;
-   what remains uncertain;
-   what the system does not know.

And they should be able to discover all of this through a coherent,
polished, spatially intelligent interface rather than through
disconnected dashboards.

------------------------------------------------------------------------

## Final instruction to the frontend agent

**Do not preserve the current visual design merely because it already
exists.**

Preserve the **functional skeleton and data contract**.

Reimagine the **presentation layer**.

Inspect first. Understand second. Plan third. Build fourth.

The new frontend should feel like AEGIS was intentionally designed as an
engineering digital twin from day one.
