#!/usr/bin/env python3
"""Make `books.rating` / `rating_count` agree with the reviews behind them.

  PYTHONPATH=. ./venv/bin/python scripts/resync_book_ratings.py --dry-run
  PYTHONPATH=. ./venv/bin/python scripts/resync_book_ratings.py

The catalogue keeps the rating as an aggregate on the book so it can sort and
filter without joining, and `reviews.py` recomputes it whenever a review is
written or removed. That works — but only for books whose aggregate came from
reviews in the first place.

The seeded catalogue's did not. Every book carried an invented rating and count
(the 202 books summed to 321,323 ratings) while the `reviews` table held zero
rows, so a product page said "4.3 from 1,827 ratings" directly above "No reviews
yet — be the first". It was also a trap: the *first* real review triggers the
recompute, and 1,827 would have become 1 overnight.

This walks every book through the same recompute the API uses, so there is one
definition of what a book's rating means rather than two.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func  # noqa: E402

from app.api.routes.reviews import recompute_book_rating  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.database import models  # noqa: E402
from app.database.db import SessionLocal  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Resync book ratings with their reviews")
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would change without writing")
    args = parser.parse_args()

    print(f"database: {settings.safe_database_target}")
    session = SessionLocal()
    changed = unchanged = 0
    try:
        real = dict(
            session.query(models.Review.book_id, func.count(models.Review.id))
            .group_by(models.Review.book_id)
            .all()
        )
        books = session.query(models.Book).all()
        phantom = 0

        for book in books:
            before = (float(book.rating or 0), int(book.rating_count or 0))
            actual_reviews = real.get(book.id, 0)
            if before[1] > actual_reviews:
                phantom += before[1] - actual_reviews

            if args.dry_run:
                after = (0.0, 0) if actual_reviews == 0 else None
                if after is not None and before != after:
                    changed += 1
                else:
                    unchanged += 1
                continue

            recompute_book_rating(session, book.id)
            session.flush()
            after = (float(book.rating or 0), int(book.rating_count or 0))
            if before != after:
                changed += 1
            else:
                unchanged += 1

        if not args.dry_run:
            session.commit()
    finally:
        session.close()

    verb = "would change" if args.dry_run else "changed"
    print(f"{verb}: {changed}   already correct: {unchanged}")
    if phantom:
        print(f"ratings claimed with no review behind them: {phantom:,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
