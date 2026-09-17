# app/database/models/password_reset.py
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base


class PasswordResetToken(Base):
    """A single-use password reset token.

    Only a SHA-256 hash of the token is stored. The raw value exists solely in the
    e-mail we send, so a leak of this table cannot be used to reset anyone's
    password — the same reason passwords themselves are never stored in the clear.
    """

    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    token_hash = Column(String(64), nullable=False, unique=True, index=True)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
