"""let a seller say they posted it, and let a quote stop being valid

Revision ID: e2b6d94a1f53
Revises: d1a5c83f0e42
Create Date: 2026-09-16 10:20:00.000000

Two gaps either side of `approved`.

**Dispatch.** `approved_at` and `received_at` had nothing between them, so after
approval both sides were blind: the seller could not tell whether the parcel had
arrived, and the shop could not tell whether it had ever been sent. One status
covered two completely different situations, and the only way to tell them apart
was to wait.

`seller_tracking_carrier` is a slug from `app/core/shipping.py` — the same
registry that carries outbound orders. The tracking URL is derived from it rather
than stored, for the same reason it is on orders: a stored link rots on every
historic row the day a courier changes its path.

**Quote expiry.** `quoted_amount` is a snapshot so a later rate change cannot
alter an offer somebody has already accepted, which is right. But nothing told
the seller how long it stood, and nothing ever ended it — a book posted six
months after the quote still had to be honoured at a price that may no longer
make sense.

Nullable, and NULL means "no expiry". Every request that predates this column has
one, and quietly expiring somebody's existing offer would be the worst possible
way to introduce the idea.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2b6d94a1f53"
down_revision: Union[str, None] = "d1a5c83f0e42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "buyback_requests", sa.Column("seller_tracking_carrier", sa.String(length=32), nullable=True)
    )
    op.add_column(
        "buyback_requests", sa.Column("seller_tracking_number", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "buyback_requests", sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "buyback_requests", sa.Column("quote_expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    # The sweep asks one question: which live requests have passed their date.
    # Partial, because only unexpired live rows are ever candidates and indexing
    # the terminal ones would be indexing the bulk of the table for nothing.
    op.create_index(
        "ix_buyback_quote_expiry",
        "buyback_requests",
        ["quote_expires_at"],
        unique=False,
        postgresql_where=sa.text("quote_expires_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_buyback_quote_expiry", table_name="buyback_requests")
    op.drop_column("buyback_requests", "quote_expires_at")
    op.drop_column("buyback_requests", "dispatched_at")
    op.drop_column("buyback_requests", "seller_tracking_number")
    op.drop_column("buyback_requests", "seller_tracking_carrier")
