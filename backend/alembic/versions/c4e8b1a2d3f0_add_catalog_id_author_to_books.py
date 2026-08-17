"""add catalog_id and author to books

Revision ID: c4e8b1a2d3f0
Revises: 36f8d3549eb9
Create Date: 2026-04-06

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4e8b1a2d3f0"
down_revision: Union[str, Sequence[str], None] = "dd637111f8b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("books", sa.Column("catalog_id", sa.String(length=64), nullable=True))
    op.add_column("books", sa.Column("author", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_books_catalog_id"), "books", ["catalog_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_books_catalog_id"), table_name="books")
    op.drop_column("books", "author")
    op.drop_column("books", "catalog_id")
