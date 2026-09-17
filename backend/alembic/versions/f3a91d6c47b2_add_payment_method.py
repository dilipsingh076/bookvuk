"""record how an order is paid for, so cash on delivery has somewhere to live

Revision ID: f3a91d6c47b2
Revises: e7f2c94a1b38
Create Date: 2026-09-15 13:05:00.000000

`orders` recorded the *state* of a payment (`payment_status`) but never the
*method*. With one gateway and nothing else, that was the same question. Adding
cash on delivery separates them: a collected COD order is `paid`, exactly like a
card order, and the only lasting difference is the route the money took.

Backfilled to `online` rather than left NULL. Every order that existed before
this column was an online order — it was the only kind — so NULL would mean "we
do not know" about rows we do know about. `NOT NULL` then keeps it that way.

A CHECK constraint rather than an enum type: adding a value to a Postgres enum
is its own migration and cannot run inside a transaction on older servers, while
widening a CHECK is a one-line ALTER. The same reasoning is why `orders.status`
is a constrained string (see `core/order_status.py`).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a91d6c47b2"
down_revision: Union[str, None] = "e7f2c94a1b38"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "payment_method",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'online'"),
        ),
    )
    op.create_check_constraint(
        "ck_orders_payment_method",
        "orders",
        "payment_method in ('online', 'cod')",
    )
    # `payment_status` has been free-form since it was added, and a mistyped
    # value there is money the shop cannot account for. Constrained to what the
    # code actually writes — see `core/payment.py`.
    op.create_check_constraint(
        "ck_orders_payment_status",
        "orders",
        "payment_status in ('pending', 'paid', 'failed', 'refunded', 'refund_pending')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_orders_payment_status", "orders", type_="check")
    op.drop_constraint("ck_orders_payment_method", "orders", type_="check")
    op.drop_column("orders", "payment_method")
