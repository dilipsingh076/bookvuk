# app/database/models/refresh_token.py
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base


class RefreshToken(Base):
    """Server-side record of an issued refresh token, so it can be revoked.

    A JWT is self-contained and therefore valid until it expires; with a 30-day
    lifetime a stolen refresh token would otherwise be unstoppable. Each token
    carries a `jti` matched against this table on every use, which makes logout
    (and revoking every session for a user) actually take effect.

    Only the id is stored, never the token string: a leak of this table must not
    hand an attacker usable credentials.
    """

    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    jti = Column(String(64), nullable=False, unique=True, index=True)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
