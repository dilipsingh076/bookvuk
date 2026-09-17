import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from ..base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # The unread badge is fetched on every page, and every notification list
        # is newest-first, so both go through this one index instead of scanning a
        # user's whole history.
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )