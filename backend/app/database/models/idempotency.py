# app/database/models/idempotency.py
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID

from ..base import Base


class IdempotencyKey(Base):
    """Maps a client-supplied key to the order it already created.

    Checkout is not naturally idempotent: it decrements stock and charges money,
    so a double-click or a network retry would place a second order. A client that
    sends `Idempotency-Key` gets the *same* order back on a replay instead.
    """

    __tablename__ = "idempotency_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key = Column(String(128), nullable=False)
    # The endpoint the key was used for, so the same key on a different operation
    # cannot return an unrelated result.
    scope = Column(String(64), nullable=False)

    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True,
        # Indexed: PostgreSQL scans this column on every parent DELETE.
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "scope", "key", name="uq_idempotency_user_scope_key"),
    )
