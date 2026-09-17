"""somewhere for "it arrived damaged" to go

Revision ID: f3c7ea5b2064
Revises: e2b6d94a1f53
Create Date: 2026-09-16 10:30:00.000000

An order could be cancelled before dispatch and nothing existed after delivery,
so "it arrived torn" was an e-mail. Every one of those was a refund decided with
no record of what was claimed, what was seen, or what was paid back — and on
second-hand stock this happens regularly.

Scoped to **one order item**, not to the order. A three-book parcel with one
damaged copy is the normal case, and a request against the whole order cannot
express it without a free-text note that nothing can act on.

`resolution` is separate from `status`. "Approved" and "refunded to store credit"
are different facts: the first is a decision, the second is what was actually
done about it, and an order can be approved in the morning and refunded in the
afternoon. Folding them into one column loses the gap.

`photos` reuses the shape from `buyback_photos` rather than sharing a table with
it. A shared table needs either a polymorphic owner column — which gives up the
foreign key, and the foreign key is what stops orphans — or two nullable keys and
a CHECK, which is a puzzle for every future reader. Four duplicated columns is
the cheaper of the three.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "f3c7ea5b2064"
down_revision: Union[str, None] = "e2b6d94a1f53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "return_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Which line. RESTRICT rather than CASCADE: an order item that a return
        # is open against must not be removable out from under it.
        sa.Column(
            "order_item_id",
            UUID(as_uuid=True),
            sa.ForeignKey("order_items.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Why, in the customer's words plus a category the shop can count.
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default=sa.text("1")),
        # requested -> approved | rejected -> refunded
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'requested'")),
        # What was actually done: wallet | source | replacement | none
        sa.Column("resolution", sa.String(length=20), nullable=True),
        sa.Column("refund_amount", sa.Numeric(12, 2), nullable=True),
        # Shown to the customer, so it has to be a reason rather than a code.
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity >= 1", name="ck_return_quantity_positive"),
        # One open request per line. A second one is a duplicate submission, not
        # a second claim, and without this a double-click refunds twice.
        sa.Index(
            "uq_return_open_per_item",
            "order_item_id",
            unique=True,
            postgresql_where=sa.text("status IN ('requested', 'approved')"),
        ),
        # The admin queue: oldest unhandled first.
        sa.Index("ix_return_status_created", "status", "created_at"),
        # "My returns", newest first.
        sa.Index("ix_return_user_created", "user_id", sa.text("created_at DESC")),
    )

    op.create_table(
        "return_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("return_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Index("ix_return_photos_request", "request_id", "position"),
    )


def downgrade() -> None:
    op.drop_table("return_photos")
    op.drop_table("return_requests")
