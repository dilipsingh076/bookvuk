#!/usr/bin/env python3
"""
Load backend/data/authors.json into the database.

Prerequisites:
  - PostgreSQL running and Alembic migrations applied.

Run from the backend directory:

  cd backend
  source venv/bin/activate
  PYTHONPATH=. python scripts/authorseed.py

Optional:
  PYTHONPATH=. python scripts/authorseed.py --json-path ./data/authors.json --update-existing

Duplicate handling: rows are keyed by authors.name (unique).
  - First run: inserts all.
  - Second run: skips existing names unless --update-existing.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy.orm import Session

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database.db import SessionLocal       # noqa: E402
from app.database.models.author import Author  # noqa: E402


def load_json_rows(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict) and "authors" in raw:
        inner = raw["authors"]
        if not isinstance(inner, list):
            raise ValueError('"authors" must be an array')
        return inner
    raise ValueError(
        "JSON must be a top-level array or an object with an 'authors' array"
    )


def apply_record_to_author(author: Author, row: dict) -> None:
    author.name = row["name"][:255]
    author.bio = row.get("bio", "")
    author.status = row.get("status", "active")


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

    for idx, row in enumerate(rows):
        name = row.get("name", "").strip()

        if not name:
            errors.append(f"row {idx}: missing or empty 'name', skipping")
            continue

        try:
            existing = db.query(Author).filter(Author.name == name).first()

            if existing:
                if update_existing:
                    apply_record_to_author(existing, row)
                    updated += 1
                else:
                    skipped += 1
                continue

            author = Author()
            apply_record_to_author(author, row)
            db.add(author)
            inserted += 1

        except Exception as e:
            errors.append(f"row {idx} (name={name!r}): {e}")

    db.commit()
    return inserted, skipped, updated, errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed authors from data/authors.json")
    parser.add_argument(
        "--json-path",
        type=Path,
        default=BACKEND_ROOT / "data" / "authors.json",
        help="Path to authors JSON (default: backend/data/authors.json)",
    )
    parser.add_argument(
        "--update-existing",
        action="store_true",
        help="Update rows that match name instead of skipping",
    )
    args = parser.parse_args()

    path = args.json_path.resolve()
    if not path.is_file():
        raise SystemExit(f"File not found: {path}")

    rows = load_json_rows(path)

    db: Session = SessionLocal()
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