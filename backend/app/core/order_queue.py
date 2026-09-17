"""The questions the shop asks its order list, as SQL.

Three of these already existed twice: once as TypeScript predicates in
`frontend/src/api/admin.ts`, which the Orders screen ran over rows it had
already downloaded, and once as filters inside `/api/admin/queue`, which counts
them. That was survivable only while the screen downloaded every order — and
downloading every order is exactly what paginating the list stops.

With a page of rows the screen can no longer count anything itself, so the
filtering and the counting both move here and both come from one definition.

Each lens is a piece of work, not a property of the data: "to fulfil" is the
packing table's queue, "cash to collect" is money the shop is owed and has to go
and get. The wrong default view for a screen whose job is "what needs doing now"
is everything.
"""

from __future__ import annotations

from typing import Final

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement

from app.core.order_status import ORDER_STATUS_CANCELLED, ORDER_STATUS_DELIVERED
from app.core.payment import (
    PAYMENT_METHOD_COD,
    PAYMENT_METHOD_ONLINE,
    PAYMENT_STATUS_PAID,
    PAYMENT_STATUS_PENDING,
)
from app.database import models

LENS_TODO: Final[str] = "todo"
LENS_CASH: Final[str] = "cash"
LENS_UNPAID: Final[str] = "unpaid"
LENS_ALL: Final[str] = "all"

LENSES: Final[tuple[str, ...]] = (LENS_TODO, LENS_CASH, LENS_UNPAID, LENS_ALL)


def to_fulfil() -> ColumnElement[bool]:
    """Paid for (or payable at the door) and not yet packed.

    The packing table's queue. An unpaid online order is deliberately not in it —
    picking stock for money that never arrived is how the shop loses both.
    """
    return (
        models.Order.status.notin_((ORDER_STATUS_DELIVERED, ORDER_STATUS_CANCELLED))
        & models.Order.status.notin_(("packed", "shipped"))
        & or_(
            models.Order.payment_status == PAYMENT_STATUS_PAID,
            models.Order.payment_method == PAYMENT_METHOD_COD,
        )
    )


def cash_to_collect() -> ColumnElement[bool]:
    """Cash orders whose money is still outside the shop.

    Independent of how far the delivery has got: a courier can deliver and fail
    to collect, so this is not "not yet delivered", it is "not yet paid".
    """
    return (
        (models.Order.payment_method == PAYMENT_METHOD_COD)
        & (models.Order.payment_status == PAYMENT_STATUS_PENDING)
        & (models.Order.status != ORDER_STATUS_CANCELLED)
    )


def awaiting_payment() -> ColumnElement[bool]:
    """Online orders where the gateway never confirmed.

    Live ones only. A cancelled order that was never paid is not a debt, it is a
    closed file, and leaving those here makes the tab a graveyard nobody reads.
    """
    return (
        (models.Order.payment_method == PAYMENT_METHOD_ONLINE)
        & (models.Order.payment_status != PAYMENT_STATUS_PAID)
        & models.Order.status.notin_((ORDER_STATUS_DELIVERED, ORDER_STATUS_CANCELLED))
    )


#: Lens name -> the criterion that selects it. `all` is absent rather than
#: mapped to a true-expression: "no filter" is the honest description, and it
#: keeps the query from carrying a WHERE clause that does nothing.
LENS_CRITERIA: Final[dict[str, object]] = {
    LENS_TODO: to_fulfil,
    LENS_CASH: cash_to_collect,
    LENS_UNPAID: awaiting_payment,
}


def criterion_for(lens: str) -> ColumnElement[bool] | None:
    """The filter for `lens`, or None for `all` / anything unrecognised."""
    builder = LENS_CRITERIA.get(lens)
    return builder() if builder else None
