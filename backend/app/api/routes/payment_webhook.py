"""Razorpay webhook.

The gateway — not the browser — is the source of truth for whether money moved.
Relying only on the browser callback means a customer who pays and closes the tab
leaves the order `pending` forever: money taken, nothing fulfilled. This endpoint
closes that hole; the browser callback stays as the fast path so the customer sees
confirmation immediately.

Deliberately unauthenticated (Razorpay has no session) and deliberately
idempotent: webhooks are delivered at least once, so the same event will arrive
again.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import db, models

router = APIRouter(prefix="/api/payments", tags=["Payments"])
logger = logging.getLogger("bookvuk.payments")

# Events that mean "this order is settled" / "it failed".
PAID_EVENTS = {"payment.captured", "order.paid"}
FAILED_EVENTS = {"payment.failed"}


def _valid_signature(raw_body: bytes, signature: str) -> bool:
    """Webhook signatures use the webhook secret, not the API key secret."""
    secret = settings.razorpay_webhook_secret
    if not secret:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, (signature or "").strip())


@router.post("/webhook/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
    db: Session = Depends(db.get_db),
):
    if not settings.razorpay_webhook_secret:
        # Nothing can be verified, so nothing may be trusted.
        raise HTTPException(status_code=503, detail="Webhooks are not configured.")

    # Signature is over the exact bytes received, so the raw body is required —
    # re-serialising the parsed JSON would change it and break verification.
    raw = await request.body()
    if not _valid_signature(raw, x_razorpay_signature):
        logger.warning("rejected a webhook with an invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature.")

    try:
        event = json.loads(raw.decode())
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Malformed payload.")

    kind = str(event.get("event") or "")
    entities = (event.get("payload") or {})
    payment = (entities.get("payment") or {}).get("entity") or {}
    gateway_order = (entities.get("order") or {}).get("entity") or {}

    gateway_order_id = payment.get("order_id") or gateway_order.get("id")
    payment_id = payment.get("id")

    if not gateway_order_id:
        # Nothing to correlate: acknowledge so the gateway stops redelivering.
        return {"status": "ignored", "reason": "no order id in payload"}

    order = (
        db.query(models.Order)
        .filter(models.Order.payment_order_id == gateway_order_id)
        .with_for_update()
        .first()
    )
    if order is None:
        # Unknown order (wrong environment, or already purged). Acknowledge:
        # returning an error would make Razorpay retry forever.
        logger.warning("webhook for unknown gateway order %s", gateway_order_id)
        return {"status": "ignored", "reason": "unknown order"}

    if kind in PAID_EVENTS:
        if order.payment_status == "paid":
            # Duplicate delivery — already handled.
            return {"status": "ok", "order_id": str(order.id), "duplicate": True}

        order.payment_status = "paid"
        order.payment_reference = payment_id or order.payment_reference
        order.paid_at = datetime.now(timezone.utc)
        db.add(
            models.Notification(
                user_id=order.user_id,
                title="Payment received",
                body=f"Payment for order {order.id} was received.",
                is_read=False,
            )
        )
        db.commit()
        logger.info("order %s marked paid by webhook", order.id)
        return {"status": "ok", "order_id": str(order.id)}

    if kind in FAILED_EVENTS:
        # Never downgrade a paid order: a late failure event for an earlier
        # attempt must not undo a payment that actually succeeded.
        if order.payment_status != "paid":
            order.payment_status = "failed"
            db.commit()
        return {"status": "ok", "order_id": str(order.id)}

    return {"status": "ignored", "reason": f"unhandled event {kind}"}
