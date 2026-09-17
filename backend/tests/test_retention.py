"""What the retention sweep removes, and — the part worth testing — what it keeps.

Deleting too much here is silent and unrecoverable: a failed job's `last_error` is
the only record of why something never ran, and an unread notification is the
badge a customer is waiting on. Each "keeps" test fails if the predicate is
loosened.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core import sweeps
from app.core.config import settings
from app.database.models.job import Job
from app.database.models.notification import Notification
from app.database.models.rate_limit import RateLimitCounter
from app.database.models.refresh_token import RefreshToken


NOW = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)


def _ancient(days: int) -> datetime:
    return NOW - timedelta(days=days)


@pytest.fixture
def user_id(make_customer):
    """A real user row. `refresh_tokens` and `notifications` both have a FK to
    `users`, so these cannot be invented."""
    return make_customer(with_address=False)["id"]


# --------------------------------------------------------------------------
# refresh_tokens
# --------------------------------------------------------------------------

def test_expired_tokens_are_removed(db_session, user_id):
    db_session.add(RefreshToken(
        jti=uuid.uuid4().hex, user_id=user_id, expires_at=_ancient(1)))
    db_session.commit()

    assert sweeps.sweep_expired_rows(db_session, now=NOW)["refresh_tokens"] == 1
    assert db_session.query(RefreshToken).count() == 0


def test_a_live_token_is_kept(db_session, user_id):
    db_session.add(RefreshToken(
        jti=uuid.uuid4().hex, user_id=user_id, expires_at=NOW + timedelta(days=20)))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert db_session.query(RefreshToken).count() == 1


def test_a_recently_revoked_token_keeps_its_grace_period(db_session, user_id):
    """Revoked yesterday, retention is 7 days: it stays, so "when did this
    session end" is still answerable."""
    db_session.add(RefreshToken(
        jti=uuid.uuid4().hex, user_id=user_id,
        expires_at=NOW + timedelta(days=20), revoked_at=_ancient(1)))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert db_session.query(RefreshToken).count() == 1


def test_a_long_revoked_token_is_removed(db_session, user_id):
    db_session.add(RefreshToken(
        jti=uuid.uuid4().hex, user_id=user_id,
        expires_at=NOW + timedelta(days=20),
        revoked_at=_ancient(settings.REFRESH_TOKEN_RETENTION_DAYS + 1)))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert db_session.query(RefreshToken).count() == 0


# --------------------------------------------------------------------------
# jobs
# --------------------------------------------------------------------------

def test_old_completed_jobs_are_removed(db_session):
    db_session.add(Job(kind="order_email", payload={},
                       completed_at=_ancient(settings.JOB_RETENTION_DAYS + 1)))
    db_session.commit()

    assert sweeps.sweep_expired_rows(db_session, now=NOW)["jobs"] == 1
    assert db_session.query(Job).count() == 0


def test_a_failed_job_is_never_removed(db_session):
    """The one that matters.

    A job that exhausted its retries is left with `last_error` set for
    inspection and `completed_at` NULL. Sweeping on age alone — rather than on
    `completed_at` — would delete exactly the rows somebody needs to read.
    """
    db_session.add(Job(
        kind="order_refund", payload={}, completed_at=None,
        attempts=5, max_attempts=5, last_error="gateway timeout",
        created_at=_ancient(365), run_at=_ancient(365)))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert db_session.query(Job).count() == 1


def test_a_pending_job_is_never_removed(db_session):
    db_session.add(Job(kind="order_email", payload={}, completed_at=None,
                       created_at=_ancient(365), run_at=_ancient(365)))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert db_session.query(Job).count() == 1


# --------------------------------------------------------------------------
# notifications
# --------------------------------------------------------------------------

def test_old_read_notifications_are_removed(db_session, user_id):
    db_session.add(Notification(
        user_id=user_id, title="Shipped", is_read=True,
        created_at=_ancient(settings.NOTIFICATION_RETENTION_DAYS + 1)))
    db_session.commit()

    assert sweeps.sweep_expired_rows(db_session, now=NOW)["notifications"] == 1
    assert db_session.query(Notification).count() == 0


def test_an_unread_notification_is_never_removed(db_session, user_id):
    """However old. The unread badge is the point of the table."""
    db_session.add(Notification(
        user_id=user_id, title="Shipped", is_read=False, created_at=_ancient(3650)))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert db_session.query(Notification).count() == 1


# --------------------------------------------------------------------------
# rate limit counters, batching, idempotence
# --------------------------------------------------------------------------

def test_closed_rate_limit_windows_are_removed(db_session):
    db_session.add(RateLimitCounter(
        name="login", client_key="1.2.3.4",
        window_start=_ancient(settings.RATE_LIMIT_RETENTION_DAYS + 1), hits=3))
    db_session.commit()

    assert sweeps.sweep_expired_rows(db_session, now=NOW)["rate_limit_counters"] == 1


def test_the_current_window_is_kept(db_session):
    db_session.add(RateLimitCounter(
        name="login", client_key="1.2.3.4", window_start=NOW, hits=3))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert db_session.query(RateLimitCounter).count() == 1


def test_a_pass_is_capped_so_it_cannot_lock_a_table_for_long(db_session, monkeypatch):
    monkeypatch.setattr(settings, "RETENTION_SWEEP_BATCH", 3)
    for _ in range(7):
        db_session.add(Job(kind="order_email", payload={},
                           completed_at=_ancient(settings.JOB_RETENTION_DAYS + 1)))
    db_session.commit()

    assert sweeps.sweep_expired_rows(db_session, now=NOW)["jobs"] == 3
    assert db_session.query(Job).count() == 4


def test_running_it_twice_is_a_no_op(db_session, user_id):
    db_session.add(RefreshToken(
        jti=uuid.uuid4().hex, user_id=user_id, expires_at=_ancient(1)))
    db_session.commit()

    sweeps.sweep_expired_rows(db_session, now=NOW)
    assert sweeps.sweep_expired_rows(db_session, now=NOW)["refresh_tokens"] == 0


def test_retention_can_be_disabled_per_table(db_session, user_id, monkeypatch):
    monkeypatch.setattr(settings, "REFRESH_TOKEN_RETENTION_DAYS", 0)
    db_session.add(RefreshToken(
        jti=uuid.uuid4().hex, user_id=user_id, expires_at=_ancient(1)))
    db_session.commit()

    result = sweeps.sweep_expired_rows(db_session, now=NOW)
    assert "refresh_tokens" not in result
    assert db_session.query(RefreshToken).count() == 1
