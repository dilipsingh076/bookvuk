from datetime import datetime
from decimal import Decimal
from typing import List
from uuid import UUID
from pydantic import BaseModel, Field


class OrderItemRead(BaseModel):
    id: UUID
    book_id: UUID
    title_snapshot: str
    unit_price_snapshot: Decimal
    quantity: int = Field(..., ge=1)

    class Config:
        orm_mode = True


class OrderRead(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    subtotal: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal
    created_at: datetime
    items: List[OrderItemRead] = []

    class Config:
        orm_mode = True

