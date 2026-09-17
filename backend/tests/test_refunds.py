"""Refunding a cancelled order that was already paid for.

Cancelling used to restore the stock and stop there, so a paid order left the
customer without the books and without the money. These tests are mostly about
that not being reachable, and about a retry never paying twice.

The gateway is not called for real: `payments.refund_payment` is monkeypatched,
so what is exercised is our bookkeeping around it, which is where the risk is.
"""

from decimal import Decimal

import pytest

from app.core import fulfilment, job_handlers, jobs, payments
from app.database.models.job import Job
from app.database.models.order import Order


def _place_order(client, make_customer, make_book, *, qty=2, stock=10):
    user = make_customer()
    book = make_book(stock=stock)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": qty}, headers=user["headers"])
    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    return user, book, res.json()["id"]


def _mark_paid(db_session, order_id, *, reference="pay_TESTREF123"):
    """Stand in for the webhook, which is the only thing that sets this."""
    order = db_session.query(Order).filter(Order.id == order_id).first()
    order.payment_status = "paid"
    order.payment_reference = reference
    db_session.commit()
    return order


# ----- deciding to refund -----

def test_cancelling_an_unpaid_order_does_not_enqueue_a_refund(
    client, make_customer, make_book, db_session
):
    user, _, order_id = _place_order(client, make_customer, make_book)
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    assert db_session.query(Job).filter(Job.kind == "order_refund").count() == 0


def test_cancelling_a_paid_order_marks_it_refund_pending_without_a_gateway(
    client, make_customer, make_book, db_session
):
    """No gateway configured, so the obligation is recorded instead of dropped."""
    user, _, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    res = client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["payment_status"] == fulfilment.PAYMENT_STATUS_REFUND_PENDING


def test_refund_pending_still_restores_the_stock(client, make_customer, make_book, db_session):
    """The refund being manual must not hold the inventory hostage."""
    user, book, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    db_session.refresh(book)
    assert book.stock == 10


def test_a_manual_refund_is_visible_to_admins(
    client, make_admin, make_customer, make_book, db_session
):
    """Someone has to move that money, so someone has to be told."""
    admin = make_admin()
    user, _, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    notes = client.get("/api/admin/notifications", headers=admin["headers"]).json()
    assert any(n["title"] == "Refund needed" for n in notes)


def test_an_admin_cancel_of_a_paid_order_refunds_too(
    client, make_admin, make_customer, make_book, db_session
):
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "cancelled"}, headers=admin["headers"])

    order = db_session.query(Order).filter(Order.id == order_id).first()
    db_session.refresh(order)
    assert order.payment_status == fulfilment.PAYMENT_STATUS_REFUND_PENDING


def test_a_paid_cancellation_enqueues_exactly_one_refund_job(
    client, make_customer, make_book, db_session, monkeypatch
):
    monkeypatch.setattr(type(fulfilment.settings), "payments_enabled", property(lambda self: True))

    user, _, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    assert db_session.query(Job).filter(Job.kind == "order_refund").count() == 1


# ----- running the refund -----

def test_the_handler_refunds_and_records_the_reference(db_session, monkeypatch, client, make_customer, make_book):
    user, _, order_id = _place_order(client, make_customer, make_book)
    order = _mark_paid(db_session, order_id)
    total = Decimal(str(order.total))

    calls = []

    def fake_refund(*, payment_id, amount, idempotency_key):
        calls.append({"payment_id": payment_id, "amount": amount, "key": idempotency_key})
        return {"id": "rfnd_ABC123", "status": "processed"}

    monkeypatch.setattr(payments, "refund_payment", fake_refund)

    job_handlers.order_refund(db_session, {"order_id": str(order_id)})

    db_session.expire_all()
    refreshed = db_session.query(Order).filter(Order.id == order_id).first()
    assert refreshed.payment_status == "refunded"
    assert refreshed.refund_reference == "rfnd_ABC123"
    assert Decimal(str(refreshed.refund_amount)) == total
    assert refreshed.refunded_at is not None

    assert len(calls) == 1
    assert calls[0]["payment_id"] == "pay_TESTREF123"
    assert calls[0]["amount"] == total
    # Derived from the order, so a retry hits the same key.
    assert calls[0]["key"] == f"refund-{order_id}"


def test_the_handler_is_a_no_op_on_an_already_refunded_order(
    db_session, monkeypatch, client, make_customer, make_book
):
    """Jobs are retried, so the second run must not send a second refund."""
    user, _, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    calls = []
    monkeypatch.setattr(
        payments, "refund_payment",
        lambda **kw: calls.append(kw) or {"id": "rfnd_ONCE"},
    )

    job_handlers.order_refund(db_session, {"order_id": str(order_id)})
    job_handlers.order_refund(db_session, {"order_id": str(order_id)})

    assert len(calls) == 1, "a retry issued a second refund"


def test_the_idempotency_key_is_stable_across_attempts(
    db_session, monkeypatch, client, make_customer, make_book
):
    """The key must not be per-attempt, or the gateway cannot dedupe on it."""
    user, _, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    keys = []

    def flaky(*, payment_id, amount, idempotency_key):
        keys.append(idempotency_key)
        if len(keys) == 1:
            raise payments.PaymentError("gateway hiccup")
        return {"id": "rfnd_SECOND"}

    monkeypatch.setattr(payments, "refund_payment", flaky)

    with pytest.raises(payments.PaymentError):
        job_handlers.order_refund(db_session, {"order_id": str(order_id)})
    db_session.rollback()
    job_handlers.order_refund(db_session, {"order_id": str(order_id)})

    assert len(keys) == 2
    assert keys[0] == keys[1]


def test_a_gateway_failure_leaves_the_order_unrefunded_so_it_retries(
    db_session, monkeypatch, client, make_customer, make_book
):
    user, _, order_id = _place_order(client, make_customer, make_book)
    _mark_paid(db_session, order_id)

    monkeypatch.setattr(
        payments, "refund_payment",
        lambda **kw: (_ for _ in ()).throw(payments.PaymentError("declined")),
    )

    with pytest.raises(payments.PaymentError):
        job_handlers.order_refund(db_session, {"order_id": str(order_id)})
    db_session.rollback()

    refreshed = db_session.query(Order).filter(Order.id == order_id).first()
    assert refreshed.payment_status == "paid", "must stay refundable for the retry"
    assert refreshed.refunded_at is None


def test_a_paid_order_with_no_payment_reference_raises(
    db_session, client, make_customer, make_book
):
    """Nothing to refund against; retrying cannot invent a payment id."""
    user, _, order_id = _place_order(client, make_customer, make_book)
    order = db_session.query(Order).filter(Order.id == order_id).first()
    order.payment_status = "paid"
    order.payment_reference = None
    db_session.commit()

    with pytest.raises(RuntimeError, match="no payment reference"):
        job_handlers.order_refund(db_session, {"order_id": str(order_id)})


def test_a_deleted_order_is_not_retried_forever(db_session):
    import uuid

    # No exception: there is nothing to refund and nothing a retry would fix.
    job_handlers.order_refund(db_session, {"order_id": str(uuid.uuid4())})


def test_order_refund_is_a_registered_kind():
    """`enqueue` rejects unknown kinds, so the cancel path depends on this."""
    assert "order_refund" in jobs.registered_kinds()
