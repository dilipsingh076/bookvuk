from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from ..base import Base
import uuid

class Category(Base):
    __tablename__ = "categories"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)