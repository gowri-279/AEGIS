# AEGIS — Frontend Data Specification

> **Status: PROVISIONAL — P1/P2/P3 integration pending**
>
> This document records the frontend-facing interface agreed from the current P1, P2, and P3 coordination responses. It is intentionally not the final canonical response schema. After P1/P2/P3 integration and validation, this document must be updated against the actual integrated response and marked FINAL.

## 1. Source of Truth

The frontend follows this hierarchy:

1. `CONTRACT.md` — canonical engineering meaning, semantics, deterministic rules, and change control.
2. `EXOSKELETON.md` — product, UX, interaction, and presentation requirements.
3. This document — provisional frontend-facing ownership and data mapping derived from P1/P2/P3 coordination.
4. The actual integrated canonical backend response — final implementation truth once P1/P2/P3 are integrated and validated.

The frontend must not silently reinterpret backend semantics.

## 2. Ownership Boundary

### P1 — Network / Integration

P1 owns:
- canonical network topology;
- network nodes and edges;
- network versioning;
- shared response assembly;
- preservation/mirroring of P2 and P3 outputs without independently recalculating them.

### P2 — Sensors / Reliability / Risks

P2 owns:
- sensor reliability assessment;
- sensor issues;
- critical sensor constraints within P2's scope;
- risk findings and supporting evidence;
- network-health assessment within P2's scope;
- data-reliability and scope limitations.

P2 does not own canonical topology, candidate feasibility/ranking, route simulation, or final intervention recommendation.

### P3 — Simulation / Candidate Decisions

P3 owns:
- candidate evaluations;
- constraint checks;
- simulation results;
- baseline comparison;
- ranking;
- recommendation and abstention logic within the defined scope.

### P4 / Frontend

The frontend owns presentation and interaction only:
- dynamic network visualization;
- sensor/risk visualization;
- simulation and comparison UI;
- recommendation/review UI;
- Bob interaction UI;
- responsive information architecture;
- presentation-only geometry/layout;
- formatting and visual communication of authoritative values.

The frontend must not independently calculate hydraulic feasibility, risk scores, candidate ranking, or recommendations.

## 3. Canonical Network Contribution — P1

P1 currently proposes/implements:

```json
{
  "network": {
    "network_id": "string",
    "network_version": "string",
    "nodes": [],
    "edges": []
  }
}
```

### Node fields currently identified by P1

- `id`
- `type`
- `elevation_m`
- `storage_capacity_m3`
- `initial_occupied_storage_m3`
- `available_storage_m3`
- `recharge_eligibility`

Unknown engineering values remain `null`.

P1 has not yet finalized canonical `sensor_ids` or complete candidate associations; these require coordination with P2/P3.

### Edge fields currently identified by P1

- `id`
- `from`
- `to`
- `capacity_m3_s`
- `length_m`
- `candidate_capacity_constraint_m3_s`
- `capacity_constraint_candidate_id`

A candidate-specific capacity constraint is not a physical edge capacity.

### Dynamic topology requirement

The frontend must render `nodes[]` and `edges[]` generically. It must not contain ID-specific rendering logic for J3, L1, R1, L2, C1, C2, J4, O1, or any future component.

Connections are resolved through `from` and `to`.

### Presentation geometry

Frontend-generated positions, paths, animation trajectories, and inferred geometry are presentation-only. They do not establish physical coordinates, elevations, routing, or engineering truth.

## 4. Sensor Contribution — P2

The proposed frontend-facing sensor shape is:

```json
{
  "sensor_id": "string",
  "node_id": "string",
  "variable": "string",
  "unit": "string",
  "critical": true,
  "raw_value": 0,
  "effective_value": 0,
  "timestamp": "ISO-8601 or null",
  "age_seconds": 0,
  "status": "fresh",
  "confidence": 1,
  "issue_codes": []
}
```

The exact mapping of existing implementation names such as `quality_status`/`status` and `issue_codes`/`issue` remains to be finalized during integration.

### Sensor status

Allowed contract-aligned statuses:

- `fresh`
- `degraded`
- `stale`
- `missing`
- `invalid`
- `conflicting`

### Sensor semantics

- `fresh`: usable current evidence when otherwise valid.
- `degraded`: may remain usable when reliability policy permits; retain issue and reduced confidence.
- `stale`: raw reading may be retained for diagnostics, but effective value is unusable.
- `missing`: unavailable values are represented as `null`.
- `invalid`: reading is unusable and must not silently enter decision calculations.
- `conflicting`: reading is unusable and must not silently enter decision calculations.

Only degraded readings may retain a usable effective value when policy permits.

Sensor confidence represents **data usability/reliability**, not probability of danger.

### Critical sensor

`WL-J3` is critical for the J3 water-level hard constraint. If it is stale, missing, invalid, conflicting, or otherwise unusable, the dependent check becomes `not_evaluated` and the critical-sensor abstention policy applies.

## 5. Risk Contribution — P2

The proposed risk shape is:

```json
{
  "finding_id": "string",
  "category": "string",
  "target_id": "string",
  "title": "string",
  "observed_value": 0,
  "threshold": 0,
  "unit": "string",
  "severity": "string",
  "confidence": 0,
  "evidence": [],
  "potential_impact": "string",
  "limitations": []
}
```

The exact serialized names and enum values must be reconciled with the existing implementation and frozen contract before finalization.

P2 identifies relevant sensor/node/edge references, observed values, thresholds where applicable, severity, confidence, evidence, and impact.

The canonical risk state is `assessed_state.risk_findings`; top-level `risks` is a mirror for frontend convenience and must not be independently recalculated.

