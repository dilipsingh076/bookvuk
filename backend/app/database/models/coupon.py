# app/database/models/coupon.py
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base

DISCOUNT_PERCENT = "percent"
DISCOUNT_FIXED = "fixed"


class Coupon(Base):
    """A discount code.

    Amounts are `Numeric`, never float: money arithmetic on binary floats drifts,
    and a coupon that computes a total one paisa off is a support ticket.
    """

    __tablename__ = "coupons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Stored uppercase so lookups are case-insensitive without a functional index.
    code = Column(String(32), nullable=False, unique=True, index=True)
    description = Column(String(255), nullable=True)

    # "percent" -> `value` is 0-100. "fixed" -> `value` is an absolute amount.
    discount_type = Column(String(16), nullable=False)
    value = Column(Numeric(12, 2), nullable=False)

    # Order subtotal required before the code applies.
    min_subtotal = Column(Numeric(12, 2), nullable=False, server_default=text("0"), default=0)
    # Ceiling for percentage codes, so "50% off" cannot give away an unbounded amount.
    max_discount = Column(Numeric(12, 2), nullable=True)

    is_active = Column(Boolean, nullable=False, server_default="true", default=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Null means unlimited.
    max_redemptions = Column(Integer, nullable=True)
    # Per-customer cap; null means unlimited.
    max_redemptions_per_user = Column(Integer, nullable=True, server_default=text("1"), default=1)
    times_redeemed = Column(Integer, nullable=False, server_default=text("0"), default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CouponRedemption(Base):
    """One row per successful use, which is what enforces the per-user cap."""

    __tablename__ = "coupon_redemptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coupon_id = Column(
        UUID(as_uuid=True), ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    coupon = relationship("Coupon")

    __table_args__ = (
        # An order is charged once, so it can redeem a given coupon only once.
        UniqueConstraint("coupon_id", "order_id", name="uq_coupon_order"),
    )
