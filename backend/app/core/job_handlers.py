"""Job handlers.

Everything here used to run inside an HTTP request. It is all work the customer
should not have to wait for and that must survive a transient failure — which is
exactly what the queue provides.

Imported for its side effects (registering handlers); see `app/main.py`.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from . import email as email_service
from . import payments
from .jobs import handler
from ..database import models

logger = logging.getLogger("bookvuk.jobs")


@handler("order_confirmation_email")
def order_confirmation_email(db: Session, payload: dict) -> None:
    """Email the customer their receipt.

    Raising on a delivery failure is intentional: it schedules a retry instead of
    losing the receipt, which is what happened when this ran inline.
    """
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == UUID(payload["order_id"]))
        .first()
    )
    if order is None:
        # The order was deleted; nothing to send and nothing to retry.
        logger.info("order %s is gone, skipping confirmation", payload.get("order_id"))
        return

    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user is None:
        return

    sent = email_service.send_order_confirmation(
        to=user.email,
        name=user.full_name or user.username,
        order=order,
    )
    # `send_email` returns False when SMTP is not configured (it logs instead).
    # That is a deployment choice, not a failure, so it must not retry forever.
    if not sent and email_service.settings.email_enabled:
        raise RuntimeError("order confirmation email was not accepted by the server")


@handler("admin_order_notifications")
def admin_order_notifications(db: Session, payload: dict) -> None:
    """Tell every admin a new order arrived.

    This is O(number of admins) inserts; doing it in the checkout request made
    order latency depend on how many staff accounts exist.
    """
    order_id = UUID(payload["order_id"])
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order is None:
        return

    buyer = db.query(models.User).filter(models.User.id == order.user_id).first()
    buyer_email = buyer.email if buyer else "a customer"

    admins = db.query(models.User).filter(models.User.role == "admin").all()
    for admin in admins:
        already = (
            db.query(models.Notification)
            .filter(
                models.Notification.user_id == admin.id,
                models.Notification.body.like(f"%{order_id}%"),
                models.Notification.title == "New order placed",
            )
            .first()
        )
        # Retries must not duplicate notifications.
        if already:
            continue
        db.add(
            models.Notification(
                user_id=admin.id,
                title="New order placed",
                body=f"Order {order_id} was placed by {buyer_email}.",
                is_read=False,
            )
        )
    db.commit()


@handler("password_reset_email")
def password_reset_email(db: Session, payload: dict) -> None:
    """Send a reset link.

    The raw token travels in the payload because only its hash is stored; that is
    also why this job is created with a low `max_attempts` — the token expires,
    so retrying for hours is pointless.
    """
    sent = email_service.send_password_reset(
        to=payload["email"],
        name=payload.get("name") or "there",
        token=payload["token"],
    )
    if not sent and email_service.settings.email_enabled:
        raise RuntimeError("password reset email was not accepted by the server")


@handler("order_status_email")
def order_status_email(db: Session, payload: dict) -> None:
    """Email the customer that their order moved to a new stage.

    The in-app notification this accompanies is only seen by someone who comes
    back to the site, so on its own it never delivered the update people actually
    care about.
    """
    order = (
        db.query(models.Order)
        .filter(models.Order.id == UUID(payload["order_id"]))
        .first()
    )
    if order is None:
        return

    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if user is None:
        return

    sent = email_service.send_order_status_update(
        to=user.email,
        name=user.full_name or user.username,
        order=order,
        status=payload["status"],
    )
    if not sent and email_service.settings.email_enabled:
        raise RuntimeError(f"status e-mail for order {order.id} was not accepted")


@handler("back_in_stock_email")
def back_in_stock_email(db: Session, payload: dict) -> None:
    """Tell everyone with this book on a wishlist that it is available again."""
    # `populate_existing` because a job decides what to do based on stock, and one
    # session serves a whole batch: without it, a Book already loaded earlier in
    # the batch would be read from the identity map with its stale stock.
    book = (
        db.query(models.Book)
        .populate_existing()
        .filter(models.Book.id == UUID(payload["book_id"]))
        .first()
    )
    if book is None or int(book.stock or 0) <= 0:
        # Sold out again between the restock and this job running. Telling people
        # to come and buy it now would be worse than saying nothing.
        return

    watchers = (
        db.query(models.User)
        .join(models.Wishlist, models.Wishlist.user_id == models.User.id)
        .filter(models.Wishlist.book_id == book.id)
        .all()
    )

    for user in watchers:
        already = (
            db.query(models.Notification)
            .filter(
                models.Notification.user_id == user.id,
                models.Notification.title == "Back in stock",
                models.Notification.body.like(f"%{book.title}%"),
            )
            .first()
        )
        # Retries must not notify the same person twice about the same restock.
        if already:
            continue

        db.add(
            models.Notification(
                user_id=user.id,
                title="Back in stock",
                body=f"\"{book.title}\" from your wishlist is available again.",
                is_read=False,
            )
        )
        email_service.send_back_in_stock(
            to=user.email,
            name=user.full_name or user.username,
            book=book,
        )

    db.commit()


@handler("abandoned_cart_email")
def abandoned_cart_email(db: Session, payload: dict) -> None:
    """One reminder about a cart someone walked away from."""
    user = (
        db.query(models.User)
        .filter(models.User.id == UUID(payload["user_id"]))
        .first()
    )
    if user is None:
        return

    cart = db.query(models.Cart).filter(models.Cart.user_id == user.id).first()
    if cart is None:
        return

    items = (
        db.query(models.CartItem)
        .options(joinedload(models.CartItem.book))
        .filter(models.CartItem.cart_id == cart.id)
        .all()
    )
    if not items:
        # They came back and checked out, or emptied it. Either way the reminder
        # would now be wrong.
        return

    lines = [
        (item.book.title if item.book else "an item", int(item.quantity))
        for item in items
    ]
    total = sum(
        Decimal(str(item.unit_price_snapshot)) * int(item.quantity) for item in items
    )

    sent = email_service.send_abandoned_cart(
        to=user.email,
        name=user.full_name or user.username,
        items=lines,
        cart_total=total,
    )
    if not sent and email_service.settings.email_enabled:
        raise RuntimeError(f"cart reminder for {user.id} was not accepted")


@handler("order_refund")
def order_refund(db: Session, payload: dict) -> None:
    """Return the money for a cancelled order that had been paid for.

    Runs on the queue rather than in the cancel request for the usual reason —
    the customer should not wait on the gateway — but also because a refund that
    fails must be retried rather than lost. That is the whole risk here: a
    cancellation the customer can see, with the money still on our side.

    The gateway call is made under a row lock and guarded by
    `payment_status == 'refunded'`, and `refund_payment` sends an idempotency key
    derived from the order id, so a retry cannot pay the customer twice.
    """
    order = (
        db.query(models.Order)
        .filter(models.Order.id == UUID(payload["order_id"]))
        .with_for_update()
        .first()
    )
    if order is None:
        logger.info("order %s is gone, nothing to refund", payload.get("order_id"))
        return

    if order.payment_status == "refunded":
        return

    if not order.payment_reference:
        # Marked paid with no gateway payment id to refund against. Retrying
        # cannot invent one, so raise it into the operators' laps instead.
        raise RuntimeError(f"order {order.id} is paid but has no payment reference to refund")

    amount = Decimal(str(order.total))
    refund = payments.refund_payment(
        payment_id=order.payment_reference,
        amount=amount,
        idempotency_key=f"refund-{order.id}",
    )

    order.payment_status = "refunded"
    order.refunded_at = datetime.now(timezone.utc)
    order.refund_reference = refund.get("id")
    order.refund_amount = amount
    db.add(
        models.Notification(
            user_id=order.user_id,
            title="Refund issued",
            body=(
                f"{amount} for the cancelled order {order.id} is on its way back to "
                "your original payment method."
            ),
            is_read=False,
        )
    )
    db.commit()
    logger.info(
        "refunded order",
        extra={"order_id": str(order.id), "refund_id": str(refund.get("id"))},
    )


@handler("low_stock_alert")
def low_stock_alert(db: Session, payload: dict) -> None:
    """Notify admins about books that dropped to or below the threshold."""
    threshold = int(payload.get("threshold", 10))
    book_ids = [UUID(b) for b in payload.get("book_ids", [])]
    if not book_ids:
        return

    low = (
        db.query(models.Book)
        .filter(models.Book.id.in_(book_ids), models.Book.stock <= threshold)
        .all()
    )
    if not low:
        return

    admins = db.query(models.User).filter(models.User.role == "admin").all()
    titles = ", ".join(f"{b.title} ({b.stock} left)" for b in low[:10])
    for admin in admins:
        db.add(
            models.Notification(
                user_id=admin.id,
                title="Low stock",
                body=f"Running low: {titles}",
                is_read=False,
            )
        )
    db.commit()
