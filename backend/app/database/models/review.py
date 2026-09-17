# app/database/models/review.py
import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base


class Review(Base):
    """A customer's rating and comment for a book.

    `books.rating` / `books.rating_count` are kept as the aggregate so the
    catalogue can sort and filter without joining; they are recomputed from these
    rows whenever a review is written or removed.
    """

    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    book_id = Column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    rating = Column(Integer, nullable=False)
    title = Column(String(120), nullable=True)
    body = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    book = relationship("Book")
    user = relationship("User")

    __table_args__ = (
        # One review per customer per book; posting again edits the existing one.
        UniqueConstraint("book_id", "user_id", name="uq_review_book_user"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
    )
