import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..base import Base

# submitted -> approved -> received -> paid, with rejected/cancelled as exits.
#
# `received` is deliberately its own state rather than folded into `paid`: the
# condition the seller claimed and the condition that arrives are often different,
# and the shop must be able to re-grade and re-quote before any money moves.
BUYBACK_STATUSES = (
    "submitted",   # seller has sent it in, nobody has looked yet
    "approved",    # shop wants it; seller can send the book
    "received",    # book is here and has been graded
    "paid",        # seller has their money, copy is on the shelf
    "rejected",    # shop does not want it, or it arrived unsellable
    "cancelled",   # seller withdrew
    "expired",     # the offer's validity window passed before it was sent
)

# Nothing can move on from these. `expired` joins them: a quote that lapsed is
# closed, and re-opening it would revive a price the shop no longer stands behind.
BUYBACK_TERMINAL_STATUSES = ("paid", "rejected", "cancelled", "expired")

#: What a seller's photograph is showing. Three because they are the three things
#: that actually decide a grade — anything else is a picture of the same book
#: again. Not a database constraint: adding a fourth should be a deploy, not a
#: migration that has to rewrite history.
BUYBACK_PHOTO_KINDS = ("cover", "spine", "damage", "other")

#: The most photographs one request may carry. A ceiling rather than a limit on
#: taste: each is a file the shop stores forever, and past four they stop adding
#: information about the grade.
MAX_BUYBACK_PHOTOS = 4


class BuybackRequest(Base):
    """A customer offering the shop their used book.

    Both kinds of submission live here. When the title is already stocked,
    `book_id` points at it and the printed price comes from the catalogue. When it
    is not, the seller types the title, author and the MRP from the cover — that is
    the only price basis available, which is why an admin re-checks it against the
    physical book before paying.

    Money fields are snapshots. `quoted_amount` is fixed when the request is made so
    that changing the rates later cannot alter an offer somebody has already
    accepted; `final_amount` is what was actually paid after grading.
    """

    __tablename__ = "buyback_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Set when the seller picked a catalogue title. Null for a manual entry, until
    # an admin resolves it to a catalogue book on receipt.
    book_id = Column(
        UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="SET NULL", name="fk_buyback_book"),
        nullable=True,
        # Indexed: PostgreSQL scans this column on every parent DELETE.
        index=True,
    )

    # Always filled, catalogue or not: the request has to stay readable even if the
    # catalogue row is later edited or removed.
    title = Column(String(255), nullable=False)
    author = Column(String(255), nullable=True)
    isbn = Column(String(20), nullable=True, index=True)

    # The printed price the quote was calculated from.
    listed_price = Column(Numeric(10, 2), nullable=False)

    condition = Column(String(20), nullable=False)
    quantity = Column(Integer, nullable=False, server_default=text("1"))

    status = Column(String(20), nullable=False, server_default=text("'submitted'"), index=True)

    quoted_amount = Column(Numeric(12, 2), nullable=False)
    # Differs from `quoted_amount` when the book graded differently than claimed.
    final_amount = Column(Numeric(12, 2), nullable=True)
    # The grade the shop gave it, which may not be the one the seller chose.
    received_condition = Column(String(20), nullable=True)

    # wallet | bank — chosen by the seller, recorded here so a payout cannot be
    # made by one route and reported as the other.
    payout_method = Column(String(16), nullable=True)
    # UTR for a transfer, or the wallet transaction id for store credit.
    payout_reference = Column(String(128), nullable=True)

    # Where a bank payout should go. Only collected when that method is chosen.
    payout_upi = Column(String(128), nullable=True)
    payout_account_name = Column(String(128), nullable=True)

    # How the seller posted it. `approved_at` and `received_at` had nothing
    # between them, so "awaiting arrival" could not tell "sent, in transit" from
    # "approved, never posted" — and neither side could find out which.
    #
    # The carrier is a slug from `core/shipping.py`, the same registry outbound
    # orders use; the tracking URL is derived from it rather than stored.
    seller_tracking_carrier = Column(String(32), nullable=True)
    seller_tracking_number = Column(String(64), nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)

    # When this offer stops standing. NULL means it never expires, which is what
    # every request predating the column has: quietly lapsing somebody's existing
    # offer would be the worst possible way to introduce the idea.
    quote_expires_at = Column(DateTime(timezone=True), nullable=True)

    seller_note = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)
    # Shown to the seller, so it has to be a reason rather than a code.
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    book = relationship("Book", foreign_keys=[book_id])
    photos = relationship(
        "BuybackPhoto",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="BuybackPhoto.position",
    )

    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_buyback_quantity_positive"),
        CheckConstraint("listed_price > 0", name="ck_buyback_listed_price_positive"),
        # The admin queue is "oldest unhandled first", filtered by status.
        Index("ix_buyback_status_created", "status", "created_at"),
        # "My sell requests", newest first.
        Index("ix_buyback_user_created", "user_id", text("created_at DESC")),
        # The expiry sweep: which live requests have passed their date.
        Index(
            "ix_buyback_quote_expiry",
            "quote_expires_at",
            postgresql_where=text("quote_expires_at IS NOT NULL"),
        ),
    )


class BuybackPhoto(Base):
    """One photograph of a book somebody is offering the shop.

    The reason grading works at all. Without these an admin approved a request
    having never seen the book, re-graded it on arrival, and the payout changed —
    which is the complaint sellers actually make.

    They earn their keep a second time on the shelf: a used copy used to inherit
    its parent title's publisher artwork, so a buyer was shown a pristine stock
    image of a second-hand book.
    """

    __tablename__ = "buyback_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("buyback_requests.id", ondelete="CASCADE"),
        nullable=False,
    )

    #: Absolute public URL, as `books.cover_image` holds it.
    url = Column(String(500), nullable=False)
    #: What it shows — see `BUYBACK_PHOTO_KINDS`. Three labelled photographs are
    #: usable at a glance; three unlabelled ones are three pictures of a book.
    kind = Column(String(16), nullable=False, server_default=text("'other'"), default="other")
    position = Column(Integer, nullable=False, server_default=text("0"), default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    request = relationship("BuybackRequest", back_populates="photos")

    __table_args__ = (
        Index("ix_buyback_photos_request", "request_id", "position"),
    )
