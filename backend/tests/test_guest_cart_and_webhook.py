"""Guest-cart merge, checkout idempotency, and the payment webhook."""

import hashlib
import hmac
import json

from app.core.config import settings
from app.database.db import SessionLocal
from app.database.models.order import Order

WEBHOOK_SECRET = "whsec-test-value"


def _add(client, headers, book, qty=1):
    return client.post("/api/customer/cart/items",
                       json={"book_id": str(book.id), "quantity": qty}, headers=headers)


# ----- guest cart merge -----

def test_merge_adds_a_guest_line_to_an_empty_cart(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)

    res = client.post("/api/customer/cart/merge",
                      json={"items": [{"book_id": str(book.id), "quantity": 2}]},
                      headers=user["headers"])
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["quantity"] == 2


def test_merge_sums_with_an_existing_line(client, make_customer, make_book):
    """Signing in must not discard either cart."""
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 1)

    res = client.post("/api/customer/cart/merge",
                      json={"items": [{"book_id": str(book.id), "quantity": 2}]},
                      headers=user["headers"])
    assert res.json()["items"][0]["quantity"] == 3


def test_merge_caps_each_line_at_available_stock(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=4)

    res = client.post("/api/customer/cart/merge",
                      json={"items": [{"book_id": str(book.id), "quantity": 99}]},
                      headers=user["headers"])
    assert res.json()["items"][0]["quantity"] == 4


def test_merge_collapses_duplicate_lines_in_the_payload(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)

    res = client.post(
        "/api/customer/cart/merge",
        json={"items": [
            {"book_id": str(book.id), "quantity": 2},
            {"book_id": str(book.id), "quantity": 3},
        ]},
        headers=user["headers"],
    )
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["quantity"] == 5


def test_merge_skips_unknown_books_instead_of_failing(client, make_customer, make_book):
    """One unavailable title must not lose the rest of the cart."""
    user, book = make_customer(), make_book(stock=5)

    res = client.post(
        "/api/customer/cart/merge",
        json={"items": [
            {"book_id": "00000000-0000-0000-0000-000000000000", "quantity": 1},
            {"book_id": str(book.id), "quantity": 1},
        ]},
        headers=user["headers"],
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["book_id"] == str(book.id)


def test_merge_skips_out_of_stock_books(client, make_customer, make_book):
    user = make_customer()
    gone = make_book(stock=0)

    res = client.post("/api/customer/cart/merge",
                      json={"items": [{"book_id": str(gone.id), "quantity": 1}]},
                      headers=user["headers"])
    assert res.json()["items"] == []


def test_an_empty_merge_is_a_no_op(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=5)
    _add(client, user["headers"], book, 2)

    res = client.post("/api/customer/cart/merge", json={"items": []}, headers=user["headers"])
    assert res.json()["items"][0]["quantity"] == 2


def test_guests_cannot_merge(client):
    assert client.post("/api/customer/cart/merge", json={"items": []}).status_code == 401


def test_the_cart_response_embeds_the_book(client, make_customer, make_book):
    """This is what removed the whole-catalogue download from the frontend."""
    user, book = make_customer(), make_book(title="Embedded", price="123.00", stock=5)
    _add(client, user["headers"], book, 1)

    item = client.get("/api/customer/cart", headers=user["headers"]).json()["items"][0]
    assert item["book"] is not None
    assert item["book"]["title"] == "Embedded"
    assert item["book"]["stock"] == 5


# ----- checkout idempotency -----

def test_the_same_idempotency_key_returns_the_same_order(client, make_customer, make_book):
    """A double submit must not place two orders or decrement stock twice."""
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 2)

    headers = {**user["headers"], "Idempotency-Key": "checkout-abc-123"}
    first = client.post("/api/customer/checkout", headers=headers)
    assert first.status_code == 200, first.text

    second = client.post("/api/customer/checkout", headers=headers)
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    with SessionLocal() as s:
        assert s.query(Order).count() == 1
        from app.database.models.book import Book
        assert s.query(Book).filter(Book.id == book.id).first().stock == 8


def test_a_different_key_places_a_second_order(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)

    _add(client, user["headers"], book, 1)
    client.post("/api/customer/checkout",
                headers={**user["headers"], "Idempotency-Key": "key-1"})
    _add(client, user["headers"], book, 1)
    client.post("/api/customer/checkout",
                headers={**user["headers"], "Idempotency-Key": "key-2"})

    with SessionLocal() as s:
        assert s.query(Order).count() == 2


