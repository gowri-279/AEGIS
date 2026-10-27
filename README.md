# 🛡️ AEGIS — AI-Powered Stormwater Intelligence & Engineering

**Monitor. Design. Simulate. Validate. Improve.**

AEGIS is an AI-assisted stormwater intelligence and engineering platform that connects network monitoring, a catchment Digital Twin, sensor reliability, risk assessment, AI-assisted infrastructure design, deterministic engineering validation, what-if simulation, and explainable recommendations in one integrated workflow.

With two complementary experiences — **Monitor Mode** and **Build Mode** — AEGIS enables engineers to understand the condition of a modeled stormwater network, design or redesign infrastructure, evaluate interventions, compare proposed designs against existing conditions, and review engineering trade-offs before finalization.

Bob, the AI engineering assistant, helps generate candidate designs and explain decisions. AEGIS remains responsible for deterministic validation, simulation, constraint evaluation, and finalization, with the engineer retaining control over the design process.

> **Project scope:** The current MVP uses synthetic network data, illustrative measurements, predefined scenarios, and modeled simulation values. It demonstrates an integrated decision-support workflow; it is not a calibrated, validated real-world hydraulic prediction system.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [Key Features](#-key-features)
  - [Monitor Mode](#1-monitor-mode--network-intelligence)
  - [Build Mode](#2-build-mode--engineering-design)
  - [Catchment Digital Twin](#3-catchment-digital-twin)
  - [Sensor Intelligence](#4-sensor-intelligence--data-reliability)
  - [Risk Assessment](#5-network-health--risk-assessment)
  - [What-If Simulation](#6-what-if-simulation)
  - [Bob AI Assistant](#7-bob--ai-engineering-intelligence)
  - [Deterministic Validation](#8-deterministic-validation--recommendations)
- [Build Mode Workflow](#-build-mode-end-to-end-workflow)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
- [Running the Application](#-running-the-application)
- [Build and Validation](#-build-and-validation)
- [API Reference](#-api-reference)
- [Testing](#-testing)
- [Example Workflow](#-example-workflow)
- [Limitations and Safety](#-limitations-and-safety)
- [Future Scope](#-future-scope)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌧️ Overview

Stormwater networks are interconnected systems in which rainfall, terrain, drainage patterns, infrastructure capacity, storage, and downstream conditions influence one another. Monitoring data alone does not necessarily reveal which intervention is feasible, how it might affect neighboring components, or whether the available evidence is reliable enough to support a decision.

AEGIS addresses this challenge by combining network intelligence with an engineering design and evaluation workflow.

### Two complementary modes

**Monitor Mode — Understand the network**

Monitor provides visibility into the modeled catchment, network conditions, sensor readings, data reliability, and potential risks. It helps engineers investigate the existing network and understand where attention may be required.

**Build Mode — Design and evaluate interventions**

Build provides an engineering design environment for creating a new stormwater network or redesigning an existing one. It combines terrain context, design requirements, constraints, AI-generated candidate designs, deterministic validation, simulation, and engineering review.

Together, the two modes establish a continuous engineering lifecycle:

**Monitor → Identify Risks → Build → Simulate → Review → Finalize → Monitor**

The objective is to connect observation with intervention planning rather than treating monitoring and infrastructure design as disconnected activities.

---

## 🎯 The Problem

Stormwater management involves several interdependent challenges:

- Understanding complex infrastructure and drainage topology.
- Identifying potential bottlenecks and hydraulic risks.
- Working with incomplete, stale, or unreliable sensor measurements.
- Designing interventions that respect environmental and construction constraints.
- Evaluating downstream consequences of proposed changes.
- Comparing alternatives using consistent engineering criteria.
- Explaining why a design is recommended or rejected.
- Maintaining engineering oversight before a design is finalized.

AEGIS brings these concerns into a unified workflow where data quality, network state, candidate feasibility, simulation outcomes, and recommendation rationale remain connected.

## ✨ Key Features

### 1. Monitor Mode — Network Intelligence

Monitor is the network-observation experience within AEGIS.

It supports investigation of the modeled catchment and provides context for understanding current network conditions.

Key capabilities include:

- Inspection of the modeled stormwater network.
- Visualization of network components and their relationships.
- Visibility into simulated sensor measurements and network state.
- Identification of potential hydraulic and infrastructure risks.
- Inspection of sensor reliability and data-quality issues.
- Access to network assessment information.
- Use of Bob to explain relevant findings and explore supported what-if scenarios.

**Purpose:** Understand the existing network and identify potential problems before planning an intervention.

Monitor and Build use the same canonical AEGIS network representation. This allows a finalized Build design to become available to Monitor without introducing an unrelated network model.

### 2. Build Mode — Engineering Design

Build is AEGIS's engineering design environment. It supports two distinct workflows.

#### New Network

Create a new stormwater network using synthetic terrain intelligence and engineering requirements.

The workflow includes:

1. Select a terrain.
2. Inspect terrain characteristics and drainage context.
3. Optionally connect the new network to an existing AEGIS network.
4. Define engineering objectives and constraints.
5. Select a rainfall scenario.
6. Review the Design Brief.
7. Assess the terrain and network.
8. Ask Bob to generate candidate designs.
9. Validate and rank candidates through AEGIS.
10. Select and modify a design.
11. Apply changes and run a simulation.
12. Review proposed performance against the baseline.
13. Finalize the design.
14. Add the new network to AEGIS and make it available to Monitor.

Finalizing a new network creates an additional network alongside existing networks.

#### Redesign

Modify an existing AEGIS network while retaining it as the baseline for comparison.

The workflow includes:

- Inspecting existing topology and infrastructure.
- Identifying network and terrain-related concerns.
- Defining redesign objectives and constraints.
- Generating candidate interventions.
- Selecting and modifying a candidate.
- Applying changes to the active design.
- Simulating the proposed design against the existing baseline.
- Reviewing performance and remaining risks.
- Finalizing the redesign.

Finalization updates the selected existing network rather than creating an unrelated duplicate.

#### Terrain Intelligence

For New Network mode, AEGIS provides synthetic terrain options with predefined spatial and drainage context, including:

- Elevation.
- Catchment characteristics.
- Low points and collection zones.
- Natural drainage direction.
- Existing water bodies.
- High-elevation areas.
- Existing network connection opportunities.

When a connection is configured, existing network nodes can be selected and highlighted as part of the design context. Otherwise, the new design can proceed as an independent network.

#### Design Objectives and Constraints

Build supports the following primary objectives:

- Flood Reduction.
- Capacity Improvement.
- Resilience.
- Water Retention / Recharge.
- Balanced Optimization.

Constraints can include:

- No-build zones.
- Infrastructure that must remain.
- Maximum construction footprint.
- Protected water bodies.
- Roads.
- Connection limitations.

The engineer also selects a rainfall or stress scenario. The current MVP uses predefined scenarios rather than requiring manual configuration of every hydraulic parameter.

#### Design Brief and Network Assessment

The Design Brief consolidates the engineering intent before AI-assisted design generation.

It brings together:

- Selected terrain and drainage context.
- Existing network topology and connected nodes.
- Current modeled network condition.
- Engineering objectives.
- Construction and environmental constraints.
- Selected rainfall scenario.
- A concise description of the intended design outcome.

Before Bob generates designs, AEGIS assesses the available context through:

- **Terrain Intelligence:** Elevation, low points, collection zones, natural drainage, and water bodies.
- **Network Intelligence:** Topology, component relationships, capacity, and bottlenecks.
- **Identified Risks:** Detected engineering concerns.
- **Terrain Visualization:** Spatial and terrain context.
- **Reliability Intelligence:** Relevant sensor and data-quality information.
- **Downstream Analysis:** Potential consequences for downstream components.

This assessment provides the engineering context for candidate generation and evaluation.

### 3. Catchment Digital Twin

The Digital Twin represents the catchment as a graph of interconnected infrastructure components and their modeled state.

The canonical network representation can include:

- Nodes and edges with stable identifiers.
- Pipes and drains.
- Junctions and connected nodes.
- Lakes and storage facilities.
- Outlets and recharge points.
- Sensors and intervention/control points.
- Flow direction and network topology.
- Infrastructure capacities and elevations where applicable.

The same underlying network representation is used by Monitor and Build.

This shared model connects network visualization, risk assessment, candidate evaluation, scenario simulation, and finalized design handoff.

### 4. Sensor Intelligence & Data Reliability

AEGIS distinguishes raw sensor measurements from effective values used in engineering decisions.

Supported sensor categories include rainfall, water level, flow, pressure, and water quality.

| Sensor category | Freshness limit |
|---|---:|
| Rainfall | 5 minutes |
| Water level | 5 minutes |
| Flow | 5 minutes |
| Pressure | 5 minutes |
| Water quality | 15 minutes |

The shared integration contract defines six sensor-quality states:

| Status | Meaning |
|---|---|
| `fresh` | Reading is within its configured freshness limit. |
| `degraded` | Reading has a quality warning and may remain usable. |
| `stale` | Reading exceeds its allowed freshness limit. |
| `missing` | No reading is available. |
| `invalid` | Reading cannot be used. |
| `conflicting` | Reading conflicts with relevant information. |

Unusable measurements are not silently treated as trustworthy.

For example, the critical WL-J3 water-level measurement supports the J3 hard-constraint check. If the reading is stale, missing, invalid, conflicting, or degraded beyond usability, that required check cannot be evaluated and the recommendation must be `abstained`.

Build also uses reliability intelligence to explain when a candidate's apparent benefits depend on uncertain measurements.

### 5. Network Health & Risk Assessment

AEGIS evaluates potential risks in the context of the connected network.

Risk categories defined in the integration contract include:

- Hydraulic overload.
- Overflow risk.
- Bottlenecks.
- Potential infrastructure anomalies.
- Water-quality risks.
- Downstream propagation risks.

Risk findings may include the affected component, observed and effective values, thresholds, severity, confidence, evidence, and potential impact.

Sensor confidence and risk confidence are distinct:

- **Sensor confidence** describes the reliability of the available measurement.
- **Risk confidence** describes confidence in the assessed risk finding.

Suspected infrastructure anomalies are communicated as potential conditions rather than confirmed physical failures.

Build incorporates relevant risk findings into its design context so candidate interventions can be evaluated in relation to the problems they are intended to address.

### 6. What-If Simulation

AEGIS evaluates proposed interventions using scenario-based simulation.

A scenario can include rainfall assumptions, diverted volume, duration, and intervention parameters.

The shared contract defines a standard illustrative fixture:

| Parameter | Value |
|---|---:|
| Scenario | `storage_and_recharge_demo` |
| Diverted volume | 200 m³ |
| Duration | 600 seconds |
| Average diverted flow | Approximately 0.3333 m³/s |

The simulation workflow includes:

1. Scenario definition.
2. Network-state and sensor-reliability assessment.
3. Candidate intervention evaluation.
4. Hard-constraint checking.
5. What-if simulation.
6. Baseline comparison.
7. Candidate ranking.
8. Recommendation generation.

In Build Mode, simulation uses the engineer's current `activeDesign`, not an earlier candidate or a hardcoded default.

The simulation view compares:

- **Baseline:** The existing network without the proposed intervention.
- **Proposed:** The engineer's current active design.

Results can communicate modeled flood-risk change, network loading, capacity, downstream impact, storage behavior, water-body impact, and reliability considerations where supported.

If the engineer changes the design after a simulation, the previous result is outdated and the design must be simulated again.

### 7. Bob — AI Engineering Intelligence

Bob is AEGIS's shared AI-assisted reasoning and explanation service.

Bob supports both Monitor and Build, using the relevant network and engineering context to explain results and generate candidate designs.

#### In Monitor Mode

Bob helps explain network conditions, potential risks, sensor reliability, supported what-if scenarios, and recommendation rationale.

#### In Build Mode

Bob receives structured context, including:

- Build mode: New Network or Redesign.
- Terrain and terrain analysis.
- Existing network and topology.
- Selected connection nodes.
- Engineering objectives and constraints.
- Rainfall scenario.
- Design Brief.
- Terrain and network intelligence.
- Identified risks.
- Sensor reliability.
- Downstream analysis.

Bob generates candidate design strategies and explains their trade-offs.

The documented Build workflow provides three candidate strategies:

| Candidate | Design objective | Illustrative characteristics |
|---|---|---|
| **Design A — Balanced** | Balance risk reduction, resilience, and construction complexity. | Approximately 31% flood-risk reduction, 18% downstream-load reduction, and 24% resilience improvement; moderate construction. |
| **Design B — Minimum Infrastructure** | Reduce construction complexity. | Approximately 21% flood-risk reduction, 10% downstream-load reduction, and 15% resilience improvement; low construction complexity. |
| **Design C — Maximum Resilience** | Prioritize resilience and hydraulic risk reduction. | Approximately 39% flood-risk reduction, 24% downstream-load reduction, and 34% resilience improvement; high construction complexity. |

These are documented illustrative V2 design values, not universal outcomes or guaranteed results for a real network. Where authoritative backend calculations are unavailable, authored values must not be presented as validated simulation measurements.

Bob's proposed designs pass through AEGIS validation and ranking before the engineer selects a candidate.

#### Shared Bob Architecture

Bob is implemented as a shared backend intelligence service rather than independent Monitor-only and Build-only decision systems.

The documented architecture uses an IBM inference integration, with the backend responsible for handling the API key. The key must never be exposed to the frontend.

If Bob's output is unavailable or invalid, Build can fall back to deterministic V2 candidate data.

**Core principle: Bob proposes and explains. AEGIS validates and simulates. The engineer decides.**

### 8. Deterministic Validation & Recommendations

AEGIS separates AI-generated design intelligence from deterministic engineering evaluation.

The engineering pipeline evaluates candidates against applicable constraints, feasibility rules, risk findings, and modeled outcomes.

Each relevant constraint can be represented as:

- `passed`
- `failed`
- `not_evaluated`

A candidate cannot be considered feasible when a required hard constraint fails or remains unevaluated.

Among eligible candidates, the documented ranking order is:

1. Lowest modeled network utilization.
2. Highest remaining storage.
3. Candidate ID in ascending order as the final tie-breaker.

The recommendation system distinguishes three outcomes:

| Status | Meaning |
|---|---|
| `recommended` | A feasible candidate has been selected through the defined ranking process. |
| `no_feasible_candidate` | No evaluated candidate satisfies the required constraints, given sufficiently known information. |
| `abstained` | Required information is insufficient or unreliable for a defensible recommendation. |

The recommendation carries relevant rationale, uncertainty, scope, and data limitations.

In Build Mode, deterministic validation and simulation remain AEGIS responsibilities. Bob does not independently authorize a design or replace the engineering checks.

---

## 🔄 Build Mode: End-to-End Workflow

Build connects the complete design lifecycle, from defining engineering intent to adding a finalized network to Monitor.

```text
                    ENGINEER
                       |
                       v
                  BUILD MODE
                       |
             +---------+---------+
             |                   |
             v                   v
        NEW NETWORK           REDESIGN
             |                   |
             v                   v
       Terrain Selection    Existing Network
             |                   |
             +---------+---------+
                       |
                       v
             Requirements & Constraints
                       |
                       v
                  Design Brief
                       |
                       v
              Network Assessment
                       |
                       v
               Bob Generates Designs
                       |
                       v
             AEGIS Validates & Ranks
                       |
                       v
              Engineer Selects Design
                       |
                       v
                  activeDesign
                       |
                       v
                Engineer Modifies
                       |
                       v
                  Apply Change
                       |
                       v
               Run AEGIS Simulation
                       |
                       v
               Proposed vs Baseline
                       |
                       v
                Engineering Review
                       |
                       v
                   Finalize Design
                       |
                       v
                Add to AEGIS Network
                       |
                       v
                     MONITOR
```

### The canonical active design

Build maintains a single canonical `activeDesign` throughout the design session.

The state transitions are:

`Bob Candidate → Selected Candidate → activeDesign → Engineer Modification → Apply Change → Simulation → Review → Finalization`

This is important because the engineer must be evaluating the design they actually modified.

After **Apply Change**, simulation must use the updated `activeDesign`. It must not silently revert to the original network, Design A defaults, a hardcoded demo topology, or the initial Bob candidate.

### Engineering Review

Engineering Review provides a consolidated view of the current proposed design and its simulation.

The review includes:

- Final proposed design.
- Simulation-derived performance values.
- Flood-risk results.
- Network capacity and loading.
- Downstream impact.
- Lake and water-body impact.
- Resilience and reliability where supported.
- Engineering checklist.
- Relevant data-quality information.
- Bob's explanation of design performance, trade-offs, and remaining risks.

The consolidated result describes the current canonical design and its simulation status.

### Finalization and Monitor Handoff

Finalization requires an explicit engineer action and confirmation.

- **New Network:** Create an additional network, which becomes available to Monitor.
- **Redesign:** Update the selected existing network rather than creating an unrelated duplicate.

The integrated lifecycle is:

**Monitor → Identify Risks → Build → Design → Simulate → Review → Finalize → Monitor**

This closes the loop between network observation and engineering intervention planning.

---

## 🏗️ System Architecture

AEGIS follows a modular architecture that separates network modeling, sensor intelligence, engineering evaluation, and user interaction.

| Component | Responsibility |
|---|---|
| **P1 — Digital Twin / Network Model** | Canonical network topology, infrastructure relationships, modeled network state, and shared API integration. |
| **P2 — Sensor Intelligence / Risk** | Sensor simulation, reliability, failure scenarios, data-quality classification, risk findings, and network-health assessment. |
| **P3 — Routing / Candidate Evaluation** | Candidate feasibility, constraint evaluation, risk and downstream analysis, what-if simulation, ranking, and recommendation generation. |
| **P4 — Frontend / Bob / Integration** | Monitor and Build experiences, network visualization, design modification, simulation presentation, Bob interaction, engineering review, and frontend-backend integration. |

### Architecture Principles

- **One network model:** Monitor and Build use the same canonical network representation.
- **One active design:** `activeDesign` is the source of truth for a modified Build design.
- **Separation of responsibilities:** AI reasoning, deterministic evaluation, simulation, and presentation remain distinct.
- **Explicit data quality:** Unreliable measurements are not silently treated as valid.
- **Constraint-aware decisions:** Required hard constraints are checked before candidate selection.
- **Human oversight:** AI recommendations do not automatically become finalized network changes.
- **Simulation before finalization:** Proposed designs are evaluated and reviewed before being added to the AEGIS network.
- **Closed-loop engineering:** Finalized designs flow back into Monitor.

---

## 🧰 Technology Stack

| Layer | Technology / responsibility |
|---|---|
| Frontend | React and TypeScript |
| JavaScript runtime and package manager | Bun |
| Backend | Python and FastAPI |
| Network model | Catchment graph, infrastructure nodes, edges, and modeled properties |
| Engineering intelligence | Sensor reliability, risk assessment, candidate evaluation, constraints, and deterministic ranking |
| Simulation | Scenario-based engineering evaluation and baseline comparison |
| AI integration | Bob and the IBM inference integration |
| Testing | Project tests and shared-contract fixtures |

Exact versions and additional libraries should be taken from the repository's dependency manifests and lockfiles.

---

## 📁 Repository Structure

```text
AEGIS/
├── backend/
│   └── Backend application and integration logic
├── frontend/
│   └── React / TypeScript application
├── tests/
│   └── Automated and integration tests
├── CONTRACT.md
│   └── Shared integration contract
└── README.md
    └── Project documentation
```

### Key Files and Directories

- **`backend/`** — Backend application, API endpoints, engineering integration, and Build workflows.
- **`frontend/`** — Monitor, Build, visualization, design workspace, Bob interaction, and review experiences.
- **`tests/`** — Automated and regression tests.
- **`CONTRACT.md`** — Shared integration contract covering schemas, sensor semantics, feasibility rules, recommendation outcomes, fixtures, and component responsibilities.
- **`README.md`** — Project overview, architecture, installation, usage, and engineering documentation.

---

## 🚀 Getting Started

### Prerequisites

Install the runtimes required by the project:

- Git.
- Python.
- Bun.

Check the dependency manifests and lockfiles for the versions supported by the current repository.

### 1. Clone the Repository

```bash
git clone https://github.com/gowri-279/AEGIS.git
cd AEGIS
```

### 2. Set Up the Backend

```bash
cd backend
```

If the backend provides a `requirements.txt` file, install its dependencies:

```bash
python3 -m pip install -r requirements.txt
```

If the repository uses another dependency manifest, follow that configuration instead.

### 3. Install Frontend Dependencies with Bun

Open a terminal in the repository root:

```bash
cd frontend
bun install
```

Use the repository's Bun lockfile as the source of truth for frontend dependency installation. Avoid mixing npm and Bun in the same installation workflow.

### 4. Configure the Application

Review the existing configuration and environment files for:

- Backend application entry point.
- Required backend environment variables.
- Frontend backend API URL.
- Required local services.
- Bob/IBM inference configuration.
- Development server and build scripts.

Keep API keys and private configuration out of version control. Bob's API key must remain backend-only.

---

## ▶️ Running the Application

Start the backend and frontend in separate terminals using the commands supported by the checked-out repository.

### Start the Backend

From `backend/`, if the application exposes `app` from `main.py`:

```bash
python3 -m uvicorn main:app --reload
```

Replace `main:app` with the actual application entry point if it differs.

### Start the Frontend

From `frontend/`:

```bash
bun run dev
```

This assumes the frontend's `package.json` defines a `dev` script. Open the local URL printed by the development server.

### Verify the Integration

Check that:

- Both services start successfully.
- The frontend points to the correct backend API.
- Monitor can access the expected network information.
- Build supports the intended New Network and Redesign workflows.
- Candidate selection initializes the active design correctly.
- Apply Change updates the canonical `activeDesign`.
- Simulation uses the current design.
- Engineering Review displays the corresponding simulation.
- Finalization creates or updates the correct network.
- The finalized network becomes available to Monitor.
- Bob explains the canonical system outputs and does not independently invent feasibility results.

---

## 🏗️ Build and Validation

The frontend production build verifies the frontend compilation process. Engineering validation verifies that the modeled network, candidate evaluation, simulation, and recommendation workflows behave consistently.

These are separate responsibilities, and both matter.

### Frontend Production Build

From the frontend directory:

```bash
cd frontend
bun run build
```

This assumes a `build` script exists in `frontend/package.json`.

### Code Quality

If the frontend defines a lint script:

```bash
bun run lint
```

Review errors and relevant warnings before committing changes.

### Engineering Validation

Validate the integrated workflow across these stages:

1. Network model and canonical response.
2. Sensor reliability and risk assessment.
3. Candidate generation and feasibility checks.
4. Deterministic ranking.
5. Active design modification and Apply Change.
6. Simulation against the correct baseline.
7. Engineering Review.
8. Finalization and network persistence behavior.
9. Handoff to Monitor.
10. Bob's explanation of canonical engineering results.

A successful frontend build alone does not establish that the engineering workflow is correct.

---

## 🔌 API Reference

The Build integration documents the following endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/build/bob/design` | Sends Build engineering context to Bob and obtains candidate design intelligence. |
| `POST` | `/api/v1/build/simulate` | Runs the AEGIS simulation for the current Build design. |
| `POST` | `/api/v1/build/finalize` | Finalizes a design and adds it to the AEGIS network according to Build mode. |
| `GET` | `/api/v1/build/networks` | Returns finalized networks available to the frontend and Monitor. |

These endpoint paths and responsibilities are documented by the Build specification. Confirm the exact request schemas, response schemas, and runtime behavior against the current backend implementation.

### Build API Responsibilities

**Bob design**

- Receives terrain, network, requirements, constraints, scenario, and assessment context.
- Generates candidate design intelligence.
- Validates Bob's output before it is used by the UI.
- Uses deterministic V2 candidate data as a fallback when Bob's output is unavailable or invalid.

**Simulation**

- Evaluates the current active design.
- Connects Build to the existing AEGIS engineering pipeline.
- Returns simulation information for the proposed design.

**Finalization**

- Requires an explicit engineer action and confirmation in the UI.
- Creates a new network in New Network mode.
- Updates the selected existing network in Redesign mode.

**Finalized networks**

- Makes finalized networks available to the frontend and Monitor.
- The documented demonstration implementation maintains an in-memory finalized-network mirror; this should not be mistaken for durable production persistence.

---

## 🧪 Testing

AEGIS includes a `tests/` directory and a shared integration contract defining expected engineering behavior.

If the backend uses pytest:

```bash
python3 -m pytest
```

If the frontend defines a test script, run the script declared in `frontend/package.json` using Bun. For example:

```bash
bun run test
```

The exact test command must match the repository's configured script.

### Important Behaviors to Test

**Sensor intelligence**

- Fresh, degraded, stale, missing, invalid, and conflicting readings.
- Critical WL-J3 reliability and J3 constraint handling.
- Reliability-aware explanations.

**Decision engine**

- Passed, failed, and unevaluated hard constraints.
- Exclusion of infeasible candidates from ranking.
- Deterministic tie-breaking.
- Correct handling of unavailable modeled network utilization.
- Distinction between `recommended`, `no_feasible_candidate`, and `abstained`.

**Build workflow**

- Correct behavior in New Network and Redesign modes.
- Terrain selection and optional network connections.
- Candidate selection initializing `activeDesign`.
- Engineer modifications persisting through Apply Change.
- Simulation using the latest active design.
- Previous simulation results becoming outdated after a modification.
- Proposed-versus-baseline comparison.
- Engineering Review reflecting the current simulation.
- Correct network creation or update during finalization.
- Finalized network availability in Monitor.

**AI integration**

- Bob receives the relevant engineering context.
- Invalid or unavailable Bob output triggers the documented fallback.
- Bob does not replace deterministic validation.
- API credentials remain on the backend.

---

## 🧭 Example Workflow

Consider a hypothetical stormwater intervention in the synthetic MVP.

**Step 1 — Monitor the existing network**

Inspect modeled conditions, sensor measurements, and potential risk findings.

**Step 2 — Open Build**

Choose New Network to design a separate network, or Redesign to modify an existing one.

**Step 3 — Define the engineering context**

Select terrain where applicable, specify objectives and constraints, and choose a rainfall scenario.

**Step 4 — Review the assessment**

Inspect terrain intelligence, network topology, identified risks, data reliability, and downstream considerations.

**Step 5 — Ask Bob to design**

Review the generated candidate strategies and their stated trade-offs.

**Step 6 — Validate and select a candidate**

AEGIS evaluates candidate feasibility and ranks eligible options. The engineer selects the preferred design.

**Step 7 — Modify and apply changes**

Edit the selected design. Apply Change updates the canonical `activeDesign`.

**Step 8 — Run the simulation**

Evaluate the current design against the existing baseline.

**Step 9 — Complete Engineering Review**

Review the proposed design, modeled performance, remaining risks, reliability, and Bob's explanation.

**Step 10 — Finalize**

Confirm finalization. AEGIS creates the new network or updates the selected existing network according to the chosen mode.

**Step 11 — Return to Monitor**

Inspect the finalized network using the shared AEGIS network representation.

This workflow illustrates the intended end-to-end lifecycle; individual interactions depend on the current implementation.

---

## ⚠️ Limitations and Safety

AEGIS is an engineering MVP and must be interpreted within its documented scope.

- **Synthetic data:** Current network data, measurements, thresholds, and simulation values are illustrative.
- **Limited hydraulic scope:** The current MVP does not model a complete downstream edge network.
- **Illustrative design metrics:** Authored V2 candidate values are not validated real-world performance measurements.
- **Unvalidated predictions:** Modeled network utilization and simulation outputs are not validated hydraulic predictions.
- **Sensor-dependent decisions:** Unreliable critical data can prevent a defensible recommendation.
- **Explicit uncertainty:** Unevaluated constraints must not be treated as successful checks.
- **Demonstration persistence:** Finalized networks are maintained through an in-memory mirror in the documented demonstration implementation; durable persistence must be verified separately.
- **Human engineering oversight:** Real-world deployment requires suitable calibration, validation, operational data, and qualified engineering review.

AEGIS demonstrates an integrated, explainable, constraint-aware stormwater engineering workflow. It should not be used as the sole basis for real-world flood protection, infrastructure operation, or public-safety decisions.

---

## 🔭 Future Scope

Potential directions for further development include:

- Integration with real sensor feeds and validated environmental datasets.
- Calibration against real catchment geometry and hydraulic models.
- Expanded downstream network modeling.
- Persistent storage for finalized networks and design history.
- More comprehensive intervention and scenario comparisons.
- Historical trend analysis and event replay.
- Improved uncertainty visualization and sensor diagnostics.
- Broader automated regression and end-to-end integration testing.
- Deployment, observability, and operational-readiness improvements.

These are potential extensions, not claims that the capabilities are already implemented.

---

## 🤝 Contributing

Contributions should preserve the shared interfaces and engineering decision semantics defined in [`CONTRACT.md`](./CONTRACT.md).

Before changing shared behavior:

1. Identify the affected component and its owner.
2. Review the impact on shared schemas and interfaces.
3. Update relevant tests and fixtures.
4. Coordinate contract changes with the team.
5. Verify backend, frontend, and end-to-end behavior.

Changes to sensor-reliability rules, constraint semantics, ranking logic, active-design behavior, or finalization must not be introduced silently.

---

## 📄 License

Refer to the repository's license file, if present, for the applicable licensing terms.

---

## 👥 Project

**AEGIS — AI-Powered Stormwater Intelligence & Engineering**

An integrated stormwater network monitoring, modeling, design, and decision-support platform.

- **GitHub Repository:** [gowri-279/AEGIS](https://github.com/gowri-279/AEGIS)
- **Shared Integration Contract:** [`CONTRACT.md`](./CONTRACT.md)