Risk confidence is distinct from sensor confidence and must not be presented as calibrated probability unless such calibration exists.

Infrastructure anomalies must remain qualified as possible, suspected, or potential rather than being presented as confirmed failures.

## 6. Candidate / Simulation Contribution — P3

P3 currently contributes a result containing:

```json
{
  "candidate_evaluations": [],
  "simulation_result": {},
  "baseline_comparison": {},
  "ranking": {},
  "recommendation": {}
}
```

The final canonical top-level naming is still to be confirmed, particularly `simulation` versus `simulation_result`.

### Simulation result currently identified

```json
{
  "scenario_id": "string",
  "proposed_volume_m3": 0,
  "duration_seconds": 0,
  "proposed_flow_m3_s": 0,
  "selected_candidate_id": "string or null",
  "residual_excess_volume_m3": "number or null"
}
```

This is illustrative bookkeeping for the proposed intervention, not a complete validated hydraulic simulation.

### Candidate evaluation currently identified

```json
{
  "candidate_id": "string",
  "checks": [],
  "feasible": true,
  "modeled_network_utilization": "number or null",
  "remaining_storage": "number or null"
}
```

Missing ranking metrics remain `null` and must not be inferred.

### Constraint check currently identified

```json
{
  "constraint": "string",
  "status": "passed | failed | not_evaluated",
  "reason_codes": [],
  "details": {}
}
```

The exact contents of `details` and whether `description`, `observed`, `limit`, and `unit` become explicit top-level fields remain integration questions.

### Recommendation currently identified

```json
{
  "recommendation_status": "recommended | no_feasible_candidate | abstained",
  "selected_candidate_id": "string or null",
  "recommendation_scope": "limited_mvp_scope",
  "safety_qualified": false,
  "rationale": [],
  "uncertainty": [],
  "data_limitations": [],
  "reason_codes": []
}
```

The compatibility alias `status` should not be required by the frontend once the canonical field name is agreed.

Recommendation and safety qualification are deliberately separate.

## 7. Unknown / Unevaluated Semantics

Unknown values remain `null`. The frontend must not replace missing values with zero, guessed limits, or inferred engineering values.

`not_evaluated` means the available information was insufficient to evaluate the relevant check. It does not mean pass or fail.

The frontend should communicate why something is unevaluated when an authoritative reason is supplied.

Not every unevaluated field automatically forces overall abstention. Critical required checks such as WL-J3 follow the explicit contract policy.

## 8. Recommendation and Ranking Semantics

P3's supplied feasibility, ranking, recommendation, and safety-qualification fields are authoritative for the frontend.

The frontend may format them for display but must not recompute them.

The contract defines modeled network utilization as a decision metric, not a validated real-world hydraulic safety percentage. If it is unavailable, it remains `null`; the frontend must not substitute an unmodeled downstream metric or zero.

### Current integration conflict — unresolved

P3 reported that the current implementation can produce `RANKING_METRICS_UNAVAILABLE` and abstain in the standard fixture because `modeled_network_utilization` and `remaining_storage` are currently `null`, while the frozen `CONTRACT.md` explicitly expects the standard fixture to recommend C-L2.

This is a backend/contract integration issue, not a frontend decision.

Until resolved through contract change control:

- the frontend must not fabricate ranking metrics;
- the frontend must not select C-L2 independently;
- the frontend must faithfully render the canonical recommendation returned by the backend;
- the final integrated response must supersede this provisional note.

## 9. Frontend Presentation Rules

The frontend may:

- generate screen/world positions;
- create visual paths between canonical nodes;
- animate flow or state transitions;
- aggregate/display backend findings;
- format units and values;
- provide interaction, filtering, selection, and contextual inspection;
- show loading, unknown, degraded, empty, and error states.

The frontend must not:

- invent engineering values;
- infer physical routing from presentation geometry;
- calculate hydraulic capacity or utilization from unavailable data;
- calculate health/risk scores independently;
- reinterpret sensor confidence as danger probability;
- convert suspected anomalies into confirmed failures;
- independently rank intervention candidates;
- independently generate the final recommendation.

## 10. Bob / AI Interaction Boundary

P4 owns the Bob interaction experience, while the canonical backend remains the source of engineering truth.

The frontend should treat AI interaction as an interface boundary rather than embedding provider-specific decision logic throughout presentation components.

Conceptually:

```text
Frontend
  ├── canonical engineering data
  ├── simulation/review context
  └── AI interaction boundary
          ↓
      Bob / backend AI service
```

Bob should explain current situation, risks, data reliability, candidates, selected candidate, simulation outcome, limitations, and uncertainty using the canonical response. The frontend should present those explanations without turning them into independent engineering decisions.

## 11. Final Integration Checklist

Before this document is marked FINAL, P1/P2/P3 must provide and validate one integrated canonical response covering:

- `network`
- sensors
- `assessed_state`
- top-level risk mirror
- scenario
- candidate evaluations
- constraint checks
- simulation result
- baseline comparison
- ranking
- recommendation
- uncertainty and limitations
- canonical field names and enums

The integrated response must be tested against at least the contract-defined standard, stress, and critical-sensor scenarios.

The final frontend data specification will then be updated from the actual response rather than from provisional proposals.

## 12. Non-Negotiable Frontend Principle

> **Backend owns meaning. Frontend owns presentation.**
>
> The frontend is a dynamic consumer of the canonical response. It must be able to render arbitrary network IDs and future topology growth without changing engineering logic or hardcoded component assumptions.
