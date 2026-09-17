# app/schema/wishlist.py
from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel

from app.schema.book import BookResponse


class WishlistToggleRequest(BaseModel):
    book_id: UUID


class WishlistBookItem(BaseModel):
    id: UUID                
    book: BookResponse
    created_at: datetime

    class Config:
        from_attributes = True


class WishlistResponse(BaseModel):
    items: List[WishlistBookItem] = []

    class Config:
        from_attributes = True