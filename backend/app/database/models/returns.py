"""A customer saying something arrived wrong.

An order could be cancelled before dispatch and nothing existed afterwards, so
"it arrived torn" was an e-mail — a refund decided with no record of what was
claimed, what was seen, or what was paid back. On second-hand stock that happens
regularly, and it is exactly the stock where a buyer most needs to believe the
shop will make it right.

Scoped to one order *item*. A three-book parcel with one damaged copy is the
normal case, and a request against the whole order cannot say which book without
a free-text note nothing can act on.
"""

import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base

# requested -> approved -> refunded, with `rejected` as the other exit.
RETURN_STATUSES = (
    "requested",   # customer has asked, nobody has looked
    "approved",    # shop accepts it; money has not moved yet
    "rejected",    # shop does not accept it, with a reason the customer sees
    "refunded",    # money is back with the customer
)

RETURN_TERMINAL_STATUSES = ("rejected", "refunded")

#: Why it came back. A short list rather than free text, because the point of
#: recording this is to be able to count it: "damaged in transit" trending up is
#: a packaging problem, "not as described" trending up on used stock is a
#: grading problem, and free text answers neither question.
RETURN_REASONS = (
    "damaged",         # arrived broken
    "not_as_described",  # condition or edition is not what the listing said
    "wrong_item",      # a different book turned up
    "missing_pages",   # specific enough to be worth its own bucket on books
    "other",
)

#: What was actually done about it. Separate from `status` on purpose: "approved"
#: is a decision and "refunded to store credit" is an act, and they can be hours
#: apart.
RETURN_RESOLUTIONS = (
    "wallet",       # store credit, which is instant and keeps the money in the shop
    "source",       # back the way it came, via the gateway
    "replacement",  # another copy sent
    "none",         # approved but nothing owed — a goodwill acceptance
)


class ReturnRequest(Base):
    __tablename__ = "return_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    # RESTRICT, not CASCADE: an order item with an open return against it must not
    # be removable out from under the claim.
    order_item_id = Column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="RESTRICT"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    reason = Column(String(32), nullable=False)
    detail = Column(Text, nullable=True)
    quantity = Column(Integer, nullable=False, server_default=text("1"), default=1)

    status = Column(
        String(20), nullable=False, server_default=text("'requested'"), default="requested"
    )
    resolution = Column(String(20), nullable=True)
    refund_amount = Column(Numeric(12, 2), nullable=True)

    # Shown to the customer, so it has to be a reason rather than a code.
    rejection_reason = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    order = relationship("Order")
    item = relationship("OrderItem")
    photos = relationship(
        "ReturnPhoto",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="ReturnPhoto.position",
    )

    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_return_quantity_positive"),
        # One open request per line. A second is a duplicate submission, not a
        # second claim — and without this a double-click refunds twice.
        Index(
            "uq_return_open_per_item",
            "order_item_id",
            unique=True,
            postgresql_where=text("status IN ('requested', 'approved')"),
        ),
        Index("ix_return_status_created", "status", "created_at"),
        Index("ix_return_user_created", "user_id", text("created_at DESC")),
    )


class ReturnPhoto(Base):
    """What the customer says it looks like.

    The whole argument about a damage claim is visual, and settling it over
    e-mail means settling it from a description.
    """

    __tablename__ = "return_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(
        UUID(as_uuid=True), ForeignKey("return_requests.id", ondelete="CASCADE"), nullable=False
    )
    url = Column(String(500), nullable=False)
    position = Column(Integer, nullable=False, server_default=text("0"), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request = relationship("ReturnRequest", back_populates="photos")

    __table_args__ = (Index("ix_return_photos_request", "request_id", "position"),)
