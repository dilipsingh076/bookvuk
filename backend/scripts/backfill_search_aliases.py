#!/usr/bin/env python3
"""Populate `books.search_aliases` for rows that predate the column.

New and edited books get their aliases from a mapper event, so this only needs
running once after the migration (and after a bulk import that bypassed the ORM).

  PYTHONPATH=. ./venv/bin/python scripts/backfill_search_aliases.py
  PYTHONPATH=. ./venv/bin/python scripts/backfill_search_aliases.py --dry-run

Only rows containing Devanagari are touched: a Latin title romanises to nothing,
and writing an empty string to every English book would rewrite the whole table
and its generated search vector for no gain.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings  # noqa: E402
from app.core.transliterate import has_devanagari, search_aliases  # noqa: E402
from app.database.db import SessionLocal  # noqa: E402
from app.database.models.book import Book  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill romanised search aliases")
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would change without writing")
    parser.add_argument("--limit", type=int, default=0,
                        help="stop after this many rows (0 = all)")
    args = parser.parse_args()

    print(f"database: {settings.safe_database_target}")

    session = SessionLocal()
    updated = skipped = 0
    try:
        books = session.query(Book).order_by(Book.created_at).all()
        for book in books:
            if not has_devanagari(f"{book.title or ''} {book.author or ''}"):
                skipped += 1
                continue

            aliases = search_aliases(book.title or "", book.author or "") or None
            if aliases == book.search_aliases:
                skipped += 1
                continue

            if updated < 8:
                print(f"  {(book.title or '')[:34]:36} -> {aliases}")
            book.search_aliases = aliases
            updated += 1
            if args.limit and updated >= args.limit:
                break

        if args.dry_run:
            session.rollback()
            print(f"\ndry run: {updated} would change, {skipped} unchanged")
            return 0

        session.commit()
        print(f"\nupdated {updated} books, left {skipped} unchanged")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
