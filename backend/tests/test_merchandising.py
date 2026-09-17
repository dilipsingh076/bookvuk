"""Badges must be earned, and product pages must lead somewhere.

The "Bestseller" ribbon used to be `hash(book.id) % 5 === 0` in the browser —
measured at 14 of 50 real books, assigned at random, shown to paying customers.
These tests are about the claim being true.
"""

import pytest

from app.core import merchandising


def _buy(client, user, book, qty):
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": qty}, headers=user["headers"])
    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _badge_for(client, book_id):
    return client.get(f"/api/catalog/books/{book_id}").json()["badge"]


# ----- the badge -----

def test_a_book_with_no_sales_is_not_a_bestseller(client, make_book):
    """The old logic would badge roughly a fifth of these regardless."""
    books = [make_book(title=f"Unsold {i}", stock=5) for i in range(10)]
    badges = [_badge_for(client, b.id) for b in books]
    assert badges == [None] * 10


def test_a_book_that_sells_earns_the_badge(client, make_customer, make_book):
    user = make_customer()
    book = make_book(title="Actually Sells", stock=50)
    _buy(client, user, book, merchandising.MIN_UNITS)

    assert _badge_for(client, book.id) == "Bestseller"


def test_one_or_two_sales_is_not_enough(client, make_customer, make_book):
    """At that volume the ranking is chance, so a badge would be noise."""
    user = make_customer()
    book = make_book(title="Barely Sold", stock=50)
    _buy(client, user, book, merchandising.MIN_UNITS - 1)

    assert _badge_for(client, book.id) is None


def test_cancelled_orders_do_not_earn_a_badge(client, make_customer, make_book):
    """Those units went back on the shelf and the money went back to the customer."""
    user = make_customer()
    book = make_book(title="Ordered Then Cancelled", stock=50)
    order_id = _buy(client, user, book, 10)
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    assert _badge_for(client, book.id) is None


def test_the_badge_appears_in_the_catalogue_listing_too(client, make_customer, make_book):
    user = make_customer()
    sold = make_book(title="Sold Book", stock=50)
    make_book(title="Unsold Book", stock=50)
    _buy(client, user, sold, 5)

    items = client.get("/api/catalog/books/paged?page_size=50").json()["items"]
    by_title = {i["title"]: i["badge"] for i in items}

    assert by_title["Sold Book"] == "Bestseller"
    assert by_title["Unsold Book"] is None


def test_the_badge_is_capped_so_it_stays_a_recommendation(client, make_customer, make_book):
    """A bestseller list the size of the catalogue is just the catalogue."""
    user = make_customer()
    books = [make_book(title=f"Seller {i}", stock=100) for i in range(merchandising.MAX_BESTSELLERS + 4)]
    for i, book in enumerate(books):
        _buy(client, user, book, merchandising.MIN_UNITS + i)

    items = client.get("/api/catalog/books/paged?page_size=50").json()["items"]
    badged = [i for i in items if i["badge"]]
    assert len(badged) == merchandising.MAX_BESTSELLERS


def test_the_badge_goes_to_the_strongest_sellers(client, make_customer, make_book):
    """When the cap bites, it must keep the top sellers and drop the weakest."""
    user = make_customer()
    books = [make_book(title=f"Seller {i}", stock=200) for i in range(merchandising.MAX_BESTSELLERS + 3)]
    # Ascending volume, so the last books created are the strongest sellers.
    for i, book in enumerate(books):
        _buy(client, user, book, merchandising.MIN_UNITS + i)

    weakest, strongest = books[0], books[-1]
    assert _badge_for(client, strongest.id) == "Bestseller"
    assert _badge_for(client, weakest.id) is None


def test_badges_are_not_recomputed_on_every_request(client, make_customer, make_book, db_session):
    """Same answer for every visitor, so it is cached; a stale window is fine but
    an uncached one would run a group-by per book card on the page."""
    user = make_customer()
    book = make_book(title="Cached", stock=50)
    _buy(client, user, book, 5)

    first = merchandising.bestseller_ids(db_session)
    # A new sale inside the TTL is deliberately not reflected yet.
    other = make_book(title="Later", stock=50)
    _buy(client, user, other, 9)

    assert merchandising.bestseller_ids(db_session) == first
    assert other.id in merchandising.bestseller_ids(db_session, force=True)


# ----- related books -----

def test_related_books_are_returned_for_a_valid_book(client, make_book):
    target = make_book(title="The Target")
    make_book(title="Another In Category")

    res = client.get(f"/api/catalog/books/{target.id}/related")
    assert res.status_code == 200, res.text
    assert len(res.json()) >= 1


def test_a_book_is_never_related_to_itself(client, make_book):
    target = make_book(title="The Target")
    make_book(title="Something Else")

    ids = [b["id"] for b in client.get(f"/api/catalog/books/{target.id}/related").json()]
    assert str(target.id) not in ids


def test_the_same_author_comes_first(client, make_book):
    """"More by this author" is the strongest signal a bookshop has by default."""
    target = make_book(title="Target", author="Chosen Author")
    make_book(title="Category Sibling", author="Other Author")
    make_book(title="Same Author Book", author="Chosen Author")

    related = client.get(f"/api/catalog/books/{target.id}/related").json()
    assert related[0]["title"] == "Same Author Book"


def test_out_of_stock_books_are_not_suggested(client, make_book):
    """Suggesting something unbuyable wastes the slot."""
    target = make_book(title="Target")
    make_book(title="Sold Out Sibling", stock=0)
    make_book(title="Available Sibling", stock=4)

    titles = [b["title"] for b in client.get(f"/api/catalog/books/{target.id}/related").json()]
    assert "Available Sibling" in titles
    assert "Sold Out Sibling" not in titles


def test_related_respects_the_limit(client, make_book):
    target = make_book(title="Target")
    for i in range(8):
        make_book(title=f"Sibling {i}")

    assert len(client.get(f"/api/catalog/books/{target.id}/related?limit=3").json()) == 3


@pytest.mark.parametrize("limit", [0, -1, 25, 1000])
def test_an_absurd_limit_is_rejected(client, make_book, limit):
    target = make_book(title="Target")
    assert client.get(f"/api/catalog/books/{target.id}/related?limit={limit}").status_code == 400


def test_related_for_an_unknown_book_is_404(client):
    import uuid

    res = client.get(f"/api/catalog/books/{uuid.uuid4()}/related")
    assert res.status_code == 404


def test_related_is_public(client, make_book):
    """Cross-sell has to work for the visitor who has not signed in — that is the
    whole point of it being on a public product page."""
    target = make_book(title="Target")
    make_book(title="Sibling")

    assert client.get(f"/api/catalog/books/{target.id}/related").status_code == 200
