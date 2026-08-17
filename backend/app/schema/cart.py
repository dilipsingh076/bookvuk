from decimal import Decimal
from typing import List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

class CartItemBase(BaseModel):
    book_id: UUID
    quantity: int = Field(..., ge=1)


class CartItemCreate(CartItemBase):
    pass


class CartItemRead(CartItemBase):
    id: UUID
    cart_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class CartBase(BaseModel):
    user_id: UUID


class CartCreate(CartBase):
    pass


class CartRead(CartBase):
    id: UUID
    items: List[CartItemRead] = []

    class Config:
        orm_mode = True