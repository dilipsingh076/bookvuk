import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, text
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
    total = Column(Numeric(12, 2), nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")



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