"""Order status values and the transitions allowed between them.

`orders.status` used to be a free-form string, so an admin could set it to
anything and the frontend's status badges and timeline would silently stop
matching. The set below is exactly what the admin UI offers.

The important invariant is that `delivered` and `cancelled` are terminal.
Cancelling an order restores its stock, so allowing `cancelled -> processing`
would count that stock twice.
"""

from __future__ import annotations

from typing import Literal

ORDER_STATUS_PROCESSING = "processing"
ORDER_STATUS_PENDING = "pending"
ORDER_STATUS_PAID = "paid"
ORDER_STATUS_PACKED = "packed"
ORDER_STATUS_SHIPPED = "shipped"
ORDER_STATUS_DELIVERED = "delivered"
ORDER_STATUS_CANCELLED = "cancelled"

OrderStatus = Literal[
    "processing",
    "pending",
    "paid",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
]

ORDER_STATUSES: frozenset[str] = frozenset(
    (
        ORDER_STATUS_PROCESSING,
        ORDER_STATUS_PENDING,
        ORDER_STATUS_PAID,
        ORDER_STATUS_PACKED,
        ORDER_STATUS_SHIPPED,
        ORDER_STATUS_DELIVERED,
        ORDER_STATUS_CANCELLED,
    )
)

TERMINAL_ORDER_STATUSES: frozenset[str] = frozenset(
    (ORDER_STATUS_DELIVERED, ORDER_STATUS_CANCELLED)
)


# The column that records when a status was reached. Statuses absent from this
# map (`processing`, `pending`, `paid`) are covered by `created_at` and `paid_at`.
STATUS_TIMESTAMP_COLUMNS: dict[str, str] = {
    ORDER_STATUS_PACKED: "packed_at",
    ORDER_STATUS_SHIPPED: "shipped_at",
    ORDER_STATUS_DELIVERED: "delivered_at",
    ORDER_STATUS_CANCELLED: "cancelled_at",
}


def stamp_status_time(order, status: str, when) -> None:
    """Record when `order` reached `status`.

    The customer's timeline needs the time, not just the current status. Kept
    here next to the status list so a new status cannot be added without this
    being the obvious next question.

    An already-set stamp is left alone: the first time a stage was reached is the
    true one, and a repeated PUT of the same status must not move it.
    """
    column = STATUS_TIMESTAMP_COLUMNS.get(status)
    if column and getattr(order, column, None) is None:
        setattr(order, column, when)


def is_terminal(status: str) -> bool:
    return status in TERMINAL_ORDER_STATUSES


def can_transition(current: str, new: str) -> bool:
    """A terminal order is frozen; anything else may move to any known status."""
    if current == new:
        return True
    return not is_terminal(current)
