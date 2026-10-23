# AEGIS — Shared Integration Contract

> This contract defines the shared interfaces, semantics, schemas, deterministic decision rules, fixture expectations, and ownership boundaries between P1, P2, P3, and P4.
>
> Implementation may proceed against this contract. Any subsequent changes must follow the documented change-control process.

---

## 1. System Objective

MARK 2 is an AI-powered, network-level stormwater decision and simulation system.

The system continuously interprets a partially observed stormwater network and determines:

1. Current network state
2. Sensor/data reliability
3. Network and hydraulic risks
4. Candidate intervention routes
5. Constraint feasibility
6. What-if simulation outcomes
7. Deterministic recommendation
8. Explainable decision context for Bob
9. Interactive visualization through the frontend

The system is **not** a validated real-world hydraulic safety model.

All current network data, measurements, thresholds, and simulation values are synthetic and illustrative for the MVP.

---

# 2. Canonical Processing Pipeline

```text
SIMULATED SENSOR DATA
        ↓
DATA RELIABILITY
        ↓
CATCHMENT DIGITAL TWIN
        ↓
RISK + NETWORK HEALTH
        ↓
CANDIDATE ROUTES / INTERVENTIONS
        ↓
CONSTRAINT CHECKING
        ↓
WHAT-IF SIMULATION
        ↓
RECOMMENDATION
        ↓
BOB EXPLANATION
        ↓
INTERACTIVE FRONTEND
```

---

# 3. Ownership

## P1 — Digital Twin / Network Model

Owns:

- Canonical catchment graph
- Nodes and edges
- Drains/pipes
- Junctions
- Lakes
- Outlets
- Recharge points
- Capacities
- Elevations
- Flow directions
- Network state
- Shared FastAPI integration layer
- Canonical combined API response

P1 owns the shared backend integration architecture but does not own P3's decision logic.

---

## P2 — Sensor Intelligence + Reliability + Risk

Owns:

- Sensor simulation
- Rainfall
- Water level
- Flow
- Pressure
- Water quality
- Sensor failure scenarios
- Reliability/confidence
- Missing/stale/invalid/conflicting detection
- Risk findings
- Network-health assessment
- Sensor issue classification

---

## P3 — Routing + What-If Simulation

Owns:

- Candidate interventions
- Candidate routing
- Capacity constraints
- Storage constraints
- Recharge constraints
- Downstream constraint representation
- What-if simulation
- Baseline comparison
- Candidate ranking
- Final recommendation
- Abstention logic within the defined scope

---

## P4 — Frontend + Bob + Integration

Owns:

- Interactive digital twin UI
- Network visualization
- Sensor visualization
- Risk visualization
- Simulation visualization
- Recommendation visualization
- Bob interaction
- Frontend ↔ backend integration
- Final end-to-end UX

P4 consumes the canonical combined backend response and does not independently recalculate network physics or recommendation logic.

---

# 4. Canonical Network Model

The MVP contains a representative synthetic catchment consisting of approximately 8–12 connected components.

The network may contain:

- Junctions
- Pipes/drains
- Lakes/storage nodes
- Outlets
- Recharge points
- Sensors
- Intervention/control points

Each network component has a stable `node_id` or `edge_id`.

The network contains:

- Capacity
- Elevation where applicable
- Flow direction
- Connectivity
- Current state

---

# 5. Network Version

The canonical network model is:

```text
network_version = "1.0"
```

`network_version` identifies the frozen network model and is independent of the contract's approval/freeze status.

---

# 6. Sensor and Data Semantics

## 6.1 Sensor Quality Status

Allowed values:

```text
fresh
degraded
stale
missing
invalid
conflicting
```

---

## 6.2 Effective Value Rules

The distinction between raw and effective sensor values is mandatory.

### Fresh

```text
effective_value = usable
confidence > 0
```

### Degraded

A degraded reading may retain a usable `effective_value`.

If usable:

