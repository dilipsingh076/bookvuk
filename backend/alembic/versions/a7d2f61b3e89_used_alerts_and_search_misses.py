"""capture the two demand signals the shop was throwing away

Revision ID: a7d2f61b3e89
Revises: f3c7ea5b2064
Create Date: 2026-09-16 16:00:00.000000

Two tables, one idea: the shop had no way to learn what people wanted and could
not have.

**`used_copy_alerts`.** The used-book machine is built end to end — the block on
the product page, the browse filter, the price comparison — and 2 of 200 titles
have a copy, so on 99% of pages it correctly shows nothing. Somebody who wants a
cheap copy of a title with none is the most useful person in the shop: they are
demand, and they are the reason to go and buy that title back. Until now they hit
a page with no used block and left, and nothing recorded it.

Separate from `wishlists`, which already drives a back-in-stock notice. Wanting a
book and wanting a *cheaper* copy of a book you can already buy are different
intentions, and collapsing them would mean notifying people about the wrong
thing.

**`search_misses`.** Every search that returned nothing is a reorder signal, and
every one of them was discarded. Aggregated by term rather than one row per
search: the useful question is "what do people keep failing to find", and a row
per keystroke answers it in a table that grows with traffic instead of with
titles.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a7d2f61b3e89"
down_revision: Union[str, None] = "f3c7ea5b2064"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "used_copy_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # The *listed* title, never a used copy: the alert is "a second-hand one
        # of this book", and used rows come and go.
        sa.Column(
            "book_id",
            UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # The price they would not go above, if they said. NULL means any price.
        sa.Column("max_price", sa.Numeric(10, 2), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        # Set when the notice went out. Kept rather than deleted so the same
        # person is not told twice about the same shelving, and so the demand
        # history survives being satisfied.
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        # One standing alert per person per title. Asking twice is the same ask.
        sa.UniqueConstraint("user_id", "book_id", name="uq_used_alert_user_book"),
        # "Who is waiting for this title" — the only read on the notify path.
        sa.Index("ix_used_alert_book", "book_id"),
    )

    op.create_table(
        "search_misses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        # Normalised (trimmed, lower-cased) so "Godaan" and "godaan " are one row.
        sa.Column("term", sa.String(length=120), nullable=False, unique=True),
        sa.Column("hits", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "first_seen", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "last_seen", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        # Cleared by the shop once it has acted on the term.
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        # The admin list: most-wanted first, unresolved only.
        sa.Index("ix_search_miss_hits", sa.text("hits DESC")),
    )


def downgrade() -> None:
    op.drop_table("search_misses")
    op.drop_table("used_copy_alerts")
