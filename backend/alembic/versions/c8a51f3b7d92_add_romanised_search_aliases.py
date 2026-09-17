"""add romanised search aliases for Devanagari titles

Revision ID: c8a51f3b7d92
Revises: b7d4e1a92c56
Create Date: 2026-08-19 18:31:44.902117

Half the catalogue is in Devanagari and shoppers type Hindi on a Latin keyboard.
Searching "godaan" for गोदान returned nothing; "nirmala" only worked by accident,
because the romanised form happened to appear in that book's description.

`search_aliases` holds the romanised spellings (see core/transliterate.py) and is
folded into `search_vector` at title weight, plus a trigram index so the fuzzy
fallback can rescue a misspelling like "namvar" — previously it compared the query
against Devanagari and scored zero, so the fallback did nothing for these books.

PostgreSQL cannot alter a generated column's expression, so the column is dropped
and recreated. That rebuilds its GIN index too, which is why the index is dropped
and recreated around it rather than left in place.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8a51f3b7d92'
down_revision: Union[str, Sequence[str], None] = 'b7d4e1a92c56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Must stay identical to `_SEARCH_EXPRESSION` in app/database/models/book.py — the
# test suite builds its schema from the models, so a difference here would make
# tests and production rank results differently.
NEW_EXPRESSION = (
    "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce(search_aliases, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce(author, '')), 'B') || "
    "setweight(to_tsvector('english', coalesce(description, '')), 'C')"
)

OLD_EXPRESSION = (
    "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce(author, '')), 'B') || "
    "setweight(to_tsvector('english', coalesce(description, '')), 'C')"
)


def _rebuild_search_vector(expression: str) -> None:
    op.drop_index("ix_books_search_vector", table_name="books")
    op.drop_column("books", "search_vector")
    op.execute(
        "ALTER TABLE books ADD COLUMN search_vector tsvector "
        f"GENERATED ALWAYS AS ({expression}) STORED"
    )
    op.create_index(
        "ix_books_search_vector", "books", ["search_vector"], postgresql_using="gin"
    )


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("books", sa.Column("search_aliases", sa.Text(), nullable=True))
    _rebuild_search_vector(NEW_EXPRESSION)
    op.create_index(
        "ix_books_aliases_trgm", "books", ["search_aliases"],
        postgresql_using="gin", postgresql_ops={"search_aliases": "gin_trgm_ops"},
    )
    # Existing rows have no aliases yet; `scripts/backfill_search_aliases.py`
    # populates them. Deliberately not done here: transliteration is Python, and a
    # migration that imports application code ages badly.


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_books_aliases_trgm", table_name="books")
    _rebuild_search_vector(OLD_EXPRESSION)
    op.drop_column("books", "search_aliases")