```text
effective_value = usable
confidence > 0
issues = ["DEGRADED_SENSOR"]
```

If unusable:

```text
effective_value = null
confidence = 0
```

The dependent check becomes:

```text
not_evaluated
```

and the required-check/abstention policy applies.

### Stale

```text
effective_value = null
confidence = 0
```

### Missing

```text
raw_value = null
effective_value = null
timestamp = null
confidence = 0
quality_status = "missing"
```

### Invalid

```text
effective_value = null
confidence = 0
```

### Conflicting

```text
effective_value = null
confidence = 0
```

Raw values may be retained for traceability even when they are not usable for decision-making.

**Only `degraded` readings may retain a usable `effective_value`.**

---

# 7. Sensor Freshness

Freshness limits:

| Sensor Type | Freshness Limit |
|---|---:|
| Rainfall | 5 min |
| Water level | 5 min |
| Flow | 5 min |
| Pressure | 5 min |
| Water quality | 15 min |

A reading is:

```text
fresh     → age <= freshness limit
stale     → age > freshness limit
```

All timestamps use ISO 8601 UTC.

---

# 8. Sensor Issue Codes

Sensor issue codes are separate from decision reason codes.

Allowed sensor issue codes include:

```text
CRITICAL_SENSOR_STALE
CRITICAL_SENSOR_MISSING
CRITICAL_SENSOR_INVALID
CRITICAL_SENSOR_CONFLICTING
MISSING_TIMESTAMP
DEGRADED_SENSOR
```

Sensor confidence represents **data usability**, not hazard probability.

Risk-finding confidence is represented separately.

---

# 9. Critical Sensor — WL-J3

`WL-J3` is a **critical sensor**.

It supplies the water-depth value required for the J3 hard constraint.

Therefore:

### Reliable WL-J3

```text
dependent_check = evaluated
```

The J3 constraint is evaluated normally.

### Degraded but usable WL-J3

```text
dependent_check = evaluated
issues = ["DEGRADED_SENSOR"]
```

The constraint is evaluated with a warning.

### Degraded but unusable WL-J3

```text
effective_value = null
dependent_check = not_evaluated
```

The required-check/abstention policy applies.

### Stale / missing / invalid / conflicting WL-J3

```text
effective_value = null
dependent_check = not_evaluated
```

Because WL-J3 is required for the J3 hard constraint:

```text
overall recommendation = abstained
```

No candidate may be selected when the required WL-J3 check cannot be defensibly evaluated.

---

# 10. J3 Water-Level Semantics

The WL-J3 reading represents:

> **Water depth at J3 relative to a synthetic J3 reference level.**

It is **not** an absolute water-surface elevation.

Threshold:

```text
J3 maximum allowed water depth = 0.80 m
```

Constraint:

```text
water_depth < 0.80 m
```

Therefore:

- `0.60 m` → pass
- `0.79 m` → pass
- `0.80 m` → fail
- `0.81 m` → fail

This is a synthetic MVP assumption and is not a validated real-world hydraulic threshold.

---

# 11. Risk Findings

`assessed_state.risk_findings` is the canonical risk representation.

The top-level:

```text
risks
```

field is a mirror for frontend convenience.

It must not be independently recalculated.

Risk categories may include:

- Hydraulic overload
- Overflow risk
- Bottleneck risk
- Infrastructure anomaly
- Water-quality risk
- Downstream propagation risk

Infrastructure anomalies should be described as:

```text
possible
suspected
potential
```

rather than confirmed physical failures.

---

# 12. Network Risk Semantics

The system must reason across connected network components.

A risk should therefore be represented with relevant:

- Node/edge
- Observed value
- Effective value where applicable
- Threshold
- Severity
- Confidence
- Evidence
- Impact

Sensor confidence and risk confidence must remain distinct.

---

# 13. Candidate Intervention Model

Each candidate intervention has:

```text
candidate_id
candidate_type
target_node
available_capacity
recharge_eligibility
constraint_evaluations
```

