"""Fixed-window rate limiting for the auth endpoints.

Two backends behind one interface, chosen with `RATE_LIMIT_BACKEND`:

* **memory** (default) — dependency-free, but per worker. Four uvicorn workers
  allow roughly four times the configured attempts, and counters reset on deploy.
  Honest for a single process; misleading beyond that.
* **database** — counts in Postgres, so the limit is shared across workers and
  containers and survives restarts. No Redis to run, because the database is
  already there. Costs one small upsert per attempt, which is fine on auth
  endpoints and would not be anywhere hotter.
"""

from __future__ import annotations

import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import text


class RateLimiter:
    def __init__(self, *, attempts: int, window_seconds: int, name: str):
        self.attempts = attempts
        self.window_seconds = window_seconds
        self.name = name
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    # ----- shared -----

    def _client_key(self, request: Request) -> str:
        # X-Forwarded-For is only trustworthy behind a proxy that overwrites it.
        # Take the left-most entry, falling back to the socket address.
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _too_many(self, retry_after: int) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many {self.name} attempts. Try again in {retry_after}s.",
            headers={"Retry-After": str(max(1, retry_after))},
        )

    def _use_database(self) -> bool:
        # Imported lazily so the class stays usable without app settings loaded.
        try:
            from .config import settings
        except Exception:  # noqa: BLE001
            return False
        return (getattr(settings, "RATE_LIMIT_BACKEND", "memory") or "memory").lower() == "database"

    def check(self, request: Request) -> None:
        if self._use_database():
            self._check_database(request)
        else:
            self._check_memory(request)

    def reset(self, request: Request) -> None:
        """Clear a client's counter, e.g. after a successful login."""
        key = self._client_key(request)
        with self._lock:
            self._hits.pop(key, None)

        if self._use_database():
            from ..database.db import SessionLocal

            with SessionLocal() as session:
                session.execute(
                    text(
                        "DELETE FROM rate_limit_counters WHERE name = :name AND client_key = :client"
                    ),
                    {"name": self.name, "client": key},
                )
                session.commit()

    # ----- backends -----

    def _check_memory(self, request: Request) -> None:
        key = self._client_key(request)
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            recent = [t for t in self._hits[key] if t > cutoff]

            if len(recent) >= self.attempts:
                self._hits[key] = recent
                raise self._too_many(int(self.window_seconds - (now - recent[0])) + 1)

            recent.append(now)
            self._hits[key] = recent

            # Opportunistic cleanup so idle keys do not accumulate forever.
            if len(self._hits) > 10_000:
                for k in [k for k, v in self._hits.items() if not any(t > cutoff for t in v)]:
                    del self._hits[k]

    def _check_database(self, request: Request) -> None:
        """One row per (limiter, client, window); the row *is* the counter.

        `ON CONFLICT ... DO UPDATE ... RETURNING` increments and reads atomically,
        so two workers cannot both believe they took the last attempt.
        """
        from ..database.db import SessionLocal

        key = self._client_key(request)
        now = datetime.now(timezone.utc)
        # Align to a fixed window so every worker agrees which bucket it is in.
        bucket = int(now.timestamp()) // self.window_seconds * self.window_seconds
        window_start = datetime.fromtimestamp(bucket, tz=timezone.utc)

        with SessionLocal() as session:
            hits = session.execute(
                text(
                    """
                    INSERT INTO rate_limit_counters (id, name, client_key, window_start, hits)
                    VALUES (:id, :name, :client, :window_start, 1)
                    ON CONFLICT (name, client_key, window_start)
                    DO UPDATE SET hits = rate_limit_counters.hits + 1
                    RETURNING hits
                    """
                ),
                {
                    # The primary key default is Python-side, which raw SQL bypasses,
                    # so the id is supplied here. On conflict it is simply unused.
                    "id": str(uuid.uuid4()),
                    "name": self.name,
                    "client": key,
                    "window_start": window_start,
                },
            ).scalar_one()

            # Drop long-dead windows now and then rather than needing a cron job.
            if hits == 1:
                session.execute(
                    text("DELETE FROM rate_limit_counters WHERE window_start < :cutoff"),
                    {"cutoff": now - timedelta(seconds=self.window_seconds * 4)},
                )
            session.commit()

        if hits > self.attempts:
            expires = window_start + timedelta(seconds=self.window_seconds)
            raise self._too_many(int((expires - now).total_seconds()) + 1)


def rate_limit_dependency(limiter: RateLimiter):
    def dependency(request: Request) -> None:
        limiter.check(request)

    return dependency
