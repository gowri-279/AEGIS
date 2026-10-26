"""FastAPI entry point for the AEGIS MVP backend."""

from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.network.fixtures import build_demo_network
from backend.network.serialization import serialize_network
from backend.integration.workflow import run_integrated_assessment
from p2.sensor_simulator import simulate_readings


app = FastAPI(
    title="AEGIS Network API",
    version="1.0.0",
    description=(
        "API for the synthetic AEGIS stormwater network MVP. "
        "Network data is illustrative and is not validated hydraulic data."
    ),
)


# Allow the local Vite development frontend to call this API.
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
    proposed_volume_m3: float = Field(default=200, ge=0)
    duration_seconds: float = Field(default=600, gt=0)
    recharge_eligibility: Literal["eligible", "ineligible"] = "ineligible"
    baseline_excess_volume_m3: float = Field(default=300, ge=0)
    scenario_id: str = "storage_and_recharge_demo"
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
    """Run the synthetic P2 sensor assessment and P3 decision workflow."""
    try:
        failure_modes = (
            {"WL-J3": request.wl_j3_failure_mode}
            if request.wl_j3_failure_mode is not None
            else None
        )
        readings = simulate_readings(failure_modes=failure_modes)

        return run_integrated_assessment(
            readings,
            proposed_volume_m3=request.proposed_volume_m3,
            duration_seconds=request.duration_seconds,
            recharge_eligibility=request.recharge_eligibility,
            baseline_excess_volume_m3=request.baseline_excess_volume_m3,
            scenario_id=request.scenario_id,
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail="Unable to process the supplied assessment inputs.",
        ) from exc
