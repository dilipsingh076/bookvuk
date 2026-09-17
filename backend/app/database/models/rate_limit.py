# app/database/models/rate_limit.py
import uuid

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID

from ..base import Base


class RateLimitCounter(Base):
    """One attempt counter per (limiter, client, time window).

    Exists so the auth rate limit can be shared by every worker and container
    without running Redis: the in-process counter multiplies the intended limit by
    the number of workers and forgets everything on deploy.
    """

    __tablename__ = "rate_limit_counters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String(64), nullable=False)
    client_key = Column(String(128), nullable=False)
    window_start = Column(DateTime(timezone=True), nullable=False, index=True)
    hits = Column(Integer, nullable=False, server_default="0")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        # The upsert target: what makes the increment atomic.
        UniqueConstraint("name", "client_key", "window_start", name="uq_rate_limit_window"),
    )
