# app/database/models/job.py
import uuid

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from ..base import Base


class Job(Base):
    """A unit of work to run outside the request that created it.

    Sending mail and fanning out notifications used to happen inside the checkout
    request, so a customer waited on an SMTP round trip for an order that was
    already committed, and a mail failure was lost with no way to retry.

    A row here is enqueued in the *same transaction* as the change that needs it,
    so a job can never refer to an order that failed to commit, and committing the
    order can never leave the follow-up work unrecorded.

    Claiming uses `SELECT ... FOR UPDATE SKIP LOCKED`, which is what lets several
    workers share this table without handing the same job to two of them.
    """

    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    kind = Column(String(64), nullable=False, index=True)
    payload = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    # Due time; also how retry backoff is expressed.
    run_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    attempts = Column(Integer, nullable=False, server_default=text("0"))
    max_attempts = Column(Integer, nullable=False, server_default=text("5"))

    # Set while a worker holds the job; cleared on failure so it can be retried.
    locked_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    # Kept on permanent failure so the row can be inspected instead of vanishing.
    last_error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        # Matches `claim_batch`'s predicate exactly. Partial, because the rows a
        # worker cares about are the small unfinished minority — once the table has
        # a history of completed jobs, a plain index on run_at makes the worker
        # walk all of them.
        Index(
            "ix_jobs_pending_run_at",
            "run_at",
            postgresql_where=text("completed_at IS NULL"),
        ),
    )
