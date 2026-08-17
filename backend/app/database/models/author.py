import uuid

from sqlalchemy import Column, DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import UUID

from ..base import Base


class Author(Base):
    __tablename__ = "authors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True, index=True)
    bio = Column(Text, nullable=False, default="")
    status = Column(String(32), nullable=False, default="active")  # active | draft
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)

