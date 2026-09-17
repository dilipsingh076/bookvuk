"""Cart validation, checkout arithmetic, stock accounting and the oversell race."""

import threading
from decimal import Decimal

from app.database.db import SessionLocal
from app.database.models.book import Book

# Checkout requires somewhere to ship to.
SHIPPING_ADDRESS = {
    "full_name": "Race Tester",
    "phone": "9876500000",
    "line1": "1 Race Street",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postal_code": "560001",
    "country": "IN",
}


def _add(client, headers, book, qty):
    return client.post("/api/customer/cart/items",
                       json={"book_id": str(book.id), "quantity": qty}, headers=headers)


def test_brand_new_user_can_read_an_empty_cart(client, make_customer):
    """No cart row exists yet, so the response has id=None. This used to 500."""
    user = make_customer()
    res = client.get("/api/customer/cart", headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["items"] == []
    assert body["id"] is None


def test_add_to_cart_then_read_it_back(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)
    assert _add(client, user["headers"], book, 3).status_code == 200

    items = client.get("/api/customer/cart", headers=user["headers"]).json()["items"]
    assert len(items) == 1
    assert items[0]["quantity"] == 3


def test_adding_the_same_book_twice_increments_the_line(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 2)
    _add(client, user["headers"], book, 3)

    items = client.get("/api/customer/cart", headers=user["headers"]).json()["items"]
    assert len(items) == 1
    assert items[0]["quantity"] == 5


def test_add_to_cart_rejects_zero_and_negative_quantity(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)
    assert _add(client, user["headers"], book, 0).status_code == 422
    assert _add(client, user["headers"], book, -5).status_code == 422


def test_add_to_cart_rejects_unknown_book(client, make_customer):
    user = make_customer()
    res = client.post("/api/customer/cart/items",
                      json={"book_id": "00000000-0000-0000-0000-000000000000", "quantity": 1},
                      headers=user["headers"])
    assert res.status_code == 404


def test_quantity_patch_without_the_field_is_422_not_500(client, make_customer, make_book):
    """This used to raise KeyError and surface as a 500."""
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 1)

    res = client.patch(f"/api/customer/cart/items/{book.id}", json={}, headers=user["headers"])
    assert res.status_code == 422


def test_quantity_patch_rejects_non_integer(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 1)

    res = client.patch(f"/api/customer/cart/items/{book.id}",
                       json={"quantity_change": "lots"}, headers=user["headers"])
    assert res.status_code == 422


def test_quantity_patch_is_bounded(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 1)

    res = client.patch(f"/api/customer/cart/items/{book.id}",
                       json={"quantity_change": 10_000}, headers=user["headers"])
    assert res.status_code == 422


def test_quantity_patch_cannot_exceed_stock(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=5)
    _add(client, user["headers"], book, 1)

    res = client.patch(f"/api/customer/cart/items/{book.id}",
                       json={"quantity_change": 9}, headers=user["headers"])
    assert res.status_code == 409
    assert "left in stock" in res.json()["detail"]


def test_checkout_totals_and_stock(client, make_customer, make_book):
    user = make_customer()
    book = make_book(price="100.00", stock=10)
    _add(client, user["headers"], book, 3)

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    order = res.json()

    # What the shop actually charges: the price is an MRP and carries no tax on
    # top, and 300 is under the free-delivery threshold so delivery is added.
    # The arithmetic itself is pinned in test_pricing.py; these figures are here
    # to notice when the *shop's rates* change, which should never be silent.
    assert Decimal(order["subtotal"]) == Decimal("300.00")
    assert Decimal(order["shipping"]) == Decimal("49.00")
    assert Decimal(order["tax"]) == Decimal("0.00")
    assert Decimal(order["total"]) == Decimal("349.00")
    assert order["status"] == "processing"

    with SessionLocal() as s:
        assert s.query(Book).filter(Book.id == book.id).first().stock == 7


def test_checkout_empties_the_cart(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 2)
    client.post("/api/customer/checkout", headers=user["headers"])

    assert client.get("/api/customer/cart", headers=user["headers"]).json()["items"] == []


def test_checkout_with_an_empty_cart_is_rejected(client, make_customer):
    user = make_customer()
    assert client.post("/api/customer/checkout", headers=user["headers"]).status_code == 400


def test_checkout_never_oversells(client, make_customer, make_book):
    """A line whose quantity exceeds stock is not ordered, and the stock is untouched.

    The refusal message changed when carts were allowed to hold books that are out
    of stock (so "notify me" can park one there) — a cart with nothing orderable now
    says so rather than naming one line. What must not change is this: the shop
    cannot sell what it does not have.
    """
    user, book = make_customer(), make_book(stock=2)
    _add(client, user["headers"], book, 2)
    with SessionLocal() as s:
        row = s.query(Book).filter(Book.id == book.id).first()
        row.stock = 1
        s.commit()

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 409
    assert "available" in res.json()["detail"].lower()

    with SessionLocal() as s:
        assert s.query(Book).filter(Book.id == book.id).first().stock == 1


def test_cancelling_an_order_restores_stock_exactly_once(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10)
    _add(client, user["headers"], book, 4)
    order_id = client.post("/api/customer/checkout", headers=user["headers"]).json()["id"]

    with SessionLocal() as s:
        assert s.query(Book).filter(Book.id == book.id).first().stock == 6

    assert client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"]).status_code == 200
    with SessionLocal() as s:
        assert s.query(Book).filter(Book.id == book.id).first().stock == 10

    # Cancelling again must be a no-op, not a second restore.
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])
    with SessionLocal() as s:
        assert s.query(Book).filter(Book.id == book.id).first().stock == 10


def test_checkout_rereads_stock_under_a_row_lock(live_server, make_book):
    """Regression test for the missing `SELECT ... FOR UPDATE` in checkout.

    Racing N requests and hoping they interleave is not reliable — the window is
    tiny and TestClient serialises requests outright — so this forces the exact
    interleaving instead:

      1. Another transaction takes `FOR UPDATE` on the book and holds it.
      2. A checkout request starts and must wait for that lock.
      3. The holder sets stock to 0 and commits, then releases.

    With the lock, checkout only reads stock *after* acquiring it, sees 0, and
    returns 409. Without the lock, checkout has already read the stale stock (an
    unlocked read never blocks under MVCC), so it passes the availability check,
    blocks only on the UPDATE, and then sells books that are already gone.
    """
    import time

    import httpx
    from sqlalchemy import text

    stock = 6
    book = make_book(stock=stock)

    with httpx.Client(base_url=live_server, timeout=30) as setup:
        res = setup.post("/auth/register", json={
            "email": f"lock-{book.catalog_id}@booknest.com",
            "username": f"lock{book.catalog_id[-6:]}",
            "full_name": "Lock Tester", "password": "Passw0rd!23",
        })
        assert res.status_code == 200, res.text
        token = res.json()["access_token"]
        added = setup.post("/api/customer/cart/items",
                           json={"book_id": str(book.id), "quantity": stock},
                           headers={"Authorization": f"Bearer {token}"})
        assert added.status_code == 200, added.text

    result: dict[str, int] = {}

    def checkout():
        with httpx.Client(base_url=live_server, timeout=60) as c:
            result["status"] = c.post(
                "/api/customer/checkout",
                json={"address": SHIPPING_ADDRESS},
                headers={"Authorization": f"Bearer {token}"},
            ).status_code

    holder = SessionLocal()
    try:
        holder.execute(
            text("SELECT id FROM books WHERE id = :bid FOR UPDATE"), {"bid": str(book.id)}
        )

        thread = threading.Thread(target=checkout)
        thread.start()
        # Give the request time to reach the database and block on the lock.
        time.sleep(1.5)

        holder.execute(
            text("UPDATE books SET stock = 0 WHERE id = :bid"), {"bid": str(book.id)}
        )
        holder.commit()
    finally:
        holder.close()

    thread.join(timeout=60)
    assert not thread.is_alive(), "checkout never completed"

    with SessionLocal() as s:
        final = s.query(Book).filter(Book.id == book.id).first().stock

    assert result["status"] == 409, (
        f"checkout returned {result['status']} after the stock was taken by another "
        "transaction - it read stock without holding the row lock and oversold"
    )
    assert final == 0, f"stock should still be 0, got {final}"


# ----- the totals embedded in the cart response -----
#
# The cart page used to fetch the lines and then a separate totals endpoint,
# which repeated the same three queries — measured at around 1.2s each against
# the production database, so roughly 2.4s before a total appeared and a third
# call on every quantity change. The cart handler has the rows already, so it
# prices them, and the second endpoint is gone along with the second
# implementation of the arithmetic that could drift from it.


def test_the_cart_response_carries_its_own_totals(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=10, price=Decimal("100.00"))
    _add(client, user["headers"], book, 2)

    body = client.get("/api/customer/cart", headers=user["headers"]).json()
    assert body["totals"] is not None
    assert Decimal(body["totals"]["subtotal"]) == Decimal("200.00")


def test_an_empty_cart_is_still_priced(client, make_customer):
    """A new user has no cart row at all, and that branch returns early."""
    user = make_customer()
    totals = client.get("/api/customer/cart", headers=user["headers"]).json()["totals"]
    assert totals is not None
    assert Decimal(totals["subtotal"]) == Decimal("0.00")
    assert Decimal(totals["total"]) == Decimal("0.00")


def test_the_price_excludes_a_line_the_order_cannot_fulfil(client, make_customer, make_book):
    """An out-of-stock line is not charged for.

    A cart can hold a book that has sold out since it went in. Charging for it
    would quote a total the order cannot honour.
    """
    user = make_customer()
    sellable = make_book(stock=10, price=Decimal("100.00"))
    _add(client, user["headers"], sellable, 1)

    short = make_book(stock=5, price=Decimal("999.00"))
    _add(client, user["headers"], short, 5)
    db = SessionLocal()
    db.query(Book).filter(Book.id == short.id).update({"stock": 0})
    db.commit()
    db.close()

    totals = client.get("/api/customer/cart", headers=user["headers"]).json()["totals"]

    assert Decimal(totals["subtotal"]) == Decimal("100.00")
    assert Decimal(totals["total"]) == Decimal("149.00")  # 100 + 49 delivery


def test_the_totals_carry_no_discount_unless_a_code_is_asked_for(client, make_customer, make_book):
    """A cart fetched without a code is priced without one."""
    user = make_customer()
    _add(client, user["headers"], make_book(stock=10, price=Decimal("100.00")), 1)

    totals = client.get("/api/customer/cart", headers=user["headers"]).json()["totals"]
    assert Decimal(totals["discount"]) == Decimal("0.00")
    assert totals["coupon_code"] is None


# ----- every cart write answers with the whole cart -----
#
# A quantity press was a PATCH that answered with the one line it touched,
# followed by a GET for everything else — two sequential round trips, measured
# at 2.6s + 1.2s against the production database for one tap of `+`. Each write
# now returns what the cart has become, so the follow-up read is gone.


def _totals(body):
    assert body["totals"] is not None, "a write answered without a price"
    return body["totals"]


def test_adding_answers_with_the_whole_cart(client, make_customer, make_book):
    user = make_customer()
    book = make_book(stock=10, price=Decimal("100.00"))

    body = _add(client, user["headers"], book, 2).json()
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 2
    assert Decimal(_totals(body)["subtotal"]) == Decimal("200.00")


