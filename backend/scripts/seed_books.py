#!/usr/bin/env python3
"""
Load backend/data/books.json into the database.

Prerequisites:
  - PostgreSQL running and Alembic migrations applied (including catalog_id / author).

Run from the backend directory:

  cd backend
  source venv/bin/activate   # if you use a venv
  PYTHONPATH=. python scripts/seed_books.py

Optional:
  PYTHONPATH=. python scripts/seed_books.py --json-path ./data/books.json --update-existing

Duplicate handling: rows are keyed by JSON `id` (stored as books.catalog_id).
  - First run: inserts all.
  - Second run: skips existing catalog_id unless --update-existing.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy.orm import Session

# Run with PYTHONPATH=. from backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.db import SessionLocal  # noqa: E402
from app.database.models.book import Book  # noqa: E402
from app.database.models.category import Category  # noqa: E402
from app.schema.book import BookJsonRecord  # noqa: E402


def load_json_rows(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict) and "books" in raw:
        inner = raw["books"]
        if not isinstance(inner, list):
            raise ValueError('"books" must be an array')
        return inner
    raise ValueError("JSON must be a top-level array or an object with a 'books' array")


def stock_from_stock_status(status: str) -> int:
    s = (status or "").strip().lower()
    if "out" in s and "stock" in s:
        return 0
    if "low" in s:
        return 5
    return 50


def get_or_create_category(db: Session, name: str) -> Category:
    existing = db.query(Category).filter(Category.name == name).first()
    if existing:
        return existing
    cat = Category(name=name)
    db.add(cat)
    db.flush()
    return cat


def apply_record_to_book(
    book: Book,
    rec: BookJsonRecord,
    *,
    category_id,
) -> None:
    book.catalog_id = rec.effective_catalog_id()
    book.author = rec.author
    book.title = rec.title[:255]
    book.description = rec.description or None
    book.price = rec.price
    book.stock = stock_from_stock_status(rec.stock_status)
    book.format = rec.book_format[:50]
    book.rating = float(rec.rating)
    book.rating_count = rec.rating_count
    book.category_id = category_id


def run_seed(
    db: Session,
    rows: list[dict],
    *,
    update_existing: bool,
) -> tuple[int, int, int, list[str]]:
    inserted = 0
    skipped = 0
    updated = 0
    errors: list[str] = []

    category_cache: dict[str, Category] = {}

    for idx, raw in enumerate(rows):
        try:
            rec = BookJsonRecord.model_validate(raw)
        except ValidationError as e:
            errors.append(f"row {idx} (id={raw.get('id')!r}): {e}")
            continue

        cid = rec.effective_catalog_id()
        existing = db.query(Book).filter(Book.catalog_id == cid).first()

        cat_name = rec.category
        if cat_name not in category_cache:
            category_cache[cat_name] = get_or_create_category(db, cat_name)
        category = category_cache[cat_name]

        if existing:
            if update_existing:
                apply_record_to_book(
                    existing, rec, category_id=category.id
                )
                updated += 1
            else:
                skipped += 1
            continue

        book = Book()
        apply_record_to_book(book, rec, category_id=category.id)
        db.add(book)
        inserted += 1

    db.commit()
    return inserted, skipped, updated, errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed books from data/books.json")
    parser.add_argument(
        "--json-path",
        type=Path,
        default=BACKEND_ROOT / "data" / "books.json",
        help="Path to books JSON (default: backend/data/books.json)",
    )
    parser.add_argument(
        "--update-existing",
        action="store_true",
        help="Update rows that match catalog_id instead of skipping",
    )
    args = parser.parse_args()

    path = args.json_path.resolve()
    if not path.is_file():
        raise SystemExit(f"File not found: {path}")

    rows = load_json_rows(path)

    db = SessionLocal()
    try:
        inserted, skipped, updated, errors = run_seed(
            db, rows, update_existing=args.update_existing
        )
    finally:
        db.close()

    print(
        f"Done. inserted={inserted} skipped={skipped} updated={updated} "
        f"validation_errors={len(errors)}"
    )
    for line in errors[:20]:
        print(line, file=sys.stderr)
    if len(errors) > 20:
        print(f"... and {len(errors) - 20} more errors", file=sys.stderr)


if __name__ == "__main__":
    main()
