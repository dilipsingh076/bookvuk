"""Liveness and readiness probes.

`/health` answers without touching the database, so a load balancer keeps the
process in rotation during a brief database blip. `/health/ready` verifies the
database, which is what a deploy should gate on.
"""

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import settings
from app.database.db import engine

router = APIRouter(tags=["Health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(response: Response):
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
    except Exception as exc:  # noqa: BLE001 - report, never raise, from a probe
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unavailable",
            "database": settings.safe_database_target,
            "error": type(exc).__name__,
        }

    return {"status": "ready", "database": settings.safe_database_target}
