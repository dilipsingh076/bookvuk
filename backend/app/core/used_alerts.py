"""Telling people a second-hand copy finally exists.

The used-book machine works and is nearly always empty: 2 of 200 titles have a
copy, so on almost every product page the used block correctly shows nothing and
the visitor leaves. That visitor is the most useful person in the shop — they
wanted a cheap copy of a specific book — and nothing recorded them.

This closes the loop in both directions. The alert tells the customer when a copy
appears, and the count of alerts tells the shop which titles are worth paying a
seller for.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import models

logger = logging.getLogger("bookvuk.used_alerts")


def waiting_for(db: Session, book_id) -> int:
    """How many people are waiting for a used copy of this title."""
    return (
        db.query(func.count(models.UsedCopyAlert.id))
        .filter(
            models.UsedCopyAlert.book_id == book_id,
            models.UsedCopyAlert.notified_at.is_(None),
        )
        .scalar()
        or 0
    )


def notify_for_used_copy(db: Session, used_copy) -> int:
    """Tell everyone waiting that a copy of this title is on the shelf.

    Does NOT commit — it joins the payout transaction, so "copy shelved but
    nobody told" is not a reachable state.

    Returns how many people were notified.

    `max_price` is honoured: somebody who said they would pay up to ₹200 is not
    told about a ₹400 copy, because that notice teaches them to ignore the next
    one.
    """
    parent_id = used_copy.parent_book_id
    if parent_id is None:
        return 0

    price = used_copy.price
    waiting = (
        db.query(models.UsedCopyAlert)
        .filter(
            models.UsedCopyAlert.book_id == parent_id,
            models.UsedCopyAlert.notified_at.is_(None),
        )
        .all()
    )

    now = datetime.now(timezone.utc)
    told = 0
    for alert in waiting:
        if alert.max_price is not None and price is not None and price > alert.max_price:
            # Still waiting, for a cheaper one.
            continue
        alert.notified_at = now
        db.add(
            models.Notification(
                user_id=alert.user_id,
                title="A used copy is available",
                body=(
                    f'"{used_copy.title}" is back as a second-hand copy at '
                    f"₹{price} — you asked to be told. Used stock is usually one "
                    "copy, so it may not last."
                ),
                is_read=False,
            )
        )
        told += 1

    if told:
        logger.info("used copy of %s shelved, told %d waiting", parent_id, told)
    return told
