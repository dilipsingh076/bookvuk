"""Order pricing and coupon rules.

Kept out of the route handlers so the arithmetic can be tested directly, and so
the cart preview and the real checkout cannot drift apart — both call these.

Everything is `Decimal`. Money on binary floats accumulates error, and a total
that is a paisa off is a support ticket.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from . import store_settings

CENTS = Decimal("0.01")


def money(value) -> Decimal:
    """Round to 2 decimal places, half-up (what people expect of prices)."""
    return Decimal(str(value)).quantize(CENTS, rounding=ROUND_HALF_UP)


class CouponError(Exception):
    """A coupon was supplied but cannot be applied. The message is user-facing."""


@dataclass(frozen=True)
class OrderTotals:
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal


def discount_for(coupon, subtotal: Decimal) -> Decimal:
    """The amount a coupon takes off, never more than the subtotal."""
    from ..database.models.coupon import DISCOUNT_FIXED, DISCOUNT_PERCENT

    if coupon.discount_type == DISCOUNT_PERCENT:
        amount = money(subtotal * (Decimal(str(coupon.value)) / Decimal("100")))
        if coupon.max_discount is not None:
            amount = min(amount, money(coupon.max_discount))
    elif coupon.discount_type == DISCOUNT_FIXED:
        amount = money(coupon.value)
    else:
        raise CouponError("This code is not valid.")

    # Never discount below zero, and never let a coupon pay the customer.
    return max(Decimal("0.00"), min(amount, money(subtotal)))


def assert_coupon_usable(coupon, *, subtotal: Decimal, user_redemptions: int, now: Optional[datetime] = None) -> None:
    """Raise CouponError with a customer-readable reason, or return quietly."""
    now = now or datetime.now(timezone.utc)

    if coupon is None or not coupon.is_active:
        raise CouponError("This code is not valid.")
    if coupon.starts_at is not None and now < coupon.starts_at:
        raise CouponError("This code is not active yet.")
    if coupon.expires_at is not None and now >= coupon.expires_at:
        raise CouponError("This code has expired.")
    if coupon.max_redemptions is not None and coupon.times_redeemed >= coupon.max_redemptions:
        raise CouponError("This code has reached its usage limit.")
    if (
        coupon.max_redemptions_per_user is not None
        and user_redemptions >= coupon.max_redemptions_per_user
    ):
        raise CouponError("You have already used this code.")
    if money(subtotal) < money(coupon.min_subtotal):
        raise CouponError(f"This code needs a minimum order of {money(coupon.min_subtotal)}.")


def compute_totals(subtotal, *, discount=Decimal("0.00")) -> OrderTotals:
    """Apply the discount, then shipping and tax, and round once at each step.

    Tax is charged on the discounted amount — taxing a price the customer is not
    paying would overcharge them.

    The rates come from `store_settings`, which resolves the database over the
    environment, so a shipping change takes effect without a deploy. Read here
    rather than passed in: every caller would otherwise have to fetch them, and
    a caller that forgot would quietly price an order at the old rate.
    """
    rules = store_settings.current()
    subtotal = money(subtotal)
    discount = money(discount)
    discounted = max(Decimal("0.00"), subtotal - discount)

    if discounted <= 0:
        shipping = Decimal("0.00")
    else:
        threshold = money(rules.free_shipping_threshold)
        free_shipping = threshold > 0 and discounted >= threshold
        shipping = Decimal("0.00") if free_shipping else money(rules.shipping_flat_rate)

    tax = money(discounted * rules.tax_rate)
    total = money(discounted + shipping + tax)

    return OrderTotals(
        subtotal=subtotal,
        discount=discount,
        shipping=shipping,
        tax=tax,
        total=total,
    )
