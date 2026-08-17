from __future__ import annotations

from math import ceil
from typing import List

from pydantic import BaseModel, ConfigDict, Field

from app.schema.book import BookResponse


class PageMeta(BaseModel):
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    total: int = Field(..., ge=0)
    pages: int = Field(..., ge=0)

    model_config = ConfigDict(populate_by_name=True)

    @staticmethod
    def from_total(*, page: int, page_size: int, total: int) -> "PageMeta":
        return PageMeta(
            page=page,
            page_size=page_size,
            total=total,
            pages=0 if total == 0 else int(ceil(total / page_size)),
        )


class PaginatedBooks(BaseModel):
    items: List[BookResponse]
    meta: PageMeta

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

