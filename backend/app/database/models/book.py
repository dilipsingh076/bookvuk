import uuid
from sqlalchemy.orm import relationship
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, Numeric, text, UUID
from ..base import Base

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