"""Cash on delivery: the ceiling, and who may mark the cash collected.

The interesting claims are the ones a client could otherwise walk past. The
browser is told whether COD is on offer, but that is a hint — the rule is money,
so the server has to be the one that enforces it.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.core.config import settings
from app.core.payment import (
    PAYMENT_METHOD_COD,
    PAYMENT_METHOD_ONLINE,
    PAYMENT_STATUS_PAID,
    PAYMENT_STATUS_PENDING,
    cod_available,
    is_cod,
)


class _Order:
    def __init__(self, method):
        self.payment_method = method


def test_an_order_from_before_the_column_existed_reads_as_online():
    """Every order placed before COD was an online order — it was the only kind."""
    assert is_cod(_Order(None)) is False
    assert is_cod(_Order(PAYMENT_METHOD_ONLINE)) is False
    assert is_cod(_Order(PAYMENT_METHOD_COD)) is True


def test_cod_is_offered_under_the_ceiling():
    ok, reason = cod_available(Decimal("500"), enabled=True, max_total=Decimal("3000"))
    assert ok and reason is None


def test_cod_is_refused_above_the_ceiling_with_a_reason_that_says_what_to_do():
    ok, reason = cod_available(Decimal("5000"), enabled=True, max_total=Decimal("3000"))
    assert not ok
    assert "pay online" in reason.lower()


def test_the_ceiling_is_inclusive_at_the_limit():
    ok, _ = cod_available(Decimal("3000"), enabled=True, max_total=Decimal("3000"))
    assert ok


def test_a_zero_ceiling_means_no_ceiling():
    ok, _ = cod_available(Decimal("999999"), enabled=True, max_total=Decimal("0"))
    assert ok


def test_cod_off_refuses_every_total():
    ok, reason = cod_available(Decimal("1"), enabled=False, max_total=None)
    assert not ok and reason


# --------------------------------------------------------------------------
# through the API
# --------------------------------------------------------------------------

def test_checkout_defaults_to_online(client, make_customer, make_book, db_session):
    cust = make_customer()
    book = make_book(price="199.00", stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])

    res = client.post("/api/customer/checkout", json={}, headers=cust["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["payment_method"] == PAYMENT_METHOD_ONLINE


def test_a_cod_order_records_the_method_and_stays_unpaid(client, make_customer, make_book):
    cust = make_customer()
    book = make_book(price="199.00", stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])

    res = client.post("/api/customer/checkout",
                      json={"payment_method": "cod"}, headers=cust["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["payment_method"] == PAYMENT_METHOD_COD
    assert body["payment_status"] == PAYMENT_STATUS_PENDING


def test_the_server_enforces_the_ceiling_even_if_the_client_ignores_it(
    client, make_customer, make_book, monkeypatch
):
    """The browser is told whether to offer COD; it is not asked to enforce it."""
    monkeypatch.setattr(settings, "COD_MAX_ORDER_TOTAL", Decimal("100"))
    cust = make_customer()
    book = make_book(price="999.00", stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])

    res = client.post("/api/customer/checkout",
                      json={"payment_method": "cod"}, headers=cust["headers"])
    assert res.status_code == 400
    assert "online" in res.json()["detail"].lower()


def test_an_unknown_method_is_rejected_by_the_schema(client, make_customer, make_book):
    cust = make_customer()
    book = make_book(price="199.00", stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])

    res = client.post("/api/customer/checkout",
                      json={"payment_method": "bitcoin"}, headers=cust["headers"])
    assert res.status_code == 422


def test_cart_totals_say_whether_cod_is_on_offer(client, make_customer, make_book):
    cust = make_customer()
    book = make_book(price="199.00", stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])

    body = client.get("/api/customer/cart", headers=cust["headers"]).json()["totals"]
    assert body["cod_available"] is True
    assert body["cod_unavailable_reason"] is None


# --------------------------------------------------------------------------
# collecting the cash
# --------------------------------------------------------------------------

def _place_cod_order(client, cust, book):
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])
    res = client.post("/api/customer/checkout",
                      json={"payment_method": "cod"}, headers=cust["headers"])
    assert res.status_code == 200, res.text
    return res.json()["id"]


def test_an_admin_marks_the_cash_collected(client, make_customer, make_admin, make_book):
    cust = make_customer()
    admin = make_admin()
    book = make_book(price="199.00", stock=5)
    order_id = _place_cod_order(client, cust, book)

    res = client.post(f"/api/admin/orders/{order_id}/collect-cash", headers=admin["headers"])
    assert res.status_code == 200, res.text

    order = client.get(f"/api/customer/orders/{order_id}", headers=cust["headers"]).json()
    assert order["payment_status"] == PAYMENT_STATUS_PAID


def test_collecting_twice_does_not_book_the_money_twice(client, make_customer, make_admin, make_book):
    """A double-click, or a retry after a dropped response."""
    cust = make_customer()
    admin = make_admin()
    book = make_book(price="199.00", stock=5)
    order_id = _place_cod_order(client, cust, book)

    first = client.post(f"/api/admin/orders/{order_id}/collect-cash", headers=admin["headers"])
    second = client.post(f"/api/admin/orders/{order_id}/collect-cash", headers=admin["headers"])
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]


def test_an_online_order_cannot_be_marked_cash_collected(client, make_customer, make_admin, make_book):
    """Otherwise an unpaid card order could be marked paid with no money behind it."""
    cust = make_customer()
    admin = make_admin()
    book = make_book(price="199.00", stock=5)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])
    order_id = client.post("/api/customer/checkout", json={}, headers=cust["headers"]).json()["id"]

    res = client.post(f"/api/admin/orders/{order_id}/collect-cash", headers=admin["headers"])
    assert res.status_code == 400


def test_a_customer_cannot_mark_their_own_order_paid(client, make_customer, make_book):
    cust = make_customer()
    book = make_book(price="199.00", stock=5)
    order_id = _place_cod_order(client, cust, book)

    res = client.post(f"/api/admin/orders/{order_id}/collect-cash", headers=cust["headers"])
    assert res.status_code in (401, 403)
