"""The home page's "Trending this week" shelf.

The heading said "this week" while the query was `sort=rating_desc` — the all-time
highest rated books, with no time window in it at all. So these tests are about the
shelf matching its label, and about the label changing when the data cannot support
it.
"""

import pytest

from app.core import merchandising


def _buy(client, user, book, qty):
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": qty}, headers=user["headers"])
    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _shelf(client, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    res = client.get("/api/catalog/trending" + (f"?{query}" if query else ""))
    assert res.status_code == 200, res.text
    return res.json()


def _titles(shelf):
    return [i["title"] for i in shelf["items"]]


# ----- what the shelf is -----

def test_with_no_sales_the_shelf_says_it_is_rating_based(client, make_book):
    """A new shop has sold nothing. It must not claim these are trending."""
    for i in range(6):
        make_book(title=f"Book {i}")

    shelf = _shelf(client, limit=4)
    assert shelf["basis"] == "rating"
    assert len(shelf["items"]) == 4


def test_the_rating_fallback_is_ordered_by_rating(client, make_book, db_session):
    low = make_book(title="Mediocre")
    low.rating = 2.0
    high = make_book(title="Acclaimed")
    high.rating = 5.0
    db_session.commit()

    assert _titles(_shelf(client, limit=2))[0] == "Acclaimed"


def test_with_enough_sales_the_shelf_is_sales_based(client, make_customer, make_book):
    user = make_customer()
    books = [make_book(title=f"Sold {i}", stock=50) for i in range(4)]
    for i, book in enumerate(books):
        _buy(client, user, book, i + 1)

    shelf = _shelf(client, limit=4)
    assert shelf["basis"] == "sales"


def test_the_best_selling_book_comes_first(client, make_customer, make_book):
    """`IN (...)` does not preserve order, so the route has to restore it."""
    user = make_customer()
    quiet = make_book(title="Quiet Seller", stock=100)
    loud = make_book(title="Loud Seller", stock=100)
    a = make_book(title="Also A", stock=100)
    b = make_book(title="Also B", stock=100)
    _buy(client, user, quiet, 1)
    _buy(client, user, a, 2)
    _buy(client, user, b, 3)
    _buy(client, user, loud, 40)

    assert _titles(_shelf(client, limit=4))[0] == "Loud Seller"


def test_partial_sales_still_report_the_rating_basis(client, make_customer, make_book):
    """Two sold books cannot fill a shelf of four, and a half-true label is worse
    than an honest fallback."""
    user = make_customer()
    for i in range(6):
        make_book(title=f"Book {i}", stock=50)
    sold = make_book(title="The Only Seller", stock=50)
    _buy(client, user, sold, 5)

    assert _shelf(client, limit=4)["basis"] == "rating"


def test_cancelled_orders_do_not_make_a_book_trend(client, make_customer, make_book):
    user = make_customer()
    books = [make_book(title=f"Book {i}", stock=50) for i in range(4)]
    order_ids = [_buy(client, user, b, 5) for b in books]
    for oid in order_ids:
        client.patch(f"/api/customer/orders/{oid}/cancel", headers=user["headers"])

    assert _shelf(client, limit=4)["basis"] == "rating"


def test_the_window_is_reported_so_the_client_can_say_it(client, make_book):
    make_book(title="A Book")
    assert _shelf(client, limit=1, days=7)["window_days"] == 7
    assert _shelf(client, limit=1, days=30)["window_days"] == 30


def test_a_sale_outside_the_window_does_not_count(client, make_customer, make_book, db_session):
    from datetime import datetime, timedelta, timezone

    from app.database.models.order import Order

    user = make_customer()
    books = [make_book(title=f"Book {i}", stock=50) for i in range(4)]
    order_ids = [_buy(client, user, b, 5) for b in books]

    # Backdate the orders past the window; "this week" must mean this week.
    old = datetime.now(timezone.utc) - timedelta(days=40)
    for oid in order_ids:
        db_session.query(Order).filter(Order.id == oid).first().created_at = old
    db_session.commit()

    assert _shelf(client, limit=4, days=7)["basis"] == "rating"
    # Widen the window and the same orders count again.
    assert _shelf(client, limit=4, days=90)["basis"] == "sales"


# ----- shape and guards -----

def test_items_carry_everything_a_card_needs(client, make_book):
    make_book(title="A Book")
    item = _shelf(client, limit=1)["items"][0]
    for field in ("id", "title", "author", "price", "rating", "stock", "category", "badge"):
        assert field in item, f"{field} missing — the card renders it"


def test_the_category_name_is_included(client, make_book):
    """Clients used to fetch the whole category list separately to resolve this."""
    make_book(title="A Book")
    assert _shelf(client, limit=1)["items"][0]["category"] == "TestCat"


def test_the_shelf_is_cacheable(client, make_book):
    make_book(title="A Book")
    res = client.get("/api/catalog/trending?limit=1")
    assert "max-age" in res.headers.get("cache-control", "")


def test_the_shelf_is_public(client, make_book):
    make_book(title="A Book")
    assert client.get("/api/catalog/trending").status_code == 200


@pytest.mark.parametrize("params", ["days=0", "days=500", "limit=0", "limit=100"])
def test_absurd_parameters_are_rejected(client, params):
    assert client.get(f"/api/catalog/trending?{params}").status_code == 400


def test_an_empty_catalogue_returns_an_empty_shelf(client):
    shelf = _shelf(client, limit=4)
    assert shelf["items"] == []
    assert shelf["basis"] == "rating"


def test_out_of_stock_books_are_not_in_the_rating_fallback(client, make_book):
    """The shelf is a buying prompt; an unbuyable book wastes the slot."""
    make_book(title="Sold Out", stock=0)
    make_book(title="Available", stock=3)

    assert _titles(_shelf(client, limit=4)) == ["Available"]
