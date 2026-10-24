"""FastAPI entry point for the AEGIS MVP backend."""

from fastapi import FastAPI, HTTPException

from backend.network.fixtures import build_demo_network
from backend.network.serialization import serialize_network


app = FastAPI(
    title="AEGIS Network API",
    version="1.0.0",
    description=(
        "API for the synthetic AEGIS stormwater network MVP. "
        "Network data is illustrative and is not validated hydraulic data."
    ),
)


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
