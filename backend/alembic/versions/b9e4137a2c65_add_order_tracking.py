"""record which parcel an order shipped in

Revision ID: b9e4137a2c65
Revises: c4d70b82e916
Create Date: 2026-09-15 19:05:00.000000

An order could reach `shipped` with nothing recorded about the shipment. The
status change fired a notification and an e-mail that between them said only
"it has shipped" — no courier, no consignment number, nothing the customer could
take to the courier's own tracking page. Every "where is my order" then had to be
answered by a person, from memory or from a paper docket.

Two columns, both nullable:

* `tracking_carrier` — a slug from `app/core/shipping.py`, not free text, so the
  tracking URL can be derived from it. Unconstrained at the database level on
  purpose: the courier list changes as couriers are added and dropped, and a
  CHECK would turn removing one into a migration that has to rewrite history.
* `tracking_number` — the consignment number as printed on the label.

Nullable because most of the table predates them, because an order can be marked
shipped before the docket is to hand, and because a hand-delivered order never
has one.

`ix_orders_tracking_number` supports the lookup this exists for: a courier or a
customer quotes a consignment number and the order has to be found from it.
Partial, since only shipped orders have one and indexing the NULLs would be
indexing most of the table for nothing.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b9e4137a2c65"
down_revision: Union[str, None] = "c4d70b82e916"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("tracking_carrier", sa.String(length=32), nullable=True))
    op.add_column("orders", sa.Column("tracking_number", sa.String(length=64), nullable=True))
    op.create_index(
        "ix_orders_tracking_number",
        "orders",
        ["tracking_number"],
        unique=False,
        postgresql_where=sa.text("tracking_number IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_orders_tracking_number", table_name="orders")
    op.drop_column("orders", "tracking_number")
    op.drop_column("orders", "tracking_carrier")
