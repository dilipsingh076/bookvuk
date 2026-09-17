"""Which books genuinely deserve a badge.

The catalogue used to decide this in the browser:

    const maybeBadge = (id) => hash(id) % 5 === 0 ? "Bestseller" : null

which put a "Bestseller" ribbon on roughly a fifth of the shop at random —
measured at 14 of 50 books, including titles with fewer ratings than unbadged
ones. It is a claim made to a paying customer, so it has to be earned.

A badge here is computed from what actually happened: units sold from
`order_items`, excluding cancelled orders. If nothing qualifies, nothing is
badged. An empty shelf of ribbons is the correct output for a shop that has not
sold anything yet.

Recomputed at most once every `CACHE_TTL_SECONDS`, because it is the same answer
for every visitor and every book card on the page would otherwise trigger it.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from .order_status import ORDER_STATUS_CANCELLED
from ..database import models

logger = logging.getLogger("bookvuk.merchandising")

# Only recent sales count — a book that sold well two years ago is not what a
# shopper means by "bestseller".
WINDOW_DAYS = 90

# How many titles may carry the badge. A "bestseller" list of 80 books is not a
# recommendation, it is the catalogue.
MAX_BESTSELLERS = 12

# Below this, a badge would be noise rather than a signal: with one or two sales
# the ranking is chance.
MIN_UNITS = 3

CACHE_TTL_SECONDS = 300

_cache: dict[str, object] = {"at": 0.0, "ids": frozenset()}


def _compute_bestseller_ids(db: Session, *, now: Optional[datetime] = None) -> frozenset[UUID]:
    """Book ids in the top `MAX_BESTSELLERS` by units sold in the window."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=WINDOW_DAYS)

    rows = (
        db.query(
            models.OrderItem.book_id,
            func.sum(models.OrderItem.quantity).label("units"),
        )
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .filter(
            models.Order.created_at >= since,
            # Cancelled orders returned their stock and their money; counting them
            # would be the same overstatement the sales-trend report avoids.
            models.Order.status != ORDER_STATUS_CANCELLED,
        )
        .group_by(models.OrderItem.book_id)
        .having(func.sum(models.OrderItem.quantity) >= MIN_UNITS)
        .order_by(func.sum(models.OrderItem.quantity).desc())
        .limit(MAX_BESTSELLERS)
        .all()
    )
    return frozenset(row.book_id for row in rows)


def bestseller_ids(db: Session, *, force: bool = False) -> frozenset[UUID]:
    """Cached set of genuine bestsellers.

    `force` skips the cache; used by tests, which would otherwise see a set
    computed before they created their orders.
    """
    now = time.monotonic()
    if not force and now - float(_cache["at"]) < CACHE_TTL_SECONDS:
        return _cache["ids"]  # type: ignore[return-value]

    ids = _compute_bestseller_ids(db)
    _cache["at"] = now
    _cache["ids"] = ids
    logger.debug("recomputed bestsellers", extra={"count": len(ids)})
    return ids


def reset_cache() -> None:
    """Drop the cached set. Called between tests, and after a bulk import."""
    _cache["at"] = 0.0
    _cache["ids"] = frozenset()


def trending_book_ids(db: Session, *, days: int = 7, limit: int = 8) -> list[UUID]:
    """Book ids ordered by units sold in the last `days`, most sold first.

    Separate from `bestseller_ids` because the questions differ: a bestseller is a
    book that reliably sells, while "trending this week" is about the last few days
    and is expected to churn. Not cached for the same reason — a short window that
    lags five minutes behind is not describing this week.

    Returns fewer than `limit` ids, or none at all, when not enough has sold. The
    caller decides what to show instead; it must not call that result trending.
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    rows = (
        db.query(
            models.OrderItem.book_id,
            func.sum(models.OrderItem.quantity).label("units"),
        )
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .filter(
            models.Order.created_at >= since,
            models.Order.status != ORDER_STATUS_CANCELLED,
        )
        .group_by(models.OrderItem.book_id)
        .order_by(func.sum(models.OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return [row.book_id for row in rows]


def annotate_badges(books, bestsellers: frozenset[UUID]) -> None:
    """Attach `badge` to each book so the schema can serialise it.

    Set on the ORM instances rather than returned separately, so every route that
    already returns `BookResponse` gains the field without changing its shape.
    """
    for book in books:
        book.badge = "Bestseller" if book.id in bestsellers else None


def spread_by_category(books: list, limit: int) -> list:
    """Pick `limit` books, taking the best from each category in turn.

    The shopfront shelf falls back to "highest rated" when too little has sold to
    call anything trending. Ordering that purely by rating produced a monoculture:
    Hindi Literature holds half the catalogue and all of it is rated 5.0, so it
    took seven of eight slots and a first-time visitor met a shop that appeared to
    stock one subject. The rating told them nothing either — every card read 5.0.

    Round-robin instead: best-rated Business, best-rated Fiction, best-rated Hindi
    Literature, and around again. The input order is preserved *within* each
    category, so "best" still means what the caller sorted by; only the interleave
    is new. Categories that run out are simply skipped, so a thin catalogue still
    fills the shelf rather than leaving gaps.
    """
    by_category: dict = {}
    for book in books:
        by_category.setdefault(book.category_id, []).append(book)

    # Largest categories first, so the shelf leans towards what the shop actually
    # stocks rather than towards whichever category happens to sort first.
    queues = sorted(by_category.values(), key=len, reverse=True)

    picked: list = []
    while len(picked) < limit and any(queues):
        for queue in queues:
            if not queue:
                continue
            picked.append(queue.pop(0))
            if len(picked) == limit:
                break
    return picked
