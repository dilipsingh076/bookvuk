"""Store credit.

The balance is never stored — it is `SUM(amount)` over the ledger. A cached balance
column and its history are two records of the same fact, and when they disagree
there is no way to tell which one is wrong. Deriving it means that cannot happen.

Credit is spendable but capped per order (`WALLET_MAX_REDEMPTION_PERCENT`). Without
a cap, a seller with a large balance checks out for nothing, and the shop hands over
stock with no money arriving — buyback becomes a way to convert the shop's inventory
into the customer's, at the shop's expense. The cap keeps every order partly paid in
cash while still making the credit worth having.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import store_settings
from .pricing import money
from ..database.models.wallet import WalletTransaction

logger = logging.getLogger("bookvuk.wallet")

KIND_BUYBACK_PAYOUT = "buyback_payout"
KIND_ORDER_REDEMPTION = "order_redemption"
KIND_ORDER_REFUND = "order_refund"
KIND_ADJUSTMENT = "adjustment"


class WalletError(Exception):
    """The message is safe to show the customer."""


def balance(db: Session, user_id: UUID) -> Decimal:
    """Current spendable credit for `user_id`."""
    total = (
        db.query(func.coalesce(func.sum(WalletTransaction.amount), 0))
        .filter(WalletTransaction.user_id == user_id)
        .scalar()
    )
    return money(total or 0)


def max_redeemable(db: Session, user_id: UUID, subtotal) -> Decimal:
    """The most credit that may be applied to an order of `subtotal`.

    The lesser of what they have and the per-order cap, so the answer is always
    something they can actually spend right now.
    """
    subtotal = money(subtotal)
    if subtotal <= 0:
        return Decimal("0.00")

    percent = Decimal(str(store_settings.current().wallet_max_redemption_percent)) / Decimal("100")
    cap = money(subtotal * percent)
    return min(balance(db, user_id), cap)


def credit(
    db: Session,
    user_id: UUID,
    amount,
    *,
    kind: str,
    note: str,
    buyback_request_id: Optional[UUID] = None,
    order_id: Optional[UUID] = None,
) -> WalletTransaction:
    """Add credit. Does NOT commit — it joins the caller's transaction.

    Deliberate: a payout is recorded in the same transaction as the buyback request
    being marked paid, so "marked paid but never credited" is not a reachable state.
    """
    amount = money(amount)
    if amount <= 0:
        raise WalletError("A credit must be a positive amount.")

    row = WalletTransaction(
        user_id=user_id,
        amount=amount,
        kind=kind,
        note=note,
        buyback_request_id=buyback_request_id,
        order_id=order_id,
    )
    db.add(row)
    return row


def redeem(
    db: Session,
    user_id: UUID,
    amount,
    *,
    subtotal,
    order_id: Optional[UUID] = None,
    note: str = "Applied to an order",
) -> WalletTransaction:
    """Spend credit on an order. Does NOT commit.

    Re-checks the balance and the cap here rather than trusting what the client
    asked for: the amount arrives from a browser, and the balance may have moved
    since the cart was priced.
    """
    amount = money(amount)
    if amount <= 0:
        raise WalletError("Enter an amount of credit to use.")

    allowed = max_redeemable(db, user_id, subtotal)
    if amount > allowed:
        available = balance(db, user_id)
        if allowed < available:
            raise WalletError(
                f"You can use up to {allowed} of your credit on this order "
                f"({store_settings.current().wallet_max_redemption_percent}% of the order total)."
            )
        raise WalletError(f"You only have {available} in credit.")

    row = WalletTransaction(
        user_id=user_id,
        amount=-amount,
        kind=KIND_ORDER_REDEMPTION,
        note=note,
        order_id=order_id,
    )
    db.add(row)
    return row


def refund_redemption(db: Session, user_id: UUID, order_id: UUID, *, note: str) -> Optional[WalletTransaction]:
    """Give back credit that was spent on a cancelled order. Does NOT commit.

    Without this, cancelling an order silently destroys the credit part of what was
    paid: the money side is refunded through the gateway, and the customer is simply
    out of pocket for the rest.

    Idempotent — a second call returns None rather than crediting twice.
    """
    spent = (
        db.query(func.coalesce(func.sum(WalletTransaction.amount), 0))
        .filter(
            WalletTransaction.order_id == order_id,
            WalletTransaction.kind == KIND_ORDER_REDEMPTION,
        )
        .scalar()
    )
    already_refunded = (
        db.query(func.coalesce(func.sum(WalletTransaction.amount), 0))
        .filter(
            WalletTransaction.order_id == order_id,
            WalletTransaction.kind == KIND_ORDER_REFUND,
        )
        .scalar()
    )

    # `spent` is negative; the refund is its magnitude, less anything already given.
    owed = money(-(spent or 0)) - money(already_refunded or 0)
    if owed <= 0:
        return None

    row = WalletTransaction(
        user_id=user_id,
        amount=owed,
        kind=KIND_ORDER_REFUND,
        note=note,
        order_id=order_id,
    )
    db.add(row)
    logger.info("returned wallet credit", extra={"order_id": str(order_id), "amount": str(owed)})
    return row


def history(db: Session, user_id: UUID, *, limit: int = 50) -> list[WalletTransaction]:
    return (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == user_id)
        .order_by(WalletTransaction.created_at.desc())
        .limit(limit)
        .all()
    )
