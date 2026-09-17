"""Periodic scans with no request to hang off.

Two kinds of work live here, and both share a shape: nothing in a request/response
cycle would ever trigger them.

*Abandoned carts.* Every other job in this system is enqueued by the request that
made it necessary — an order was placed, a status changed. An abandoned cart has
no such moment: the whole point is that the customer *stopped* making requests.
So something has to look for the absence.

*Retention.* Rows the application has finished with. Nothing used to delete them,
and four tables grew without bound as a result: `refresh_tokens` held more rows
than `books` on a database with twenty users, and every completed job, read
notification and closed rate-limit window was kept forever.

Run from `scripts/worker.py` on a timer. Deliberately idempotent: running it twice
in the same window must not send two reminders, because the worker can restart at
any point and a duplicate nudge reads as spam.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from .config import settings
from .jobs import enqueue
from ..database import models
from ..database.models.job import Job
from ..database.models.notification import Notification
from ..database.models.rate_limit import RateLimitCounter
from ..database.models.refresh_token import RefreshToken

logger = logging.getLogger("bookvuk.sweeps")

# Wait this long after the last cart change before nudging. Short enough that the
# cart is still on their mind, long enough that it is not interrupting a checkout
# that is still in progress.
ABANDON_AFTER_HOURS = 4

# Past this, the cart is not abandoned, it is forgotten — a reminder about
# something from last month is just noise.
ABANDON_GIVE_UP_AFTER_HOURS = 48

# Never remind the same person more often than this, however many times they
# abandon a cart.
REMINDER_COOLDOWN_DAYS = 7


def find_abandoned_carts(db: Session, *, now: datetime | None = None) -> list[models.Cart]:
    """Carts last touched between 4 and 48 hours ago that were never checked out.

    "Last touched" is the newest `cart_items.updated_at`, which the cart routes
    already maintain — no new column is needed to know when someone stopped.
    """
    now = now or datetime.now(timezone.utc)
    quiet_since = now - timedelta(hours=ABANDON_AFTER_HOURS)
    too_old = now - timedelta(hours=ABANDON_GIVE_UP_AFTER_HOURS)

    last_touched = (
        select(
            models.CartItem.cart_id.label("cart_id"),
            func.max(models.CartItem.updated_at).label("touched_at"),
        )
        .group_by(models.CartItem.cart_id)
        .subquery()
    )

    return (
        db.query(models.Cart)
        .join(last_touched, last_touched.c.cart_id == models.Cart.id)
        .filter(
            last_touched.c.touched_at <= quiet_since,
            last_touched.c.touched_at > too_old,
        )
        .all()
    )


def _reminded_recently(db: Session, user_id, *, now: datetime) -> bool:
    """Has this user been nudged inside the cooldown?

    Answered from the `jobs` table rather than a new column: the job row is
    already the record that a reminder was created, and using it means the
    cooldown cannot disagree with what was actually sent.
    """
    since = now - timedelta(days=REMINDER_COOLDOWN_DAYS)
    return (
        db.query(Job.id)
        .filter(
            Job.kind == "abandoned_cart_email",
            Job.payload["user_id"].astext == str(user_id),
            Job.created_at >= since,
        )
        .first()
        is not None
    )


def sweep_abandoned_carts(db: Session, *, now: datetime | None = None) -> int:
    """Enqueue one reminder per newly abandoned cart. Returns how many."""
    now = now or datetime.now(timezone.utc)
    queued = 0

    for cart in find_abandoned_carts(db, now=now):
        if _reminded_recently(db, cart.user_id, now=now):
            continue
        enqueue(db, "abandoned_cart_email", {"user_id": str(cart.user_id)})
        queued += 1

    if queued:
        db.commit()
        logger.info("queued %d abandoned cart reminders", queued)
    return queued


# --------------------------------------------------------------------------
# Retention
# --------------------------------------------------------------------------
#
# What each table keeps, and — more importantly — what it must not drop:
#
# * `refresh_tokens` — expired or revoked. Deleting one is safe because
#   `/auth/refresh` refuses revoked, expired *and unknown* ids alike, so a
#   deleted row is rejected exactly as a revoked row is.
# * `jobs` — **completed only.** A job that exhausted its retries has
#   `completed_at` NULL with `last_error` set; sweeping on `completed_at` skips
#   it for free, which is what keeps the evidence of a failure around.
# * `notifications` — **read only.** An unread notification stays however old it
#   is; the unread badge is the entire point of the table.
# * `rate_limit_counters` — windows that have closed and can never be consulted
#   again. The memory backend already prunes itself (`ratelimit.py`); the
#   database backend, which is what a multi-worker deployment runs, did not.
#
# Deletes are capped per pass. This runs inside the API process when
# `RUN_WORKER_IN_PROCESS` is on, so an unbounded DELETE would hold locks for as
# long as it took with requests queued behind it. A backlog is cleared over
# several passes instead of one long one.


def _delete_batch(db: Session, model, condition, limit: int) -> int:
    """Delete up to `limit` rows matching `condition`. Returns how many.

    Expressed as "select the ids, then delete those ids" because `DELETE ...
    LIMIT` is not valid PostgreSQL — the limit has to be applied by a subquery.
    """
    ids = [row[0] for row in db.query(model.id).filter(condition).limit(limit).all()]
    if not ids:
        return 0
    db.query(model).filter(model.id.in_(ids)).delete(synchronize_session=False)
    return len(ids)


def sweep_expired_rows(db: Session, *, now: datetime | None = None) -> dict[str, int]:
    """Remove rows past their retention window. Returns a count per table.

    Idempotent: a second run finds nothing left to do, which matters because the
    worker can restart at any point.
    """
    now = now or datetime.now(timezone.utc)
    batch = settings.RETENTION_SWEEP_BATCH
    removed: dict[str, int] = {}

    def cutoff(days: int) -> datetime | None:
        """`None` when retention is disabled, so the caller can skip the table."""
        return now - timedelta(days=days) if days > 0 else None

    # Expired tokens go once they expire; revoked ones keep a grace period so
    # "when did this session end" stays answerable for a little while.
    if (since := cutoff(settings.REFRESH_TOKEN_RETENTION_DAYS)) is not None:
        removed["refresh_tokens"] = _delete_batch(
            db,
            RefreshToken,
            or_(
                RefreshToken.expires_at < now,
                and_(RefreshToken.revoked_at.isnot(None), RefreshToken.revoked_at < since),
            ),
            batch,
        )

    if (since := cutoff(settings.JOB_RETENTION_DAYS)) is not None:
        removed["jobs"] = _delete_batch(
            db, Job, and_(Job.completed_at.isnot(None), Job.completed_at < since), batch
        )

    if (since := cutoff(settings.NOTIFICATION_RETENTION_DAYS)) is not None:
        removed["notifications"] = _delete_batch(
            db, Notification, and_(Notification.is_read.is_(True), Notification.created_at < since), batch
        )

    if (since := cutoff(settings.RATE_LIMIT_RETENTION_DAYS)) is not None:
        removed["rate_limit_counters"] = _delete_batch(
            db, RateLimitCounter, RateLimitCounter.window_start < since, batch
        )

    total = sum(removed.values())
    if total:
        db.commit()
        logger.info("retention sweep removed %d rows", total, extra=removed)
    else:
        # Nothing was written, but the session read — release it cleanly.
        db.rollback()

    return removed


def sweep_expired_quotes(db: Session, *, now: datetime | None = None) -> int:
    """Close buyback offers whose validity window has passed.

    `quoted_amount` is snapshotted so a later rate change cannot move an offer
    somebody accepted — which is right, and which is exactly why an offer has to
    end. Without this a book posted six months after the quote still has to be
    bought at a price that may no longer make sense.

    Only `submitted` requests lapse. Once the shop has approved one it has told
    the seller to post the book, and expiring it underneath them after they have
    paid for postage would be the shop breaking its own word.

    The seller is told. A request that silently changed state is worse than one
    that expired, because the first thing they know about it is the rejection.
    """
    at = now or datetime.now(timezone.utc)

    due = (
        db.query(models.BuybackRequest)
        .filter(
            models.BuybackRequest.status == "submitted",
            models.BuybackRequest.quote_expires_at.isnot(None),
            models.BuybackRequest.quote_expires_at < at,
        )
        .limit(settings.RETENTION_SWEEP_BATCH)
        .all()
    )
    if not due:
        db.rollback()
        return 0

    for request in due:
        request.status = "expired"
        request.closed_at = at
        db.add(
            models.Notification(
                user_id=request.user_id,
                title="Buyback offer expired",
                body=f'Our offer for "{request.title}" has expired. '
                     "Ask for a fresh quote whenever you are ready — prices may have changed.",
                is_read=False,
            )
        )

    db.commit()
    logger.info("expired %d buyback quotes", len(due))
    return len(due)


def run_due_sweeps(db: Session, *, now: datetime | None = None) -> dict[str, int]:
    """Every periodic scan, in one call for the worker to make."""
    counts = {"abandoned_carts": sweep_abandoned_carts(db, now=now)}
    counts["expired_quotes"] = sweep_expired_quotes(db, now=now)
    counts.update(sweep_expired_rows(db, now=now))
    return counts
