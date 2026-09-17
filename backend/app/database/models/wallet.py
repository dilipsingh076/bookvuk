import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID

from ..base import Base


class WalletTransaction(Base):
    """One movement of store credit. The balance is the sum of these.

    A ledger rather than a `users.wallet_balance` column, because a stored balance
    and its history are two things that can disagree — and when they do, there is no
    way to tell which is right. Here the balance is derived, so it cannot drift, and
    every rupee has a row saying where it came from.

    Rows are append-only. A mistake is corrected with an opposing `adjustment`, not
    by editing or deleting history.
    """

    __tablename__ = "wallet_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Signed: positive adds credit, negative spends it. One column rather than
    # separate credit/debit columns so a balance is a plain SUM with nothing to
    # get the sign of wrong at the call site.
    amount = Column(Numeric(12, 2), nullable=False)

    # buyback_payout | order_redemption | order_refund | adjustment
    kind = Column(String(32), nullable=False, index=True)

    # What caused it. Both nullable because an adjustment has neither.
    # Both foreign keys below are indexed: PostgreSQL scans them on every
    # parent DELETE, and without an index that scan is sequential.
    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    buyback_request_id = Column(
        UUID(as_uuid=True), ForeignKey("buyback_requests.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    # Shown to the customer in their wallet history, so it has to read like a
    # sentence rather than an internal code.
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        # A zero-value movement is always a bug at the call site, not a real event.
        CheckConstraint("amount <> 0", name="ck_wallet_amount_nonzero"),
        # The wallet page reads one user's history newest-first, and the balance sums
        # every row for one user; both go through this.
        Index("ix_wallet_user_created", "user_id", text("created_at DESC")),
    )
