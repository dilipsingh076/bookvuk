from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AdminDashboardOverviewCard(BaseModel):
    title: str
    value: str
    sub: str


class AdminAuthorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    bio: str = ""
    status: str = Field("active", max_length=32)  # active | draft


class AdminAuthorCreate(AdminAuthorBase):
    pass


class AdminAuthorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    bio: Optional[str] = None
    status: Optional[str] = Field(None, max_length=32)


class AdminAuthorRead(AdminAuthorBase):
    id: UUID
    created_at: datetime
    book_count: int = Field(0, alias="bookCount")

    model_config = ConfigDict(from_attributes=True)


class AdminInventoryRestockRequest(BaseModel):
    add_stock: int = Field(..., ge=0, alias="addStock")

    model_config = ConfigDict(populate_by_name=True)


class AdminOrderItemRead(BaseModel):
    id: UUID
    book_id: UUID = Field(..., alias="bookId")
    title_snapshot: str = Field(..., alias="title")
    unit_price_snapshot: Decimal = Field(..., alias="price")
    quantity: int = Field(..., ge=1, alias="qty")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AdminOrderRead(BaseModel):
    id: UUID
    created_at: datetime = Field(..., alias="createdAt")
    status: str
    user_id: UUID = Field(..., alias="userId")
    customer_name: str = Field(..., alias="customerName")
    customer_email: str = Field(..., alias="customerEmail")
    subtotal: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal
    items: List[AdminOrderItemRead]

    model_config = ConfigDict(populate_by_name=True)


class AdminOrderStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=32)