def test_one_customers_key_does_not_return_anothers_order(client, make_customer, make_book):
    a, b = make_customer(), make_customer()
    book = make_book(stock=10)

    _add(client, a["headers"], book, 1)
    first = client.post("/api/customer/checkout",
                        headers={**a["headers"], "Idempotency-Key": "shared"}).json()

    _add(client, b["headers"], book, 1)
    second = client.post("/api/customer/checkout",
                         headers={**b["headers"], "Idempotency-Key": "shared"}).json()

    assert first["id"] != second["id"]


# ----- payment webhook -----

def _signed(body: dict) -> tuple[str, dict]:
    raw = json.dumps(body)
    signature = hmac.new(WEBHOOK_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return raw, {"X-Razorpay-Signature": signature, "Content-Type": "application/json"}


def _order_with_gateway_id(client, make_customer, make_book, gateway_id="order_gw_1"):
    user, book = make_customer(), make_book(stock=5)
    _add(client, user["headers"], book, 1)
    order = client.post("/api/customer/checkout", headers=user["headers"]).json()
    with SessionLocal() as s:
        row = s.query(Order).filter(Order.id == order["id"]).first()
        row.payment_order_id = gateway_id
        s.commit()
    return order


def test_webhook_is_refused_when_no_secret_is_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", None)
    res = client.post("/api/payments/webhook/razorpay", json={"event": "payment.captured"})
    assert res.status_code == 503


def test_webhook_rejects_a_forged_signature(client, monkeypatch, make_customer, make_book):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    _order_with_gateway_id(client, make_customer, make_book)

    res = client.post(
        "/api/payments/webhook/razorpay",
        content=json.dumps({"event": "payment.captured"}),
        headers={"X-Razorpay-Signature": "nope", "Content-Type": "application/json"},
    )
    assert res.status_code == 400


def test_webhook_marks_an_order_paid(client, monkeypatch, make_customer, make_book):
    """Without this, a customer who pays and closes the tab is never fulfilled."""
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    order = _order_with_gateway_id(client, make_customer, make_book, "order_gw_paid")

    raw, headers = _signed({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_1", "order_id": "order_gw_paid"}}},
    })
    res = client.post("/api/payments/webhook/razorpay", content=raw, headers=headers)
    assert res.status_code == 200, res.text

    with SessionLocal() as s:
        row = s.query(Order).filter(Order.id == order["id"]).first()
        assert row.payment_status == "paid"
        assert row.payment_reference == "pay_1"
        assert row.paid_at is not None


def test_duplicate_webhook_delivery_is_a_no_op(client, monkeypatch, make_customer, make_book):
    """Webhooks are delivered at least once, so the same event will arrive again."""
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    order = _order_with_gateway_id(client, make_customer, make_book, "order_gw_dup")

    raw, headers = _signed({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_dup", "order_id": "order_gw_dup"}}},
    })
    first = client.post("/api/payments/webhook/razorpay", content=raw, headers=headers)
    second = client.post("/api/payments/webhook/razorpay", content=raw, headers=headers)

    assert first.status_code == second.status_code == 200
    assert second.json().get("duplicate") is True

    from app.database.models.notification import Notification
    with SessionLocal() as s:
        paid_notes = (
            s.query(Notification)
            .filter(Notification.title == "Payment received")
            .count()
        )
        assert paid_notes == 1


def test_webhook_for_an_unknown_order_is_acknowledged(client, monkeypatch):
    """Returning an error would make the gateway retry forever."""
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    raw, headers = _signed({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "p", "order_id": "order_never_seen"}}},
    })
    res = client.post("/api/payments/webhook/razorpay", content=raw, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"


def test_a_late_failure_event_does_not_undo_a_paid_order(client, monkeypatch, make_customer, make_book):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    order = _order_with_gateway_id(client, make_customer, make_book, "order_gw_late")

    paid_raw, paid_headers = _signed({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_ok", "order_id": "order_gw_late"}}},
    })
    client.post("/api/payments/webhook/razorpay", content=paid_raw, headers=paid_headers)

    fail_raw, fail_headers = _signed({
        "event": "payment.failed",
        "payload": {"payment": {"entity": {"id": "pay_old", "order_id": "order_gw_late"}}},
    })
    client.post("/api/payments/webhook/razorpay", content=fail_raw, headers=fail_headers)

    with SessionLocal() as s:
        assert s.query(Order).filter(Order.id == order["id"]).first().payment_status == "paid"
