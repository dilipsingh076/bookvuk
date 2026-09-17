# app/schema/book.py

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator
from uuid import UUID
from datetime import datetime


class BookBase(BaseModel):
    title: str
    author: Optional[str] = None
    description: Optional[str] = None
    price: Decimal
    stock: int
    format: str
    category_id: UUID


class BookCreate(BookBase):
    pass


class BookResponse(BookBase):
    id: UUID
    book_id: Optional[str] = Field(None, alias="bookId")
    rating: float = 0.0
    rating_count: int = 0
    created_at: datetime
    catalog_id: Optional[str] = None
    # author lives in BookBase so it's available on create/update too
    cover_image: Optional[str] = Field(None, alias="coverImage")

    # "new" for a catalogue listing, otherwise the grade of a used copy. The client
    # needs it to label the option and to show the saving against new.
    condition: str = "new"
    # Set on a used copy: the catalogue title it is a copy of.
    parent_book_id: Optional[UUID] = None

    # The category *name*, sent with the book so a client does not have to fetch
    # the category list and join it itself — that was a second, serialized request
    # on every page showing a book.
    category: Optional[str] = None

    stock_status: Optional[str] = None

    # "Bestseller" only when the book has actually sold; see core/merchandising.py.
    # The client used to invent this from a hash of the id, badging a fifth of the
    # catalogue at random.
    badge: Optional[str] = None

    def model_post_init(self, __context):
        self.stock_status = "in stock" if self.stock > 0 else "out of stock"
        if not self.book_id:
            self.book_id = self.catalog_id or str(self.id)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class BookJsonRecord(BaseModel):

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    id: str = Field(..., min_length=1, max_length=64)
    book_id: Optional[str] = Field(None, alias="bookId", max_length=64)
    title: str = Field(..., min_length=1, max_length=500)
    author: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=120)
    rating: float = Field(..., ge=0, le=5)
    rating_count: int = Field(..., ge=0, alias="ratingCount")
    price: Decimal = Field(..., ge=Decimal("0"))
    book_format: str = Field(..., min_length=1, max_length=50, alias="format")
    stock_status: str = Field(..., min_length=1, max_length=64, alias="stockStatus")
    description: str = ""
    cover_image: Optional[str] = Field(None, alias="coverImage", max_length=500)
    language: Optional[str] = Field(None, max_length=8)
    title_search: Optional[str] = Field(None, alias="titleSearch", max_length=600)
    author_search: Optional[str] = Field(None, alias="authorSearch", max_length=600)

    @model_validator(mode="after")
    def align_book_id(self) -> BookJsonRecord:
        if not self.book_id:
            object.__setattr__(self, "book_id", self.id)
        return self

    def effective_catalog_id(self) -> str:
        """Stable key for deduplication (matches frontend book.id)."""
        return self.id
