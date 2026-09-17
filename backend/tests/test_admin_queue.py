"""The queue counts, pinned against the rows they describe.

These numbers exist twice — as SQL in `admin.py::admin_queue_counts` and as
`awaitingCashCollection` and friends in the frontend's `api/admin.ts`, which the
Orders and Buyback screens apply to rows they already hold. Two expressions of
one rule will drift unless something holds them together; this is that something.

Each test builds the row a rule is *about* and the row next to it that the rule
must exclude, so a predicate that is quietly loosened fails here.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.core.payment import PAYMENT_METHOD_COD, PAYMENT_STATUS_PAID


def _queue(client, admin):
    res = client.get("/api/admin/queue", headers=admin["headers"])
    assert res.status_code == 200, res.text
    return res.json()


def _order(client, cust, book, *, method="online"):
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=cust["headers"])
    res = client.post("/api/customer/checkout",
                      json={"payment_method": method}, headers=cust["headers"])
    assert res.status_code == 200, res.text
    return res.json()["id"]


def test_an_empty_shop_counts_zero(client, make_admin):
    assert _queue(client, make_admin()) == {
        "orders_to_fulfil": 0,
        "cash_to_collect": 0,
        "buyback_to_review": 0,
        "buyback_to_pay": 0,
    }


def test_a_cod_order_is_both_to_fulfil_and_cash_due(client, make_customer, make_admin, make_book):
    """One order, two different jobs — it has to be packed *and* collected for."""
    cust, admin = make_customer(), make_admin()
    _order(client, cust, make_book(price="199.00", stock=5), method="cod")

    q = _queue(client, admin)
    assert q["orders_to_fulfil"] == 1
    assert q["cash_to_collect"] == 1


def test_an_unpaid_online_order_is_not_yet_work(client, make_customer, make_admin, make_book):
    """Nothing is owed to the shop and nothing should be packed: the customer has
    not paid, so it is not in anybody's queue."""
    cust, admin = make_customer(), make_admin()
    _order(client, cust, make_book(price="199.00", stock=5))

    q = _queue(client, admin)
    assert q["orders_to_fulfil"] == 0
    assert q["cash_to_collect"] == 0


def test_collecting_the_cash_clears_it_from_the_cash_queue(
    client, make_customer, make_admin, make_book
):
    cust, admin = make_customer(), make_admin()
    order_id = _order(client, cust, make_book(price="199.00", stock=5), method="cod")

    assert _queue(client, admin)["cash_to_collect"] == 1
    client.post(f"/api/admin/orders/{order_id}/collect-cash", headers=admin["headers"])
    assert _queue(client, admin)["cash_to_collect"] == 0


def test_a_packed_order_has_left_the_fulfil_queue(client, make_customer, make_admin, make_book):
    cust, admin = make_customer(), make_admin()
    order_id = _order(client, cust, make_book(price="199.00", stock=5), method="cod")

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "packed"}, headers=admin["headers"])
    assert _queue(client, admin)["orders_to_fulfil"] == 0


def test_a_cancelled_cod_order_is_not_cash_owed(client, make_customer, make_admin, make_book):
    """Cancelling restores the stock; there is no parcel and no money to collect."""
    cust, admin = make_customer(), make_admin()
    order_id = _order(client, cust, make_book(price="199.00", stock=5), method="cod")

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "cancelled"}, headers=admin["headers"])
    q = _queue(client, admin)
    assert q["cash_to_collect"] == 0
    assert q["orders_to_fulfil"] == 0


def test_buyback_counts_follow_the_stage(client, make_customer, make_admin, make_book):
    cust, admin = make_customer(), make_admin()
    book = make_book(price="849.00", stock=5)

    res = client.post("/api/buyback",
                      json={"book_id": str(book.id), "condition": "like_new",
                            "quantity": 1, "payout_method": "wallet"},
                      headers=cust["headers"])
    assert res.status_code == 201, res.text
    request_id = res.json()["id"]

    assert _queue(client, admin)["buyback_to_review"] == 1

    client.post(f"/api/admin/buyback/{request_id}/decision",
                json={"approve": True}, headers=admin["headers"])
    q = _queue(client, admin)
    # Approved is waiting on a parcel — nobody's queue until it arrives.
    assert q["buyback_to_review"] == 0
    assert q["buyback_to_pay"] == 0

    client.post(f"/api/admin/buyback/{request_id}/receive",
                json={"received_condition": "good"}, headers=admin["headers"])
    assert _queue(client, admin)["buyback_to_pay"] == 1


def test_a_customer_cannot_read_the_queue(client, make_customer):
    res = client.get("/api/admin/queue", headers=make_customer()["headers"])
    assert res.status_code in (401, 403)
