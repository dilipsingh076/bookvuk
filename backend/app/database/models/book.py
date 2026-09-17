import uuid
from sqlalchemy.orm import relationship
from sqlalchemy import (
    Column,
    Computed,
    Index,
    String,
    Text,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    Numeric,
    text,
    UUID,
)
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import TSVECTOR
from ..base import Base

# Weights make a title match beat a passing mention in a blurb. Searching
# "gatsby" should surface The Great Gatsby before every book whose description
# happens to name it.
#
# `search_aliases` carries romanised spellings of Devanagari titles and authors
# ("godaan", "premchand") so a shopper on a Latin keyboard can find them at all.
# It is weighted with the title because that is what it usually romanises.
_SEARCH_EXPRESSION = (
    "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce(search_aliases, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce(author, '')), 'B') || "
    "setweight(to_tsvector('english', coalesce(description, '')), 'C')"
)


class Book(Base):
    __tablename__ = "books"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    catalog_id = Column(String(64), nullable=True, unique=True, index=True)
    author = Column(String(255), nullable=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    stock = Column(Integer, nullable=False)
    format = Column(String(50), nullable=False)
    rating = Column(Float(2, 1), nullable=False, default=0.0)
    rating_count = Column(Integer, nullable=False, default=0)
    cover_image = Column(String(500), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)

    # Romanised spellings of any Devanagari in the title and author, so "godaan"
    # finds गोदान. Written by the application (see core/transliterate.py) rather
    # than generated, because a generated column cannot call Python.
    search_aliases = Column(Text, nullable=True)

    # A used copy is its own `books` row: it has its own price and its own stock,
    # which is exactly what a purchasable thing needs. Modelling it that way keeps
    # the cart, the `SELECT ... FOR UPDATE` stock locking, checkout and refunds
    # working unchanged — they already operate on a book row.
    #
    # "new" | "like_new" | "good" | "fair"; see core/buyback.py.
    condition = Column(String(20), nullable=False, server_default=text("'new'"), index=True)

    # The catalogue entry this is a used copy of. Every used copy has one, set when
    # an admin receives the book, so a used copy is always a variant of a listed
    # title rather than a second search result for the same book.
    parent_book_id = Column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Which customer's book this came from. Provenance for a support question, and
    # what makes "we bought this from a seller" auditable.
    # `use_alter` + an explicit name because this closes a cycle: a buyback request
    # points at the catalogue book being sold, and the used copy points back at the
    # request that produced it. Without deferring one side, SQLAlchemy cannot order
    # CREATE or DROP for the two tables at all.
    source_buyback_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "buyback_requests.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_books_source_buyback",
        ),
        nullable=True,
        # Indexed: PostgreSQL scans this column on every parent DELETE.
        index=True,
    )

    # Eagerly loaded so the category name arrives with the book: clients used to
    # fetch the whole category list separately and join it in the browser, costing
    # an extra *serialized* round trip on every page that shows a book.
    #
    # `selectin`, not `joined`. A joined load adds a LEFT OUTER JOIN to every Book
    # query — including the `SELECT ... FOR UPDATE` in checkout and cancellation,
    # which PostgreSQL rejects outright ("FOR UPDATE cannot be applied to the
    # nullable side of an outer join"). `selectin` fetches the categories in a
    # second small query instead, so it is safe on every path and still never
    # N+1.
    category_ref = relationship("Category", lazy="selectin")

    # Used copies of this title, and the title a used copy belongs to.
    used_copies = relationship(
        "Book", backref="parent_book", remote_side=[id], foreign_keys=[parent_book_id],
    )

    @property
    def category(self) -> str | None:
        """The category name, for serialisation. Read-only on purpose: the column
        of record is `category_id`."""
        return self.category_ref.name if self.category_ref else None

    # Maintained by PostgreSQL, not by us: a generated column cannot drift out of
    # step with the row the way a trigger or an application-side update can.
    search_vector = Column(
        TSVECTOR,
        Computed(_SEARCH_EXPRESSION, persisted=True),
        nullable=True,
    )

    # Declared here rather than only in the migration because the test suite
    # builds its schema with `Base.metadata.create_all` — an index that exists
    # only in a migration would be missing under test, which is where the search
    # behaviour is actually checked.
    __table_args__ = (
        # Full-text search: ranked, stemmed matching over title/author/description.
        Index("ix_books_search_vector", "search_vector", postgresql_using="gin"),
        # Trigram search: the typo-tolerant fallback for when full-text finds
        # nothing, and what makes substring matching indexable at all (the old
        # `ILIKE '%term%'` could never use ix_books_title).
        Index(
            "ix_books_title_trgm",
            "title",
            postgresql_using="gin",
            postgresql_ops={"title": "gin_trgm_ops"},
        ),
        Index(
            "ix_books_author_trgm",
            "author",
            postgresql_using="gin",
            postgresql_ops={"author": "gin_trgm_ops"},
        ),
        # The fuzzy fallback needs the romanised text too. Without it a near-miss
        # like "namvar" for "namavar" was compared against Devanagari and scored
        # zero, so the fallback could not rescue a misspelled Hindi title at all.
        Index(
            "ix_books_aliases_trgm",
            "search_aliases",
            postgresql_using="gin",
            postgresql_ops={"search_aliases": "gin_trgm_ops"},
        ),
        # Browse filtered by category, newest first — the default landing query.
        Index("ix_books_category_created", "category_id", text("created_at DESC")),
    )


# Keep `search_aliases` in step with the fields it romanises, on every write path.
#
# Done with a mapper event rather than a call in each route on purpose: there are
# several ways a book gets written (admin create, admin update, the seed script)
# and one that forgot to refresh the aliases would leave a Hindi title silently
# unsearchable — the same "two code paths, one of them incomplete" failure as the
# order-cancellation bug.
def _refresh_search_aliases(_mapper, _connection, target: "Book") -> None:
    from ...core.transliterate import search_aliases

    target.search_aliases = search_aliases(target.title or "", target.author or "") or None


event.listen(Book, "before_insert", _refresh_search_aliases)
event.listen(Book, "before_update", _refresh_search_aliases)
