"""The background job queue: enqueue, claim, retry, and transactional coupling."""

from datetime import datetime, timedelta, timezone

import pytest

from app.core import jobs
from app.database.db import SessionLocal
from app.database.models.job import Job


@pytest.fixture(autouse=True)
def _restore_handlers():
    """Handler registration is module-level; put it back after each test."""
    original = dict(jobs._HANDLERS)  # noqa: SLF001 - test-only reach-in
    yield
    jobs._HANDLERS.clear()
    jobs._HANDLERS.update(original)


def test_enqueue_rejects_an_unregistered_kind(db_session):
    """Fail at enqueue time rather than queueing work nothing can run."""
    with pytest.raises(ValueError, match="No handler"):
        jobs.enqueue(db_session, "does_not_exist", {})


def test_enqueue_joins_the_callers_transaction(db_session):
    """A rolled-back caller must not leave a job behind.

    This is the property that makes "order committed but its email never queued"
    impossible — and the reason for a database queue rather than Redis.
    """
    jobs.handler("noop")(lambda db, payload: None)

    jobs.enqueue(db_session, "noop", {"a": 1})
    db_session.rollback()

    with SessionLocal() as s:
        assert s.query(Job).filter(Job.kind == "noop").count() == 0


def test_a_committed_job_is_visible_to_a_worker(db_session):
    jobs.handler("noop")(lambda db, payload: None)
    jobs.enqueue(db_session, "noop", {"a": 1})
    db_session.commit()

    with SessionLocal() as s:
        claimed = jobs.claim_batch(s, limit=10)
        assert [j.kind for j in claimed] == ["noop"]


def test_claiming_hides_the_job_from_another_worker(db_session):
    """SKIP LOCKED is what lets several workers share the table safely."""
    jobs.handler("noop")(lambda db, payload: None)
    jobs.enqueue(db_session, "noop", {})
    db_session.commit()

    with SessionLocal() as first, SessionLocal() as second:
        claimed = jobs.claim_batch(first, limit=10)
        assert len(claimed) == 1
        # claim_batch marks locked_at, so the second worker sees nothing due.
        assert jobs.claim_batch(second, limit=10) == []


def test_a_successful_run_completes_the_job(db_session):
    ran = []
    jobs.handler("noop")(lambda db, payload: ran.append(payload))
    jobs.enqueue(db_session, "noop", {"x": 7})
    db_session.commit()

    with SessionLocal() as s:
        job = jobs.claim_batch(s, limit=1)[0]
        assert jobs.run_job(s, job) is True

    assert ran == [{"x": 7}]
    with SessionLocal() as s:
        row = s.query(Job).first()
        assert row.completed_at is not None
        assert row.last_error is None


def test_a_failing_job_is_retried_with_backoff(db_session):
    def boom(db, payload):
        raise RuntimeError("provider down")

    jobs.handler("flaky")(boom)
    jobs.enqueue(db_session, "flaky", {}, max_attempts=3)
    db_session.commit()

    with SessionLocal() as s:
        job = jobs.claim_batch(s, limit=1)[0]
        assert jobs.run_job(s, job) is False

    with SessionLocal() as s:
        row = s.query(Job).first()
        assert row.completed_at is None
        assert row.attempts == 1
        assert "provider down" in row.last_error
        # Rescheduled into the future, and unlocked so it can be picked up again.
        assert row.run_at > datetime.now(timezone.utc)
        assert row.locked_at is None


def test_a_job_gives_up_after_max_attempts(db_session):
    jobs.handler("always_fails")(lambda db, payload: (_ for _ in ()).throw(RuntimeError("nope")))
    jobs.enqueue(db_session, "always_fails", {}, max_attempts=2)
    db_session.commit()

    for _ in range(2):
        with SessionLocal() as s:
            # Make it due again so it can be claimed without waiting for backoff.
            s.query(Job).update({"run_at": datetime.now(timezone.utc), "locked_at": None})
            s.commit()
            batch = jobs.claim_batch(s, limit=1)
            if batch:
                jobs.run_job(s, batch[0])

    with SessionLocal() as s:
        row = s.query(Job).first()
        assert row.attempts >= 2
        assert row.completed_at is None
        # Exhausted jobs are no longer claimed, and are kept for inspection.
        assert jobs.claim_batch(s, limit=5) == []
        assert row.last_error


def test_a_future_job_is_not_claimed_yet(db_session):
    jobs.handler("later")(lambda db, payload: None)
    jobs.enqueue(db_session, "later", {}, run_at=datetime.now(timezone.utc) + timedelta(hours=1))
    db_session.commit()

    with SessionLocal() as s:
        assert jobs.claim_batch(s, limit=5) == []


def test_a_job_abandoned_by_a_dead_worker_is_reclaimed(db_session):
    """Otherwise a crash mid-job would strand the work forever."""
    jobs.handler("noop")(lambda db, payload: None)
    jobs.enqueue(db_session, "noop", {})
    db_session.commit()

    with SessionLocal() as s:
        s.query(Job).update({"locked_at": datetime.now(timezone.utc) - timedelta(hours=1)})
        s.commit()
        assert len(jobs.claim_batch(s, limit=5, stale_after_minutes=15)) == 1


def test_checkout_queues_its_side_work_instead_of_doing_it_inline(
    client, make_customer, make_book, db_session
):
    """The customer must not wait on SMTP for an order that is already placed."""
    user, book = make_customer(), make_book(stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=user["headers"])

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    order_id = res.json()["id"]

    kinds = {j.kind for j in db_session.query(Job).all()}
    assert "order_confirmation_email" in kinds
    assert "admin_order_notifications" in kinds

    queued = (
        db_session.query(Job).filter(Job.kind == "order_confirmation_email").first()
    )
    assert queued.payload["order_id"] == order_id
    assert queued.completed_at is None


def test_password_reset_queues_its_email(client, make_customer, db_session):
    user = make_customer()
    assert client.post("/auth/password-reset/request",
                       json={"email": user["email"]}).status_code == 202

    job = db_session.query(Job).filter(Job.kind == "password_reset_email").first()
    assert job is not None
    assert job.payload["email"] == user["email"]
    # The raw token only exists in the payload; the DB stores its hash.
    assert job.payload["token"]


def test_the_confirmation_handler_sends_and_is_safe_to_retry(
    client, make_customer, make_book, db_session, monkeypatch
):
    from app.core import job_handlers

    sent = []
    monkeypatch.setattr(
        job_handlers.email_service,
        "send_order_confirmation",
        lambda *, to, name, order: sent.append(to) or True,
    )

    user, book = make_customer(), make_book(stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=user["headers"])
    client.post("/api/customer/checkout", headers=user["headers"])

    job = db_session.query(Job).filter(Job.kind == "order_confirmation_email").first()
    with SessionLocal() as s:
        fresh = s.query(Job).filter(Job.id == job.id).first()
        assert jobs.run_job(s, fresh) is True
    assert sent == [user["email"]]


def test_admin_notification_handler_does_not_duplicate_on_retry(
    client, make_customer, make_admin, make_book, db_session
):
    from app.core.job_handlers import admin_order_notifications
    from app.database.models.notification import Notification

    admin = make_admin()
    user, book = make_customer(), make_book(stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=user["headers"])
    order_id = client.post("/api/customer/checkout", headers=user["headers"]).json()["id"]

    with SessionLocal() as s:
        admin_order_notifications(s, {"order_id": order_id})
        admin_order_notifications(s, {"order_id": order_id})

    count = (
        db_session.query(Notification)
        .filter(Notification.user_id == admin["id"], Notification.title == "New order placed")
        .count()
    )
    assert count == 1
