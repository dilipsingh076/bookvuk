"""Cancelling an order.

This exists because there were two cancellation paths and only one of them was
complete. The customer route restored the reserved stock; the admin route set
`status = 'cancelled'` and left the units decremented, so they were neither sold
nor available — lost from inventory with nothing to reconcile against. The
sales-trend report then excluded the order on the stated grounds that its stock
had gone back, which was only true for half the cancellations.

So there is one function now, and both routes call it. Anything that must be true
of a cancellation belongs here rather than in a route.

The stock restore and the status change must be in the *same* transaction: a
commit between them is a window where the order reads cancelled while its units
are still spent, and a crash there would strand them for good.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import wallet
from .config import settings
from .jobs import enqueue
from .order_status import ORDER_STATUS_CANCELLED, stamp_status_time
from ..database import models

logger = logging.getLogger("bookvuk.fulfilment")

# Set when money was taken but no refund could be started automatically. It is a
# distinct state from "refunded" on purpose: someone has to move that money by
# hand, and a silent "cancelled" would hide the obligation.
PAYMENT_STATUS_REFUND_PENDING = "refund_pending"


def restore_stock(db: Session, order_items: Iterable[models.OrderItem]) -> None:
    """Return an order's units to the books they came from.

    Books are locked in id order, matching checkout and the original cancel path.
    A consistent lock order across every writer is what keeps two of them from
    deadlocking on the same pair of rows.
    """
    items = list(order_items)
    if not items:
        return

    book_ids = {item.book_id for item in items}
    books_by_id = {
        book.id: book
        for book in db.query(models.Book)
        .filter(models.Book.id.in_(book_ids))
        .order_by(models.Book.id)
        .with_for_update()
        .all()
    }

    for item in items:
        book = books_by_id.get(item.book_id)
        if book is not None:
            book.stock = int(book.stock or 0) + int(item.quantity)


def release_coupon(db: Session, order: models.Order) -> None:
    """Give back the coupon a cancelled order consumed. Does NOT commit.

    Cancelling restored the stock and returned the store credit but left the
    coupon spent, in two separate ways:

    * `coupons.times_redeemed` stayed up, so a code with a `max_redemptions` cap
      permanently lost a slot to an order that never happened;
    * the `coupon_redemptions` row stayed, and the per-customer cap counts rows,
      so somebody who used a first-order code and then cancelled could never use
      it again — "I cancelled my order and my welcome discount is gone".

    The row itself is kept. It is financial history, the coupon reports join it
    to paid orders anyway, and deleting it would make a cancelled order's
    discount vanish from the record. What changes is that the caps stop counting
    it: `times_redeemed` comes down here, and `redemptions_for_user` below
    ignores redemptions whose order was cancelled.
    """
    if not order.coupon_code:
        return

    coupon = (
        db.query(models.Coupon)
        .filter(models.Coupon.code == order.coupon_code)
        .with_for_update()
        .first()
    )
    if coupon is None:
        # The code was deleted since. Nothing to give back.
        return

    # The caller has already set `order.status`, but this session is built with
    # `autoflush=False`, so a query here would still read the *old* status and
    # count this cancellation as live. Flushing makes the change visible inside
    # the transaction without committing it.
    db.flush()

    # Recomputed from the ledger, not decremented.
    #
    # Decrementing is not idempotent: `cancel_order_in_transaction` sets the
    # status before this runs, so there is no local signal that a release already
    # happened, and a second call would hand back a slot that was never taken.
    # Counting the live redemptions gives the same answer however many times it
    # runs — and it repairs drift that is already in the data, where a counter
    # sits above the rows behind it because an order was deleted.
    coupon.times_redeemed = (
        db.query(func.count(models.CouponRedemption.id))
        .join(models.Order, models.Order.id == models.CouponRedemption.order_id)
        .filter(
            models.CouponRedemption.coupon_id == coupon.id,
            models.Order.status != ORDER_STATUS_CANCELLED,
        )
        .scalar()
        or 0
    )
    db.add(coupon)


def redemptions_for_user(db: Session, coupon_id, user_id) -> int:
    """How many times this customer has used this code, for the per-user cap.

    Cancelled orders do not count. The cap exists to stop one person taking a
    first-order discount twice, not to punish somebody for changing their mind.
    """
    return (
        db.query(models.CouponRedemption)
        .join(models.Order, models.Order.id == models.CouponRedemption.order_id)
        .filter(
            models.CouponRedemption.coupon_id == coupon_id,
            models.CouponRedemption.user_id == user_id,
            models.Order.status != ORDER_STATUS_CANCELLED,
        )
        .count()
    )


def cancel_order_in_transaction(db: Session, order: models.Order, *, cancelled_by: str) -> None:
    """Cancel `order`, restore its stock, and start a refund if it was paid.

    The caller must already hold `order` under `SELECT ... FOR UPDATE` (two
    concurrent cancels would otherwise both pass the status check and restore the
    stock twice) and is responsible for the commit, so the whole cancellation
    lands at once.

    `cancelled_by` is either "customer" or "admin" and only affects the wording
    the customer sees.
    """
    order_items = (
        db.query(models.OrderItem)
        .filter(models.OrderItem.order_id == order.id)
        .all()
    )

    restore_stock(db, order_items)
    order.status = ORDER_STATUS_CANCELLED
    stamp_status_time(order, ORDER_STATUS_CANCELLED, datetime.now(timezone.utc))

    by_us = cancelled_by == "admin"
    db.add(
        models.Notification(
            user_id=order.user_id,
            title="Order cancelled",
            body=(
                f"Your order {order.id} has been cancelled by {settings.SITE_NAME}."
                if by_us
                else f"Your order {order.id} has been cancelled successfully."
            ),
            is_read=False,
        )
    )

    # Store credit spent on this order goes back to the wallet. The gateway refund
    # below only covers what was charged to a card, so without this the credit half
    # of a part-paid order would simply vanish.
    wallet.refund_redemption(
        db,
        order.user_id,
        order.id,
        note=f"Credit returned from cancelled order {order.id}",
    )

    release_coupon(db, order)

    _start_refund_if_paid(db, order)
    db.add(order)


def _start_refund_if_paid(db: Session, order: models.Order) -> None:
    """Give the money back when the order was actually paid for.

    Restoring stock without this is the expensive half of a cancellation done on
    its own: the customer loses the books and keeps paying for them.
    """
    if order.payment_status != "paid":
        return

    if not settings.payments_enabled:
        # There is no gateway to call, so record the debt and tell the staff.
        # Failing the cancellation instead would be worse — the customer would be
        # stuck with an order nobody intends to ship.
        order.payment_status = PAYMENT_STATUS_REFUND_PENDING
        for admin in db.query(models.User).filter(models.User.role == "admin").all():
            db.add(
                models.Notification(
                    user_id=admin.id,
                    title="Refund needed",
                    body=(
                        f"Order {order.id} was cancelled after payment of "
                        f"{order.total}, but payments are not configured. "
                        "Refund it manually."
                    ),
                    is_read=False,
                )
            )
        logger.warning(
            "order cancelled while paid but payments are disabled; refund is manual",
            extra={"order_id": str(order.id)},
        )
        return

    # Enqueued in this transaction, so the job cannot exist for a cancellation
    # that rolled back, and a committed cancellation cannot forget the refund.
    enqueue(db, "order_refund", {"order_id": str(order.id)})
