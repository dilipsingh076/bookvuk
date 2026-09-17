import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..base import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    status = Column(String(32), nullable=False, default="processing")
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    shipping = Column(Numeric(12, 2), nullable=False, default=0)
    tax = Column(Numeric(12, 2), nullable=False, default=0)
    discount = Column(Numeric(12, 2), nullable=False, server_default=text("0"), default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    # Coupon captured as a snapshot: the code may later be edited or deleted, but
    # what this order was actually charged must not change.
    coupon_code = Column(String(32), nullable=True)

    # Delivery address, stored per order rather than only on the user, so editing
    # a profile never rewrites where past orders were shipped.
    ship_full_name = Column(String(255), nullable=True)
    ship_phone = Column(String(32), nullable=True)
    ship_line1 = Column(String(255), nullable=True)
    ship_line2 = Column(String(255), nullable=True)
    ship_city = Column(String(120), nullable=True)
    ship_state = Column(String(120), nullable=True)
    ship_postal_code = Column(String(20), nullable=True)
    ship_country = Column(String(2), nullable=True)

    # Payment: "pending" until a gateway confirms, then "paid" / "failed", and
    # after a cancellation of a paid order "refunded" — or "refund_pending" when
    # the money has to be returned by hand because no gateway is configured.
    # How the customer chose to pay. Fixed at checkout; never changes afterwards.
    # Separate from `payment_status` on purpose: a collected COD order is *paid*,
    # exactly like a card order, and only the route the money took differs.
    # See `core/payment.py`.
    payment_method = Column(
        String(20), nullable=False, server_default=text("'online'"), default="online"
    )
    payment_status = Column(String(20), nullable=False, server_default=text("'pending'"), default="pending")
    payment_provider = Column(String(32), nullable=True)
    # Which set of gateway keys took this money: "test" or "live".
    #
    # Only meaningful with one database serving both, which is the normal state
    # before launch. Without it a test payment and a real one are the same row,
    # and every report that sums `total` where `payment_status = 'paid'` counts
    # play money as revenue. NULL for orders with no gateway involved — cash on
    # delivery, or anything placed while payments were unconfigured.
    payment_mode = Column(String(8), nullable=True, index=True)
    payment_order_id = Column(String(128), nullable=True, index=True)
    payment_reference = Column(String(128), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Store credit applied to this order. A tender, not a discount: `total` stays
    # the true value of the goods, and what the gateway is asked to charge is
    # `total - wallet_credit_used`. Recording it as a discount would understate what
    # the order was worth in every report that reads `total`.
    wallet_credit_used = Column(Numeric(12, 2), nullable=False, server_default=text("0"))

    # Recorded separately from the payment fields so a refunded order still shows
    # what was originally charged; support questions are almost always about the
    # difference between the two.
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    refund_reference = Column(String(128), nullable=True)
    refund_amount = Column(Numeric(12, 2), nullable=True)

    # Which parcel it went in. `status = shipped` said that something had left,
    # and nothing at all about what to chase — so the shipped e-mail could not
    # carry a consignment number and every "where is my order" landed on a person.
    #
    # The carrier is a slug from `core/shipping.py`, not free text, because the
    # tracking URL is derived from it rather than stored: a stored link is a
    # second copy of the same fact, and it rots on every historic order the day a
    # courier changes its tracking path.
    tracking_carrier = Column(String(32), nullable=True)
    tracking_number = Column(String(64), nullable=True)

    # When each stage happened. `status` alone answers "where is my order"; the
    # customer's timeline also asks "since when", and it was rendering a permanent
    # dash because these did not exist.
    packed_at = Column(DateTime(timezone=True), nullable=True)
    shipped_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        # "My orders", newest first — the shape of every customer order query.
        # ix_orders_user_id alone leaves the sort to be done after the fetch.
        Index("ix_orders_user_created", "user_id", text("created_at DESC")),
        # Finding an order from a consignment number somebody has quoted. Partial
        # because only shipped orders have one.
        Index(
            "ix_orders_tracking_number",
            "tracking_number",
            postgresql_where=text("tracking_number IS NOT NULL"),
        ),
    )



class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="RESTRICT"), nullable=False, index=True)

    title_snapshot = Column(String(255), nullable=False)
    unit_price_snapshot = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Integer, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)

    order = relationship("Order", back_populates="items")
    book = relationship("Book")