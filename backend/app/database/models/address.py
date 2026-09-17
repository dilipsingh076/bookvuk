# app/database/models/address.py
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base


class Address(Base):
    """A saved delivery address, so returning customers do not retype it.

    Orders keep their own copy of the address they shipped to (see `Order`), so
    editing or deleting one of these never changes delivery history.
    """

    __tablename__ = "addresses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    full_name = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=False)
    line1 = Column(String(255), nullable=False)
    line2 = Column(String(255), nullable=True)
    city = Column(String(120), nullable=False)
    state = Column(String(120), nullable=False)
    postal_code = Column(String(20), nullable=False)
    # ISO 3166-1 alpha-2.
    country = Column(String(2), nullable=False, server_default="IN")

    is_default = Column(Boolean, nullable=False, server_default="false", default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user = relationship("User")
