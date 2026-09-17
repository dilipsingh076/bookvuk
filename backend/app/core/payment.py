"""How an order is paid for, and what state that payment is in.

Two vocabularies live here, and they answer different questions:

* `payment_method` — *how* the customer chose to pay. Fixed at checkout and
  never changes afterwards.
* `payment_status` — *where that payment has got to*. Moves over the order's
  life.

Both were previously free-form `String` columns that any code path could write
anything into, which is how `orders.status` used to be before
`core/order_status.py` pinned it down. The same argument applies with more force
here: a mistyped payment status is money the shop cannot account for.

### Why cash on delivery is a payment *method*, not a status

It is tempting to model COD as `payment_status = "cod"`. That conflates the two
questions and immediately breaks: a COD order that has been collected is
*paid* — same status as a card order — and the only lasting difference is how
the money arrived. Keeping them separate means the fulfilment code, the refund
path and the reports do not have to care which one it was.
"""

from __future__ import annotations

from typing import Literal

# ---- method: fixed at checkout ----

PAYMENT_METHOD_ONLINE = "online"
PAYMENT_METHOD_COD = "cod"

PaymentMethod = Literal["online", "cod"]

PAYMENT_METHODS: frozenset[str] = frozenset((PAYMENT_METHOD_ONLINE, PAYMENT_METHOD_COD))

# ---- status: moves over the order's life ----

PAYMENT_STATUS_PENDING = "pending"
PAYMENT_STATUS_PAID = "paid"
PAYMENT_STATUS_FAILED = "failed"
PAYMENT_STATUS_REFUNDED = "refunded"
#: Owed but not sent — a paid order was cancelled with no gateway configured to
#: return the money. Deliberately visible rather than silently dropped.
PAYMENT_STATUS_REFUND_PENDING = "refund_pending"

PaymentStatus = Literal["pending", "paid", "failed", "refunded", "refund_pending"]

PAYMENT_STATUSES: frozenset[str] = frozenset(
    (
        PAYMENT_STATUS_PENDING,
        PAYMENT_STATUS_PAID,
        PAYMENT_STATUS_FAILED,
        PAYMENT_STATUS_REFUNDED,
        PAYMENT_STATUS_REFUND_PENDING,
    )
)


def is_cod(order) -> bool:
    """True for an order the customer chose to pay for at the door.

    Tolerates a NULL `payment_method`: every order placed before the column
    existed was an online order, because that was the only kind.
    """
    return (order.payment_method or PAYMENT_METHOD_ONLINE) == PAYMENT_METHOD_COD


def cod_available(total, *, enabled: bool, max_total) -> tuple[bool, str | None]:
    """Whether COD may be offered for this total. Returns (allowed, reason).

    The reason is customer-facing, so it says what to do next rather than which
    rule was broken.
    """
    if not enabled:
        return False, "Cash on delivery is not available."
    if max_total is not None and max_total > 0 and total > max_total:
        return False, (
            f"Cash on delivery is available on orders up to ₹{max_total:,.0f}. "
            "Please pay online for this order."
        )
    return True, None
