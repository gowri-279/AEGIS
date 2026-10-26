"""FastAPI entry point for the AEGIS MVP backend."""

from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.integration.scenarios import (
    FIXED_EVALUATION_TIME,
    FixtureId,
    resolve_assessment_inputs,
)
from backend.integration.workflow import run_integrated_assessment
from backend.network.fixtures import build_demo_network
from backend.network.serialization import serialize_network
from p2.sensor_simulator import simulate_readings


app = FastAPI(
    title="AEGIS Network API",
    version="1.0.0",
    description=(
        "API for the synthetic AEGIS stormwater network MVP. "
        "Network data is illustrative and is not validated hydraulic data."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class AssessmentRequest(BaseModel):
    """Minimal assessment body. Prefer fixture IDs used by the frontend."""

    fixture: FixtureId | None = None
    fixture_id: FixtureId | None = None

    proposed_volume_m3: float | None = Field(default=None, ge=0)
    diverted_volume: float | None = Field(default=None, ge=0)

    duration_seconds: float | None = Field(default=None, gt=0)
    duration: float | None = Field(default=None, gt=0)

    rainfall: float | None = None
    intervention_assumptions: dict[str, Any] | None = None

    recharge_eligibility: Literal["eligible", "ineligible"] | None = None
    baseline_excess_volume_m3: float | None = Field(default=None, ge=0)
    scenario_id: str | None = None
    wl_j3_failure_mode: (
        Literal[
            "stale",
            "missing",
            "invalid",
            "conflicting",
            "degraded",
            "degraded_unusable",
        ]
        | None
    ) = None


@app.get("/health")
def health_check() -> dict:
    """Report that the API process is running."""
    return {"status": "ok"}


@app.get("/api/v1/network")
def get_network() -> dict:
    """Return the validated, serialized synthetic network."""
    try:
        network = build_demo_network()
        return serialize_network(network)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to produce a valid network response.",
        ) from exc


@app.post("/api/v1/assessment")
def post_assessment(request: AssessmentRequest) -> dict:
    """Run P1 network + P2 reliability/risk + P3 decision → canonical response."""
    try:
        params = resolve_assessment_inputs(
            fixture=request.fixture,
            fixture_id=request.fixture_id,
            proposed_volume_m3=request.proposed_volume_m3,
            diverted_volume=request.diverted_volume,
            duration_seconds=request.duration_seconds,
            duration=request.duration,
            rainfall=request.rainfall,
            intervention_assumptions=request.intervention_assumptions,
            recharge_eligibility=request.recharge_eligibility,
            baseline_excess_volume_m3=request.baseline_excess_volume_m3,
            scenario_id=request.scenario_id,
            wl_j3_failure_mode=request.wl_j3_failure_mode,
        )
        failure_modes = (
            {"WL-J3": params["wl_j3_failure_mode"]}
            if params["wl_j3_failure_mode"] is not None
            else None
        )
        readings = simulate_readings(
            failure_modes=failure_modes,
            now=FIXED_EVALUATION_TIME,
        )

        response = run_integrated_assessment(
            readings,
            proposed_volume_m3=params["proposed_volume_m3"],
            duration_seconds=params["duration_seconds"],
            recharge_eligibility=params["recharge_eligibility"],
            baseline_excess_volume_m3=params["baseline_excess_volume_m3"],
            scenario_id=params["scenario_id"],
            rainfall=params["rainfall"],
            intervention_assumptions=params["intervention_assumptions"],
        )
        # Frontend FixtureId mapping aid — does not replace canonical fields.
        response["fixture_id"] = params["fixture_id"]
        return response
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail="Unable to process the supplied assessment inputs.",
        ) from exc
