"""record whether an order's payment was taken with test or live keys

Revision ID: a5c318e9f47d
Revises: f3a91d6c47b2
Create Date: 2026-09-15 15:10:00.000000

`RAZORPAY_MODE` lets one deployment switch between test and live keys. With a
separate database per environment that would be all it needed. With **one**
database serving both — the normal state before launch — test orders and real
ones become indistinguishable rows, and every report that sums `total` where
`payment_status = 'paid'` counts play money as revenue.

So the mode the payment was taken under is recorded on the order itself, at the
moment the gateway order is created. NULL where no gateway was involved: cash on
delivery, and anything placed while payments were unconfigured.

Existing rows stay NULL rather than being guessed at. No order in this database
has ever been through a gateway — `payments_enabled` has been false throughout —
so backfilling them to either value would be inventing a fact.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a5c318e9f47d"
down_revision: Union[str, None] = "f3a91d6c47b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("payment_mode", sa.String(length=8), nullable=True))
    op.create_index("ix_orders_payment_mode", "orders", ["payment_mode"])
    op.create_check_constraint(
        "ck_orders_payment_mode",
        "orders",
        "payment_mode is null or payment_mode in ('test', 'live')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_orders_payment_mode", "orders", type_="check")
    op.drop_index("ix_orders_payment_mode", table_name="orders")
    op.drop_column("orders", "payment_mode")