Candidate feasibility is represented as:

```text
passed
failed
not_evaluated
```

A candidate with a failed or unevaluated required hard constraint cannot be considered feasible or selected.

---

# 14. Recharge Eligibility

Recharge eligibility is explicitly represented for applicable candidates.

Example:

```text
recharge_eligibility:
    eligible
    ineligible
    not_evaluated
```

An unevaluated recharge eligibility condition does not automatically force overall abstention unless the missing information prevents a defensible recommendation within the defined MVP scope.

For the standard fixture:

```text
C-R1.recharge_eligibility = ineligible
```

---

# 15. Downstream Capacity

The MVP does not model a complete downstream edge network.

Therefore:

```text
downstream_capacity = not_evaluated
```

with reason:

```text
DOWNSTREAM_EDGE_NOT_MODELED
```

This limitation does not automatically prevent a recommendation if all required in-scope constraints pass.

Such a recommendation must be represented as:

```text
recommendation_scope = "limited_mvp_scope"
safety_qualified = false
```

---

# 16. P1 ↔ P3 Integration Interface

P1 provides P3 with:

```text
network
network_state
assessed_state
scenario
```

P3 returns:

```text
candidate_evaluations
simulation_result
baseline_comparison
ranking
recommendation
```

P1 assembles the canonical combined response.

P3 owns decision logic.

P1 owns shared API/integration assembly.

P4 consumes the canonical combined response.

---

# 17. What-If Scenario

A scenario contains, at minimum:

```text
scenario_id
rainfall
diverted_volume
duration
intervention assumptions
```

The standard scenario is:

```text
scenario_id = "storage_and_recharge_demo"
diverted_volume = 200 m3
duration = 600 s
```

Average diverted flow:

```text
200 / 600 = 0.333333 m3/s
```

---

# 18. Hard Constraint Evaluation

Candidate evaluation must explicitly expose the result of each relevant constraint.

Example:

```text
constraint_status:
    passed
    failed
    not_evaluated
```

A candidate is feasible only when all required hard constraints are:

```text
passed
```

---

# 19. Modeled Network Utilization

For deterministic candidate ranking, **modeled network utilization** is defined as:

```text
modeled_network_utilization
=
max(flow / capacity)
```

across all **modeled network edges affected by the candidate scenario** that have a defined positive capacity.

Where:

- `flow` = simulated post-intervention flow on the modeled edge
- `capacity` = modeled capacity of that edge
- `flow / capacity` = edge utilization ratio

Example:

```text
flow = 0.40 m3/s
capacity = 0.50 m3/s

utilization = 0.40 / 0.50
             = 0.80
             = 80%
```

Only modeled edges with a defined positive capacity are included.

Unmodeled downstream metrics are **not** included in this calculation.

### Unavailable Modeled Network Utilization

If a candidate has no eligible affected modeled edges with a defined positive capacity, then:

```text
modeled_network_utilization = null
```

If the required post-intervention flow is unavailable, then:

```text
modeled_network_utilization = null
```

The system must **never default unavailable utilization to `0`**.

A candidate with unavailable modeled network utilization:

- MUST NOT receive a ranking advantage because of the missing value.
- MUST NOT be selected through utilization-based deterministic ranking.
- MUST NOT have an unmodeled downstream metric substituted for the unavailable utilization value.

The candidate can participate in deterministic utilization-based ranking only when the required utilization value is evaluable.

The utilization value is a modeled decision metric for deterministic ranking and is not a validated real-world hydraulic safety percentage.

---

# 20. Deterministic Candidate Ranking

Ranking occurs only among candidates for which all required hard constraints have:

```text
status = passed
```

Ranking order:

### Primary

Lowest:

```text
modeled_network_utilization
```

### Secondary

Highest:

```text
remaining_storage
```

### Tertiary

Ascending:

```text
candidate_id
```

Therefore:

```text
1. lowest maximum modeled edge utilization
2. highest remaining storage
3. candidate_id ascending
```