def test_changing_the_quantity_answers_with_the_whole_cart(client, make_customer, make_book):
    user = make_customer()
    book = make_book(stock=10, price=Decimal("100.00"))
    _add(client, user["headers"], book, 2)

    res = client.patch(f"/api/customer/cart/items/{book.id}",
                       json={"quantity_change": 1}, headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["items"][0]["quantity"] == 3
    # The number the shopper is about to be charged, without a second request.
    assert Decimal(_totals(body)["subtotal"]) == Decimal("300.00")


def test_dropping_to_zero_answers_with_the_emptied_cart(client, make_customer, make_book):
    """It used to *raise* a 204 to report this — a success dressed as an error."""
    user = make_customer()
    book = make_book(stock=10, price=Decimal("100.00"))
    _add(client, user["headers"], book, 1)

    res = client.patch(f"/api/customer/cart/items/{book.id}",
                       json={"quantity_change": -1}, headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["items"] == []
    assert Decimal(_totals(body)["subtotal"]) == Decimal("0.00")


def test_removing_a_line_answers_with_what_is_left(client, make_customer, make_book):
    user = make_customer()
    keep = make_book(stock=10, price=Decimal("40.00"))
    drop = make_book(stock=10, price=Decimal("100.00"))
    _add(client, user["headers"], keep, 1)
    _add(client, user["headers"], drop, 1)

    res = client.delete(f"/api/customer/cart/items/{drop.id}", headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["items"]) == 1
    assert Decimal(_totals(body)["subtotal"]) == Decimal("40.00")


def test_clearing_answers_with_an_empty_priced_cart(client, make_customer, make_book):
    user = make_customer()
    _add(client, user["headers"], make_book(stock=10, price=Decimal("100.00")), 2)

    res = client.delete("/api/customer/cart/cartClear", headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["items"] == []
    assert Decimal(_totals(body)["total"]) == Decimal("0.00")


def test_a_write_and_a_read_describe_the_same_cart(client, make_customer, make_book):
    """The risk of answering from the write: two places building one cart."""
    user = make_customer()
    book = make_book(stock=10, price=Decimal("249.50"))
    _add(client, user["headers"], book, 3)

    written = client.patch(f"/api/customer/cart/items/{book.id}",
                           json={"quantity_change": -1}, headers=user["headers"]).json()
    read = client.get("/api/customer/cart", headers=user["headers"]).json()

    assert written["items"] == read["items"]
    assert written["totals"] == read["totals"]


def test_the_stock_ceiling_still_refuses(client, make_customer, make_book):
    """The stock check reads two columns now instead of the whole Book row."""
    user = make_customer()
    book = make_book(stock=2, price=Decimal("100.00"))
    _add(client, user["headers"], book, 2)

    res = client.patch(f"/api/customer/cart/items/{book.id}",
                       json={"quantity_change": 1}, headers=user["headers"])
    assert res.status_code == 409, res.text
    assert "2 left in stock" in res.json()["detail"]


def test_simultaneous_quantity_changes_do_not_lose_each_other(client, make_customer, make_book):
    """Five decrements must land as five, not as one.

    The quantity change is *relative*, so without a row lock several presses
    arriving together all read the same quantity, all compute the same new one,
    and all write it: five presses of − from 6 left the line at 5, with every
    request answering 200.

    This is guarded here because the lock's query was later rewritten to fetch
    the cart, the line and the stock together — and a join that quietly drops
    the `FOR UPDATE` brings the bug back with nothing else looking different.
    """
    user = make_customer()
    book = make_book(stock=50, price=Decimal("10.00"))
    _add(client, user["headers"], book, 6)

    results = []
    barrier = threading.Barrier(5)

    def press():
        barrier.wait()
        r = client.patch(f"/api/customer/cart/items/{book.id}",
                         json={"quantity_change": -1}, headers=user["headers"])
        results.append(r.status_code)

    threads = [threading.Thread(target=press) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert all(s == 200 for s in results), results
    items = client.get("/api/customer/cart", headers=user["headers"]).json()["items"]
    assert items[0]["quantity"] == 1, "a decrement was lost — the row lock is not holding"


# ----- an applied code rides along with the cart -----
#
# With a code applied, every quantity press cost three requests: a totals call
# before the write and another after it. The code now travels as a query
# parameter on the cart's own endpoints, so the discount arrives with the lines.


def _coupon(db_session, code="RIDEALONG", value=Decimal("10")):
    from app.database.models.coupon import Coupon

    row = Coupon(code=code, discount_type="percent", value=value,
                 min_subtotal=Decimal("0"), is_active=True)
    db_session.add(row)
    db_session.commit()
    return row


def test_the_cart_prices_an_applied_code(client, make_customer, make_book, db_session):
    user = make_customer()
    _add(client, user["headers"], make_book(stock=10, price=Decimal("100.00")), 2)
    _coupon(db_session)

    body = client.get("/api/customer/cart?coupon_code=RIDEALONG", headers=user["headers"]).json()
    totals = body["totals"]
    assert Decimal(totals["discount"]) == Decimal("20.00")
    assert totals["coupon_code"] == "RIDEALONG"
    assert totals["coupon_error"] is None


def test_a_write_prices_the_code_too(client, make_customer, make_book, db_session):
    """The whole point: one request for the change *and* the discounted total."""
    user = make_customer()
    book = make_book(stock=10, price=Decimal("100.00"))
    _add(client, user["headers"], book, 2)
    _coupon(db_session)

    res = client.patch(f"/api/customer/cart/items/{book.id}?coupon_code=RIDEALONG",
                       json={"quantity_change": 1}, headers=user["headers"])
    assert res.status_code == 200, res.text
    totals = res.json()["totals"]
    assert Decimal(totals["subtotal"]) == Decimal("300.00")
    assert Decimal(totals["discount"]) == Decimal("30.00")


def test_a_bad_code_does_not_take_the_cart_down_with_it(client, make_customer, make_book):
    """A code can expire between being applied and the next request.

    Failing the cart over it would cost the shopper the whole page for the sake
    of a discount, so the refusal is reported and the undiscounted figures still
    come back.
    """
    user = make_customer()
    _add(client, user["headers"], make_book(stock=10, price=Decimal("100.00")), 1)

    res = client.get("/api/customer/cart?coupon_code=NOSUCHCODE", headers=user["headers"])
    assert res.status_code == 200, res.text
    totals = res.json()["totals"]
    assert totals["coupon_error"], "the shopper is not told why nothing came off"
    assert totals["coupon_code"] is None
    assert Decimal(totals["discount"]) == Decimal("0.00")
    assert Decimal(totals["subtotal"]) == Decimal("100.00")
