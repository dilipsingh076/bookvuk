"""A Postgres-backed job queue.

Chosen over Redis/Celery deliberately: the database is already there, already
backed up, and already transactional — which is the property that matters most
here. `enqueue()` writes in the caller's transaction, so "order committed but
confirmation email never queued" is not a reachable state.

Claiming uses `SELECT ... FOR UPDATE SKIP LOCKED`: a locked row is invisible to
other workers rather than blocking them, so workers scale by just running more
processes.

Register handlers with `@handler("kind")`. A handler receives (session, payload)
and may raise — raising schedules a retry with exponential backoff until
`max_attempts`, after which the row is left completed=NULL with `last_error` set
for inspection.
"""

from __future__ import annotations

import logging
import traceback
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database.models.job import Job

logger = logging.getLogger("bookvuk.jobs")

HandlerFn = Callable[[Session, dict], None]
_HANDLERS: dict[str, HandlerFn] = {}

# Retry after 1m, 5m, 15m, 1h, 6h. Long enough to ride out a provider outage.
BACKOFF_MINUTES = (1, 5, 15, 60, 360)


def handler(kind: str):
    """Register a job handler for `kind`."""

    def register(fn: HandlerFn) -> HandlerFn:
        _HANDLERS[kind] = fn
        return fn

    return register


def registered_kinds() -> list[str]:
    return sorted(_HANDLERS)


def enqueue(
    db: Session,
    kind: str,
    payload: Optional[dict] = None,
    *,
    run_at: Optional[datetime] = None,
    max_attempts: int = 5,
) -> Job:
    """Add a job. Does NOT commit — it joins the caller's transaction on purpose."""
    if kind not in _HANDLERS:
        # Fail loudly at enqueue time rather than silently never running.
        raise ValueError(f"No handler registered for job kind {kind!r}")

    job = Job(
        kind=kind,
        payload=payload or {},
        run_at=run_at or datetime.now(timezone.utc),
        max_attempts=max_attempts,
    )
    db.add(job)
    return job


def claim_batch(db: Session, *, limit: int = 10, stale_after_minutes: int = 15) -> list[Job]:
    """Take up to `limit` due jobs, locking them against other workers.

    Also reclaims jobs whose worker died mid-run: a `locked_at` older than
    `stale_after_minutes` is treated as abandoned, otherwise a crash would leave
    work stuck forever.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after_minutes)

    rows = db.execute(
        text(
            """
            SELECT id FROM jobs
            WHERE completed_at IS NULL
              AND attempts < max_attempts
              AND run_at <= now()
              AND (locked_at IS NULL OR locked_at < :cutoff)
            ORDER BY run_at
            FOR UPDATE SKIP LOCKED
            LIMIT :limit
            """
        ),
        {"cutoff": cutoff, "limit": limit},
    ).all()

    ids = [r[0] for r in rows]
    if not ids:
        return []

    jobs = db.query(Job).filter(Job.id.in_(ids)).all()
    now = datetime.now(timezone.utc)
    for job in jobs:
        job.locked_at = now
    db.commit()
    return jobs


def run_job(db: Session, job: Job) -> bool:
    """Execute one job. Returns True if it succeeded.

    A failure rolls back whatever the handler did, then records the attempt — the
    bookkeeping must survive even though the handler's work did not.
    """
    fn = _HANDLERS.get(job.kind)
    job.attempts = int(job.attempts or 0) + 1

    if fn is None:
        job.last_error = f"No handler registered for kind {job.kind!r}"
        job.locked_at = None
        db.commit()
        logger.warning("job %s has no handler for kind %s", job.id, job.kind)
        return False

    try:
        fn(db, job.payload or {})
        job.completed_at = datetime.now(timezone.utc)
        job.locked_at = None
        job.last_error = None
        db.commit()
        logger.info("job done", extra={"job_id": str(job.id), "job_kind": job.kind})
        return True
    except Exception:
        db.rollback()
        # Re-read: the rollback discarded our in-memory changes to the row too.
        fresh = db.query(Job).filter(Job.id == job.id).first()
        if fresh is None:
            return False

        fresh.attempts = int(fresh.attempts or 0) + 1
        fresh.last_error = traceback.format_exc()[-2000:]
        fresh.locked_at = None

        if fresh.attempts < fresh.max_attempts:
            index = min(fresh.attempts - 1, len(BACKOFF_MINUTES) - 1)
            fresh.run_at = datetime.now(timezone.utc) + timedelta(minutes=BACKOFF_MINUTES[index])
            logger.warning(
                "job failed, retrying",
                extra={"job_id": str(fresh.id), "job_kind": fresh.kind, "attempt": fresh.attempts},
            )
        else:
            logger.error(
                "job failed permanently",
                extra={"job_id": str(fresh.id), "job_kind": fresh.kind, "attempt": fresh.attempts},
            )

        db.commit()
        return False
