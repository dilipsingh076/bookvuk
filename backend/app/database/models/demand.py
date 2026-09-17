"""What people wanted and could not have.

Both of these record a miss rather than a sale, which is the part the shop had no
way to see. A wishlist says "I like this"; these say "I would have paid you, and
you had nothing to sell me" — which is the more actionable of the two, because it
names exactly what to go and buy.
"""

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base


class UsedCopyAlert(Base):
    """Somebody waiting for a second-hand copy of a title the shop has none of.

    Distinct from a wishlist entry, which drives the back-in-stock notice for the
    *new* book. Wanting a book and wanting a cheaper copy of a book already on
    sale are different intentions; notifying one from the other would tell
    somebody their alert fired when it did not.

    These are also the reorder list for buyback: the titles with the most people
    waiting are the titles worth paying sellers for.
    """

    __tablename__ = "used_copy_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    #: The listed title, never a used copy — used rows come and go.
    book_id = Column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    #: What they would pay up to. NULL means any price.
    max_price = Column(Numeric(10, 2), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    #: When the notice went out. Kept rather than deleted, so nobody is told twice
    #: about one shelving and the demand history survives being satisfied.
    notified_at = Column(DateTime(timezone=True), nullable=True)

    book = relationship("Book")

    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_used_alert_user_book"),
        Index("ix_used_alert_book", "book_id"),
    )


class SearchMiss(Base):
    """A search that returned nothing, counted.

    Every one of these used to be discarded, and each is a customer telling the
    shop what to stock in the clearest terms available — they came looking for it.

    Aggregated by term rather than a row per search: "what do people keep failing
    to find" is the question, and a row per keystroke answers it in a table that
    grows with traffic rather than with the catalogue.
    """

    __tablename__ = "search_misses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    #: Trimmed and lower-cased, so one term is one row.
    term = Column(String(120), nullable=False, unique=True)
    hits = Column(Integer, nullable=False, server_default=text("1"), default=1)

    first_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    #: Set once the shop has acted on it, so the list stays a to-do rather than
    #: an archive.
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_search_miss_hits", text("hits DESC")),)
