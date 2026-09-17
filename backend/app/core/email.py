"""Outbound e-mail.

If SMTP is not configured the message is logged instead of sent. That is a
deliberate choice, not a stub: tests and local development need password-reset
and order flows to work end to end without credentials, and a logged message
makes a misconfigured production deploy visible rather than silent.

Sending is best-effort — a provider outage must not fail a checkout that already
took the customer's money. Failures are logged and swallowed.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from . import shipping
from .config import settings

logger = logging.getLogger("bookvuk.email")


def send_email(*, to: str, subject: str, body: str) -> bool:
    """Send a plain-text e-mail. Returns True if it was handed to a server."""
    if not settings.email_enabled:
        logger.info(
            "email not sent (SMTP_HOST unset); logging instead",
            extra={"mail_to": to, "mail_subject": subject},
        )
        logger.info("---- e-mail body ----\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return False

    message = EmailMessage()
    message["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM))
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception as exc:  # noqa: BLE001 - never fail the caller over e-mail
        logger.warning("email delivery failed: %s: %s", type(exc).__name__, exc)
        return False

    logger.info("email sent", extra={"mail_to": to, "mail_subject": subject})
    return True


def send_password_reset(*, to: str, name: str, token: str) -> bool:
    link = f"{settings.SITE_URL.rstrip('/')}/reset-password?token={token}"
    minutes = settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    return send_email(
        to=to,
        subject=f"Reset your {settings.SITE_NAME} password",
        body=(
            f"Hi {name},\n\n"
            f"Use the link below to choose a new password. It expires in {minutes} minutes "
            "and can only be used once.\n\n"
            f"{link}\n\n"
            "If you did not ask for this, you can ignore this e-mail — your password "
            "has not changed.\n\n"
            f"— {settings.SITE_NAME}\n"
        ),
    )


def _order_reference(order) -> str:
    """Matches the `order_number` the web pages show, so an e-mail and the site
    call the same order by the same name."""
    return "#" + str(order.id).replace("-", "")[:8].upper()


# What each status means to a customer, in their words rather than ours. A status
# with no entry here is internal bookkeeping and is not worth an e-mail.
_STATUS_MESSAGES = {
    "packed": (
        "is packed and ready to leave",
        "We have packed your order. It goes to the courier next.",
    ),
    "shipped": (
        "is on its way",
        "Your order has left our warehouse and is on its way to you.",
    ),
    "delivered": (
        "has been delivered",
        "Your order has been delivered. We hope you enjoy it.",
    ),
    "cancelled": (
        "has been cancelled",
        "Your order has been cancelled. Any payment you made is being returned.",
    ),
}


def send_order_status_update(*, to: str, name: str, order, status: str) -> bool:
    """Tell the customer their order moved.

    This used to be an in-app notification only, which nobody sees unless they
    happen to return to the site — so the one update people actually want, "it has
    shipped", never reached them.
    """
    summary = _STATUS_MESSAGES.get(status)
    if summary is None:
        return False

    headline, body = summary
    reference = _order_reference(order)

    # The consignment number is the reason a "your order has shipped" e-mail gets
    # opened at all. Without it the message says only that something left, which
    # is the part the customer could already guess, and the reply is a support
    # ticket asking where it is.
    tracking_lines = ""
    carrier = shipping.label_for(getattr(order, "tracking_carrier", None))
    number = getattr(order, "tracking_number", None)
    if number:
        tracking_lines = f"\nCourier: {carrier or 'Courier'}\nConsignment number: {number}\n"
        url = shipping.tracking_url(order.tracking_carrier, number)
        if url:
            tracking_lines += f"Track it: {url}\n"

    return send_email(
        to=to,
        subject=f"{settings.SITE_NAME} order {reference} {headline}",
        body=(
            f"Hi {name},\n\n"
            f"{body}\n\n"
            f"Order: {reference}\n"
            f"Total: {order.total}\n"
            f"{tracking_lines}\n"
            f"See the details here: {settings.SITE_URL.rstrip('/')}/orders/{order.id}\n\n"
            f"— {settings.SITE_NAME}\n"
        ),
    )


def send_back_in_stock(*, to: str, name: str, book) -> bool:
    """A book on someone's wishlist is buyable again.

    Worth sending unprompted because the intent is already proven — they asked to
    be reminded of this exact book by putting it on a list.
    """
    return send_email(
        to=to,
        subject=f"Back in stock: {book.title}",
        body=(
            f"Hi {name},\n\n"
            f"\"{book.title}\" is on your wishlist and is available again.\n\n"
            f"{settings.SITE_URL.rstrip('/')}/books/{book.id}\n\n"
            "Stock is limited, so it may not stay available long.\n\n"
            f"— {settings.SITE_NAME}\n"
        ),
    )


def send_abandoned_cart(*, to: str, name: str, items, cart_total) -> bool:
    """Remind someone what they left in their cart.

    Deliberately one reminder rather than a sequence: a single nudge is the part
    that recovers most of the revenue, and it is the part that does not read as
    pestering.
    """
    lines = [f"  {qty} x {title}" for title, qty in items]
    return send_email(
        to=to,
        subject=f"You left something in your {settings.SITE_NAME} cart",
        body=(
            f"Hi {name},\n\n"
            "Your cart is still here:\n\n"
            + "\n".join(lines)
            + f"\n\nTotal: {cart_total}\n\n"
            f"Pick up where you left off: {settings.SITE_URL.rstrip('/')}/cart\n\n"
            "If you have changed your mind, no problem — you can ignore this.\n\n"
            f"— {settings.SITE_NAME}\n"
        ),
    )


def send_order_confirmation(*, to: str, name: str, order) -> bool:
    lines = [
        f"  {item.quantity} x {item.title_snapshot} - {item.unit_price_snapshot}"
        for item in (order.items or [])
    ]
    discount_line = f"Discount:  -{order.discount}\n" if order.discount and order.discount > 0 else ""
    # Printed books are NIL-rated and the price is an MRP, so this is normally
    # zero — and a receipt that lists "Tax: 0.00" invites the question it is
    # there to answer. Kept for an order that genuinely carried tax, so a past
    # receipt still reconciles.
    tax_line = f"Tax:       {order.tax}\n" if order.tax and order.tax > 0 else ""
    return send_email(
        to=to,
        subject=f"{settings.SITE_NAME} order confirmed",
        body=(
            f"Hi {name},\n\n"
            f"Thanks for your order. Reference: {order.id}\n\n"
            + "\n".join(lines)
            + "\n\n"
            f"Subtotal:  {order.subtotal}\n"
            f"{discount_line}"
            f"Shipping:  {order.shipping}\n"
            f"{tax_line}"
            f"Total:     {order.total}\n"
            f"All prices are MRP, inclusive of all taxes.\n\n"
            f"Track it here: {settings.SITE_URL.rstrip('/')}/orders/{order.id}\n\n"
            f"— {settings.SITE_NAME}\n"
        ),
    )
