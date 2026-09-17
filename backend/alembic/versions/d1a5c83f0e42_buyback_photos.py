"""let a seller photograph the book they are offering

Revision ID: d1a5c83f0e42
Revises: b9e4137a2c65
Create Date: 2026-09-16 10:10:00.000000

A seller picked a grade from a dropdown and an admin approved without ever seeing
the book. It arrived, was re-graded, and the payout changed — on every request.
"You said ₹200 and paid ₹150" is the single biggest destroyer of seller trust,
and it was caused by grading something nobody had looked at.

A table rather than `photo_1` / `photo_2` columns on `buyback_requests`: how many
photographs are useful is a product decision that will change, and each change
would otherwise be a migration.

`kind` records *what* the photograph shows — cover, spine, damage — because that
is what makes a set of three usable at a glance rather than three pictures of the
same thing. Unconstrained at the database level: a new kind should be a deploy,
not a migration that has to rewrite history.

Photographs are deliberately **not** deleted when a request is rejected. The
argument about a rejection is exactly when somebody wants to look at them.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "d1a5c83f0e42"
down_revision: Union[str, None] = "b9e4137a2c65"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "buyback_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("buyback_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # The absolute public URL, as `books.cover_image` stores it. The object
        # name is the last path segment, so a future cleanup can still find the
        # file without a second column to keep in step.
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default=sa.text("'other'")),
        # Display order. Separate from `kind` so two damage photographs can be
        # kept in the order the seller took them.
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        # Every read is "the photographs for this request, in order".
        sa.Index("ix_buyback_photos_request", "request_id", "position"),
    )


def downgrade() -> None:
    op.drop_table("buyback_photos")