No unmodeled downstream metric may be silently introduced into ranking.

Candidates with unavailable `modeled_network_utilization` do not receive a ranking position through the utilization-based ranking and cannot be selected by treating the unavailable value as zero.

---

# 21. Recommendation Schema

The canonical recommendation object contains:

```text
recommendation_status
selected_candidate_id
recommendation_scope
safety_qualified
rationale
uncertainty
data_limitations
```

Allowed recommendation statuses:

```text
recommended
no_feasible_candidate
abstained
```

---

# 22. Recommendation Semantics

## Recommended

A candidate has passed all required hard constraints and is selected through deterministic ranking.

Example:

```text
recommendation_status = "recommended"
selected_candidate_id = "C-L2"
```

---

## No Feasible Candidate

All candidate options fail or cannot satisfy required hard constraints, while the overall state is sufficiently known to make that conclusion.

Example:

```text
recommendation_status = "no_feasible_candidate"
selected_candidate_id = null
```

---

## Abstained

Required information is unavailable, invalid, stale, conflicting, or otherwise insufficient to make a defensible recommendation.

Example:

```text
recommendation_status = "abstained"
selected_candidate_id = null
```

---

# 23. Unknown / Unevaluated Information

Not every `not_evaluated` field automatically forces overall abstention.

Example:

```text
C-R1.recharge_eligibility = not_evaluated
```

does not automatically force abstention if another candidate can still be defensibly selected under the defined scope.

Overall abstention occurs when missing or unreliable information prevents a defensible recommendation.

Critical required checks, such as WL-J3, follow the explicit critical-sensor policy.

---

# 24. Standard Fixture

Scenario:

```text
scenario_id = "storage_and_recharge_demo"
diverted_volume = 200 m3
duration = 600 s
average_flow = 0.333333 m3/s
```

WL-J3:

```text
water_depth = 0.60 m
quality_status = reliable/fresh
```

Therefore:

```text
J3 constraint = passed
```

### C-L1

```text
available_storage = 100 m3
```

Required storage constraint:

```text
failed
```

Therefore:

```text
C-L1 = infeasible
```

### C-R1

```text
recharge_eligibility = ineligible
```

Therefore:

```text
C-R1 = infeasible
```

### C-L2

```text
available_storage = 800 m3
edge_capacity = 0.5 m3/s
```

Scenario flow:

```text
0.333333 m3/s
```

Capacity check:

```text
0.333333 < 0.5
```

Therefore the edge-capacity constraint passes.

C-L2 is feasible.

Expected recommendation:

```text
recommendation_status = "recommended"
selected_candidate_id = "C-L2"
recommendation_scope = "limited_mvp_scope"
safety_qualified = false
```

The recommendation remains limited because downstream capacity is not modeled.

---

# 25. Stress Fixture H

WL-J3:

```text
water_depth = 0.60 m
quality_status = reliable/fresh
```

Therefore:

```text
J3 constraint = passed
```

Scenario:

```text
diverted_volume = 900 m3
duration = 600 s
```

Average flow:

```text
900 / 600 = 1.5 m3/s
```

For candidates with:

```text
edge_capacity = 0.5 m3/s
```

the capacity constraint fails:

```text
1.5 > 0.5
```

L1/L2 storage and/or edge constraints fail.

R1 remains ineligible.

Therefore:

```text
no feasible candidate
```

Expected recommendation:

```text
recommendation_status = "no_feasible_candidate"
selected_candidate_id = null
```

---

# 26. Critical WL-J3 Failure Fixture

If WL-J3 is:

```text
stale
missing
invalid
conflicting
```

or is degraded but unusable:

```text
effective_value = null
```

then the J3 required hard constraint becomes:

```text
not_evaluated
```

Because WL-J3 is critical:

```text
recommendation_status = "abstained"
selected_candidate_id = null
```

A degraded but usable WL-J3 reading may still be evaluated:

```text
quality_status = degraded
effective_value = usable
issues = ["DEGRADED_SENSOR"]
```

In that case the system may continue evaluation with an explicit uncertainty warning.

---

# 27. Fixed Evaluation Time

The standard evaluation timestamp is:

```text
2026-10-23T14:30:00Z
```

All fixture calculations should use this timestamp to keep results deterministic.

All timestamps are ISO 8601 UTC.

---

# 28. Bob Responsibility

Bob is an orchestration and explanation layer.

Bob does **not** independently perform the hydraulic physics or deterministic candidate ranking.

For a request such as:

> “Bob, 90 mm rainfall is expected. What should we do?”

Bob should use the existing processing pipeline:

```text
scenario
    ↓
sensor reliability
    ↓
network state
    ↓
risk assessment
    ↓
candidate generation
    ↓
constraint checking
    ↓
simulation
    ↓
ranking
    ↓
recommendation
```

Bob then explains:

- Current situation
- Relevant risks
- Data reliability
- Candidate options
- Why candidates were rejected
- Selected candidate
- Simulation outcome
- Limitations
- Uncertainty

Bob may also proactively surface relevant network conditions, such as an approaching overload, but must ground such statements in the canonical processing outputs.

---

# 29. Frontend Responsibility

The frontend consumes the canonical combined response.

It may visualize:

- Network topology
- Water movement
- Sensor values
- Sensor confidence
- Risk regions
- Overloaded components
- Candidate routes
- Simulation results
- Before/after network state
- Recommendation
- Data limitations
- Abstention state

The frontend must not silently reinterpret backend decision semantics.

---

# 30. Change-Control Process

After this contract is frozen:

1. Identify the required change.
2. State the reason for the change.
3. Identify affected owners/modules.
4. Review the impact on schemas and fixtures.
5. Agree on the change as a team.
6. Update the contract version/schema if necessary.
7. Update affected fixtures/tests.
8. Only then modify implementation.

No team member should silently alter a shared contract.

---

# 31. Frozen Decisions

The following are now frozen for implementation:

- Network version = `1.0`
- Contract version = `1.0`
- Schema version = `1.0`
- Synthetic/illustrative MVP data mode
- Fixed evaluation timestamp
- Canonical network model
- Sensor quality semantics
- Critical WL-J3 behavior
- J3 water-depth semantics
- Sensor issue codes
- Risk-finding semantics
- Candidate feasibility states
- Recharge eligibility semantics
- Downstream unmodeled behavior
- P1 ↔ P3 integration interface
- Recommendation schema
- Recommendation statuses
- Standard fixture
- Stress Fixture H
- Critical WL-J3 abstention fixture
- Deterministic candidate ranking
- **Modeled network utilization = maximum `flow / capacity` across affected modeled edges**
- **Unavailable modeled network utilization = `null`; never default to `0`; no ranking advantage or unmodeled metric substitution**
- Ranking tie-breakers:
  1. lowest modeled network utilization
  2. highest remaining storage
  3. `candidate_id` ascending
- Bob's responsibility as explanation/orchestration layer
- P1 shared API ownership
- P3 decision-logic ownership
- P4 frontend/integration ownership

**Implementation may proceed.**

---

# Change Log

## Contract Version 1.0 — Final Freeze Clarification

**Date:** 2026-10-23

- Clarified handling of unavailable `modeled_network_utilization`.
- If no eligible affected modeled edge has a defined positive capacity, utilization is `null`.
- If required post-intervention flow is unavailable, utilization is `null`.
- Unavailable utilization must never default to `0`.
- A candidate with unavailable utilization must not receive a ranking advantage or be selected through utilization-based deterministic ranking.
- No unmodeled downstream metric may be substituted for unavailable utilization.
- Contract Version remains `1.0`.
- Schema Version remains `1.0`.
- Network Version remains `1.0`.
- All previously frozen decisions and fixtures remain unchanged.

**Implementation may proceed against this contract.**
