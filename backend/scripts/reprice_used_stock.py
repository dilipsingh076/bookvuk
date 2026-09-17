#!/usr/bin/env python3
"""Re-price used copies after a change to `RESALE_RATES`.

Changing the rates only affects copies bought *after* the change — everything
already on the shelf keeps the price it was listed at. That is the right default
(nobody wants a rate tweak silently rewriting the whole catalogue), but after a
deliberate change it leaves the shop selling the same condition at two prices.

Dry run by default:

  PYTHONPATH=. ./venv/bin/python scripts/reprice_used_stock.py
  PYTHONPATH=. ./venv/bin/python scripts/reprice_used_stock.py --apply

What a seller was *paid* is never touched. That was agreed at the time and is
recorded on the buyback request; re-pricing the shelf must not rewrite history.
"""

from __future__ import annotations

import argparse
import sys
from decimal import Decimal
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core import buyback as pricing  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.database.db import SessionLocal  # noqa: E402
from app.database.models.book import Book  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Re-price used stock to the current rates")
    parser.add_argument("--apply", action="store_true", help="write the new prices")
    args = parser.parse_args()

    print(f"database: {settings.safe_database_target}")
    print("rates:    " + ", ".join(
        f"{pricing.CONDITION_LABELS[c]} {int(pricing.RESALE_RATES[c] * 100)}%"
        for c in pricing.CONDITIONS
    ))
    print()

    session = SessionLocal()
    try:
        used = session.query(Book).filter(Book.condition != "new").all()
        changed = 0

        for copy in used:
            parent = (
                session.query(Book).filter(Book.id == copy.parent_book_id).first()
                if copy.parent_book_id
                else None
            )
            if parent is None or not parent.price:
                # No printed price to work from; leave it for a human.
                print(f"  SKIP  {copy.title[:30]:32} no parent price")
                continue

            want = pricing.resale_price(Decimal(str(parent.price)), copy.condition)
            have = Decimal(str(copy.price or 0))
            if want == have:
                continue

            direction = "up" if want > have else "down"
            print(f"  {copy.title[:30]:32} {copy.condition:9} {have:>8} -> {want:>8}  ({direction})")
            copy.price = want
            changed += 1

        if not changed:
            print("  nothing to change")
            return 0

        if not args.apply:
            session.rollback()
            print(f"\nDry run: {changed} copies would be re-priced. Re-run with --apply.")
            return 0

        session.commit()
        print(f"\nre-priced {changed} used copies")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
