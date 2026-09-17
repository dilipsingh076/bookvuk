"""Razorpay payment orders and signature verification.

Implemented against Razorpay's REST API with the standard library rather than the
SDK: it is two HTTP calls and an HMAC, and this keeps the runtime dependency
footprint (and its supply-chain surface) unchanged.

When keys are unset, `payments_enabled` is False and the API says so instead of
quietly marking orders paid.

Amounts cross the wire in the smallest currency unit (paise for INR), which is
why they are converted from Decimal rupees here and nowhere else.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from decimal import Decimal

from .config import settings

logger = logging.getLogger("bookvuk.payments")

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
RAZORPAY_PAYMENTS_URL = "https://api.razorpay.com/v1/payments"
PROVIDER = "razorpay"


class PaymentError(Exception):
    """The gateway could not be used. The message is safe to show a customer."""


def to_minor_units(amount: Decimal) -> int:
    """Rupees -> paise. Razorpay rejects fractional minor units."""
    return int((Decimal(str(amount)) * 100).to_integral_value())


def _auth_header() -> str:
    raw = f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def create_payment_order(*, amount: Decimal, receipt: str, notes: dict | None = None) -> dict:
    """Create a Razorpay order and return its JSON.

    The gateway order is what the browser checkout widget needs; our own order id
    travels in `receipt` so a webhook or a support query can be traced back.
    """
    if not settings.payments_enabled:
        raise PaymentError("Payments are not configured.")

    payload = json.dumps({
        "amount": to_minor_units(amount),
        "currency": settings.CURRENCY,
        "receipt": receipt,
        "notes": notes or {},
        # Let Razorpay capture automatically; a manual capture step would leave
        # authorised-but-uncaptured payments to reconcile by hand.
        "payment_capture": 1,
    }).encode()

    request = urllib.request.Request(
        RAZORPAY_ORDERS_URL,
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": _auth_header()},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:400]
        logger.warning("razorpay order creation failed: %s %s", exc.code, detail)
        raise PaymentError("Could not start the payment. Please try again.") from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("razorpay unreachable: %s: %s", type(exc).__name__, exc)
        raise PaymentError("Payment provider is unreachable. Please try again.") from exc


def refund_payment(*, payment_id: str, amount: Decimal, idempotency_key: str) -> dict:
    """Refund a captured payment and return Razorpay's refund JSON.

    `idempotency_key` matters more here than anywhere else in this file. The
    caller records the refund in our database *after* this returns, so a crash in
    between would leave the queue to retry a refund the gateway has already made.
    Razorpay dedupes on this header, so the retry returns the original refund
    instead of issuing a second one — the key must therefore be derived from the
    order, not generated per attempt.
    """
    if not settings.payments_enabled:
        raise PaymentError("Payments are not configured.")

    payload = json.dumps({
        "amount": to_minor_units(amount),
        # `optimum` lets Razorpay pick instant or normal; a customer-facing refund
        # should take the fastest route the payment method allows.
        "speed": "optimum",
    }).encode()

    request = urllib.request.Request(
        f"{RAZORPAY_PAYMENTS_URL}/{payment_id}/refund",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": _auth_header(),
            "x-razorpay-idempotency-key": idempotency_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:400]
        logger.warning("razorpay refund failed: %s %s", exc.code, detail)
        raise PaymentError(f"The refund was refused by the gateway ({exc.code}).") from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("razorpay unreachable during refund: %s: %s", type(exc).__name__, exc)
        raise PaymentError("Payment provider is unreachable.") from exc


def verify_payment_signature(*, razorpay_order_id: str, razorpay_payment_id: str, signature: str) -> bool:
    """Check the checkout callback really came from Razorpay.

    Without this the browser could simply claim a payment succeeded. The digest is
    compared with `compare_digest` so a wrong signature cannot be discovered one
    byte at a time by timing the response.
    """
    if not settings.payments_enabled:
        return False

    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, (signature or "").strip())
