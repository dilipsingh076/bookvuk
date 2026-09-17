"""Buying used books from customers, and the store credit it pays out.

Two things are being protected here. One is arithmetic: an offer is money, so it
cannot be something the browser gets to name, and it cannot move after a seller has
accepted it. The other is that paying for a book and putting it on the shelf are a
single event — stock the shop never paid for, or a payment for a book that never
became sellable, are both wrong and both invisible until someone reconciles by hand.
"""

from decimal import Decimal

import pytest

from app.core import buyback as pricing
from app.core import wallet
from app.database.models.book import Book
from app.database.models.buyback import BuybackRequest
from app.database.models.wallet import WalletTransaction


# ----- pricing, as pure arithmetic -----

def test_the_offer_is_a_share_of_the_printed_price():
    # 20-30% by condition, per the shop's margin.
    assert pricing.quote_per_copy(Decimal("400"), "like_new") == Decimal("120.00")
    assert pricing.quote_per_copy(Decimal("400"), "good") == Decimal("100.00")
    assert pricing.quote_per_copy(Decimal("400"), "fair") == Decimal("80.00")


def test_a_better_condition_is_always_worth_more():
    offers = [pricing.quote_per_copy(Decimal("500"), c) for c in ("fair", "good", "like_new")]
    assert offers == sorted(offers)


def test_the_shelf_price_is_above_what_the_seller_was_paid():
    """The gap is the shop's margin. If this inverts, every sale loses money."""
    for condition in pricing.CONDITIONS:
        paid = pricing.quote_per_copy(Decimal("500"), condition)
        shelf = pricing.resale_price(Decimal("500"), condition)
        assert shelf > paid, f"{condition}: shelf {shelf} not above paid {paid}"


def test_the_shelf_price_undercuts_a_new_copy():
    """A used copy priced near new has no reason to exist."""
    for condition in pricing.CONDITIONS:
        assert pricing.resale_price(Decimal("500"), condition) < Decimal("500")


def test_quantity_multiplies_the_offer():
    one = pricing.quote(Decimal("400"), "good", 1)
    three = pricing.quote(Decimal("400"), "good", 3)
    assert three == one * 3


def test_a_book_worth_almost_nothing_gets_no_offer():
    """Below the minimum the paperwork costs more than the book, and a token offer
    reads as an insult rather than an offer."""
    assert pricing.quote_per_copy(Decimal("50"), "fair") == Decimal("0.00")


@pytest.mark.parametrize("bad", [Decimal("0"), Decimal("-100")])
def test_a_nonsense_printed_price_is_rejected(bad):
    with pytest.raises(pricing.BuybackError):
        pricing.quote_per_copy(bad, "good")


def test_an_absurd_printed_price_is_rejected():
    """Guards against a typo'd MRP turning into a large payout."""
    with pytest.raises(pricing.BuybackError):
        pricing.quote_per_copy(Decimal("90000"), "like_new")


def test_an_unknown_condition_is_rejected():
    with pytest.raises(pricing.BuybackError):
        pricing.quote_per_copy(Decimal("400"), "mint")


def test_the_breakdown_offers_every_condition():
    rows = pricing.quote_breakdown(Decimal("400"))
    assert [r["condition"] for r in rows] == list(pricing.CONDITIONS)
    assert all(r["description"] for r in rows), "each grade needs describing"


# ----- quoting through the API -----

def test_a_quote_needs_no_account(client, make_book):
    """Asking what a book is worth must not require signing up first."""
    book = make_book(title="Course Text", price="400.00")
    res = client.post("/api/buyback/quote", json={"book_id": str(book.id)})
    assert res.status_code == 200, res.text
    assert res.json()["can_sell"] is True


def test_a_catalogue_quote_uses_the_catalogue_price(client, make_book):
    """Not a price from the request body: the quote is money."""
    book = make_book(title="Course Text", price="400.00")
    res = client.post(
        "/api/buyback/quote",
        json={"book_id": str(book.id), "listed_price": "99999"},
    ).json()
    assert Decimal(res["listed_price"]) == Decimal("400.00")


def test_a_hand_entered_book_is_quoted_from_its_printed_price(client):
    res = client.post("/api/buyback/quote", json={"listed_price": "600"})
    assert res.status_code == 200
    assert Decimal(res.json()["listed_price"]) == Decimal("600")


def test_a_quote_needs_something_to_price(client):
    assert client.post("/api/buyback/quote", json={}).status_code == 422


def test_a_used_copy_cannot_be_the_basis_for_a_quote(client, make_book, db_session):
    """Its discounted shelf price is not the printed price."""
    parent = make_book(title="Course Text", price="400.00")
    used = make_book(title="Course Text", price="200.00")
    used.condition = "good"
    used.parent_book_id = parent.id
    db_session.commit()

    res = client.post("/api/buyback/quote", json={"book_id": str(used.id)})
    assert res.status_code == 400
    assert "used copy" in res.json()["detail"].lower()


def test_conditions_are_described_by_the_server(client):
    """One source of wording, so the seller's form and the grading screen cannot
    describe the same word differently."""
    body = client.get("/api/buyback/conditions").json()
    assert [c["value"] for c in body["conditions"]] == list(pricing.CONDITIONS)
    assert all(c["description"] for c in body["conditions"])


def test_conditions_report_the_open_request_cap(client):
    """The seller's form needs the cap before the seller does any work.

    It used to live only in this module, so the form could not warn anyone and the
    ten-request limit was discovered by being refused at the end. Reported here
    rather than copied into the frontend, where it would be free to drift.
    """
    from app.api.routes.buyback import MAX_OPEN_REQUESTS

    body = client.get("/api/buyback/conditions").json()
    assert body["max_open_requests"] == MAX_OPEN_REQUESTS


# ----- submitting -----

def _submit(client, user, **over):
    payload = {
        "title": "Hand Entered Book",
        "listed_price": "500",
        "condition": "good",
        "quantity": 1,
        "payout_method": "wallet",
        **over,
    }
    return client.post("/api/buyback", json=payload, headers=user["headers"])


def test_submitting_stores_the_offer_as_a_snapshot(client, make_customer, db_session):
    """A later change to the rates must not move an offer already given."""
    user = make_customer()
    res = _submit(client, user, listed_price="500", condition="good")
    assert res.status_code == 201, res.text

    body = res.json()
    assert Decimal(body["quoted_amount"]) == Decimal("125.00")  # 25% of 500
    assert body["status"] == "submitted"

    row = db_session.query(BuybackRequest).filter(BuybackRequest.id == body["id"]).first()
    assert Decimal(row.quoted_amount) == Decimal("125.00")


def test_the_offer_is_recomputed_not_taken_from_the_client(client, make_customer):
    """Otherwise a browser names its own payout."""
    user = make_customer()
    body = _submit(client, user, listed_price="500", condition="fair").json()
    assert Decimal(body["quoted_amount"]) == Decimal("100.00")  # 20% of 500, not anything sent


def test_submitting_requires_an_account(client):
    assert _submit(client, {"headers": {}}).status_code == 401


def test_a_hand_entered_book_needs_a_title_and_price(client, make_customer):
    user = make_customer()
    assert client.post(
        "/api/buyback",
        json={"condition": "good", "payout_method": "wallet"},
        headers=user["headers"],
    ).status_code == 422


def test_a_bank_payout_needs_somewhere_to_send_it(client, make_customer):
    user = make_customer()
    res = _submit(client, user, payout_method="bank")
    assert res.status_code == 422


def test_a_bank_payout_with_a_upi_is_accepted(client, make_customer):
    user = make_customer()
    res = _submit(client, user, payout_method="bank", payout_upi="seller@upi")
    assert res.status_code == 201


def test_a_worthless_book_is_turned_down_at_submission(client, make_customer):
    user = make_customer()
    res = _submit(client, user, listed_price="50", condition="fair")
    assert res.status_code == 400
    assert "20" in res.json()["detail"]


def test_admins_are_told_about_a_new_offer(client, make_admin, make_customer):
    admin = make_admin()
    user = make_customer()
    _submit(client, user)

    notes = client.get("/api/admin/notifications", headers=admin["headers"]).json()
    assert any("buyback" in n["title"].lower() for n in notes)


def test_a_seller_cannot_flood_the_queue(client, make_customer):
    user = make_customer()
    for _ in range(10):
        assert _submit(client, user).status_code == 201
    res = _submit(client, user)
    assert res.status_code == 409


def test_a_seller_sees_only_their_own_requests(client, make_customer):
    mine, theirs = make_customer(), make_customer()
    _submit(client, mine)
    _submit(client, theirs)

    listed = client.get("/api/buyback", headers=mine["headers"]).json()
    assert len(listed) == 1


def test_a_seller_can_withdraw_before_payment(client, make_customer):
    user = make_customer()
    request_id = _submit(client, user).json()["id"]

    res = client.patch(f"/api/buyback/{request_id}/cancel", headers=user["headers"])
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


# ----- the shop's side -----

def _approved(client, admin, user, **over):
    request_id = _submit(client, user, **over).json()["id"]
    res = client.post(
        f"/api/admin/buyback/{request_id}/decision",
        json={"approve": True},
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    return request_id


def test_approving_tells_the_seller_to_send_it(client, make_admin, make_customer):
    admin, user = make_admin(), make_customer()
    _approved(client, admin, user)

    notes = client.get("/api/customer/notifications", headers=user["headers"]).json()
    assert any(n["title"] == "Buyback approved" for n in notes)


def test_a_rejection_must_come_with_a_reason(client, make_admin, make_customer):
    admin, user = make_admin(), make_customer()
    request_id = _submit(client, user).json()["id"]

    res = client.post(
        f"/api/admin/buyback/{request_id}/decision",
        json={"approve": False},
        headers=admin["headers"],
    )
    assert res.status_code == 422


def test_a_rejection_reaches_the_seller(client, make_admin, make_customer):
    admin, user = make_admin(), make_customer()
    request_id = _submit(client, user).json()["id"]

    client.post(
        f"/api/admin/buyback/{request_id}/decision",
        json={"approve": False, "rejection_reason": "Water damage on the photos."},
        headers=admin["headers"],
    )
    notes = client.get("/api/customer/notifications", headers=user["headers"]).json()
    assert any("water damage" in (n["body"] or "").lower() for n in notes)


def test_the_buyback_queue_is_admin_only(client, make_customer):
    user = make_customer()
    assert client.get("/api/admin/buyback", headers=user["headers"]).status_code == 403


def test_receiving_a_downgraded_book_lowers_the_payout(client, make_admin, make_customer):
    """The whole point of grading on arrival: the shop must not pay for a condition
    nobody checked."""
    admin, user = make_admin(), make_customer()
    request_id = _approved(client, admin, user, listed_price="500", condition="like_new")

    res = client.post(
        f"/api/admin/buyback/{request_id}/receive",
        json={"received_condition": "fair"},
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert Decimal(body["quoted_amount"]) == Decimal("150.00")   # 30% claimed
    assert Decimal(body["final_amount"]) == Decimal("100.00")    # 20% actual


def test_the_seller_is_told_when_the_grade_changed(client, make_admin, make_customer):
    admin, user = make_admin(), make_customer()
    request_id = _approved(client, admin, user, condition="like_new")
    client.post(
        f"/api/admin/buyback/{request_id}/receive",
        json={"received_condition": "fair"},
        headers=admin["headers"],
    )
    notes = client.get("/api/customer/notifications", headers=user["headers"]).json()
    assert any("rather than" in (n["body"] or "") for n in notes)


def test_a_book_cannot_be_paid_for_before_it_arrives(client, make_admin, make_customer, make_book):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    request_id = _approved(client, admin, user, book_id=str(book.id), title=None, listed_price=None)

    res = client.post(
        f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"]
    )
    assert res.status_code == 409
    assert "receive" in res.json()["detail"].lower()


# ----- paying, and the copy reaching the shelf -----

def _through_to_received(client, admin, user, book, condition="good"):
    request_id = _approved(
        client, admin, user, book_id=str(book.id), title=None, listed_price=None,
        condition=condition,
    )
    client.post(
        f"/api/admin/buyback/{request_id}/receive",
        json={"received_condition": condition},
        headers=admin["headers"],
    )
    return request_id


def test_paying_puts_a_used_copy_on_the_shelf(client, make_admin, make_customer, make_book, db_session):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    request_id = _through_to_received(client, admin, user, book)

    res = client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])
    assert res.status_code == 200, res.text

    used = (
        db_session.query(Book)
        .filter(Book.parent_book_id == book.id, Book.condition == "good")
        .first()
    )
    assert used is not None, "no used copy was created"
    assert used.stock == 1
    assert Decimal(used.price) == pricing.resale_price(Decimal("400.00"), "good")
    assert used.title == book.title


def test_the_used_copy_is_buyable_like_anything_else(client, make_admin, make_customer, make_book, db_session):
    """The point of modelling it as a book row: cart, stock locking and checkout
    need no special case."""
    admin, seller, buyer = make_admin(), make_customer(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    request_id = _through_to_received(client, admin, seller, book)
    client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])

    used = db_session.query(Book).filter(Book.parent_book_id == book.id).first()

    added = client.post(
        "/api/customer/cart/items",
        json={"book_id": str(used.id), "quantity": 1},
        headers=buyer["headers"],
    )
    assert added.status_code == 200, added.text
    order = client.post("/api/customer/checkout", headers=buyer["headers"])
    assert order.status_code == 200, order.text

    db_session.expire_all()
    assert db_session.query(Book).filter(Book.id == used.id).first().stock == 0


def test_a_second_copy_adds_stock_rather_than_a_duplicate_listing(
    client, make_admin, make_customer, make_book, db_session
):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")

    for _ in range(2):
        request_id = _through_to_received(client, admin, user, book)
        client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])

    rows = (
        db_session.query(Book)
        .filter(Book.parent_book_id == book.id, Book.condition == "good")
        .all()
    )
    assert len(rows) == 1, "a second Good copy created a duplicate listing"
    assert rows[0].stock == 2


def test_different_conditions_are_separate_listings(
    client, make_admin, make_customer, make_book, db_session
):
    """A Good copy and a Fair copy are different products at different prices."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")

    for condition in ("good", "fair"):
        request_id = _through_to_received(client, admin, user, book, condition=condition)
        client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])

    rows = db_session.query(Book).filter(Book.parent_book_id == book.id).all()
    assert {r.condition for r in rows} == {"good", "fair"}


def test_paying_twice_does_not_double_the_stock_or_the_credit(
    client, make_admin, make_customer, make_book, db_session
):
    """A double-clicked payout button must not pay twice."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    request_id = _through_to_received(client, admin, user, book)

    client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])
    client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])

    db_session.expire_all()
    used = db_session.query(Book).filter(Book.parent_book_id == book.id).first()
    assert used.stock == 1
    assert wallet.balance(db_session, user["id"]) == Decimal("100.00")  # 25% of 400, once


def test_a_hand_entered_book_needs_a_catalogue_home_before_payout(
    client, make_admin, make_customer
):
    """There is nothing to file the used copy under until an admin says."""
    admin, user = make_admin(), make_customer()
    request_id = _approved(client, admin, user, listed_price="500")
    client.post(
        f"/api/admin/buyback/{request_id}/receive",
        json={"received_condition": "good"},
        headers=admin["headers"],
    )

    res = client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])
    assert res.status_code == 400
    assert "catalogue title" in res.json()["detail"].lower()


def test_a_hand_entered_book_can_be_filed_under_a_chosen_title(
    client, make_admin, make_customer, make_book, db_session
):
    admin, user = make_admin(), make_customer()
    home = make_book(title="Course Text", price="500.00")
    request_id = _approved(client, admin, user, listed_price="500")
    client.post(
        f"/api/admin/buyback/{request_id}/receive",
        json={"received_condition": "good"},
        headers=admin["headers"],
    )

    res = client.post(
        f"/api/admin/buyback/{request_id}/pay",
        json={"parent_book_id": str(home.id)},
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    assert db_session.query(Book).filter(Book.parent_book_id == home.id).count() == 1


def test_a_bank_payout_requires_its_reference(client, make_admin, make_customer, make_book):
    """The UTR is the only record that the money actually moved."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    request_id = _approved(
        client, admin, user, book_id=str(book.id), title=None, listed_price=None,
        payout_method="bank", payout_upi="seller@upi",
    )
    client.post(
        f"/api/admin/buyback/{request_id}/receive",
        json={"received_condition": "good"},
        headers=admin["headers"],
    )

    res = client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])
    assert res.status_code == 400
    assert "utr" in res.json()["detail"].lower() or "reference" in res.json()["detail"].lower()


def test_a_bank_payout_credits_no_wallet(client, make_admin, make_customer, make_book, db_session):
    """Money went to their bank; crediting the wallet too would pay twice."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    request_id = _approved(
        client, admin, user, book_id=str(book.id), title=None, listed_price=None,
        payout_method="bank", payout_upi="seller@upi",
    )
    client.post(
        f"/api/admin/buyback/{request_id}/receive",
        json={"received_condition": "good"},
        headers=admin["headers"],
    )
    client.post(
        f"/api/admin/buyback/{request_id}/pay",
        json={"payout_reference": "UTR123456"},
        headers=admin["headers"],
    )

    assert wallet.balance(db_session, user["id"]) == Decimal("0.00")


# ----- used copies must not duplicate their parent in listings -----

def _shelve_used(client, admin, user, book, condition="good"):
    """Put one used copy of `book` on the shelf and return it."""
    request_id = _through_to_received(client, admin, user, book, condition=condition)
    client.post(f"/api/admin/buyback/{request_id}/pay", json={}, headers=admin["headers"])


def test_a_used_copy_does_not_appear_twice_in_search(
    client, make_admin, make_customer, make_book
):
    """Searching "2 States" returned the same title twice at two prices."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Unique Searchable Title", price="400.00")
    _shelve_used(client, admin, user, book)

    body = client.get("/api/catalog/books/paged", params={"q": "Unique Searchable"}).json()
    assert body["meta"]["total"] == 1, [i["price"] for i in body["items"]]


def test_used_copies_are_absent_from_the_catalogue_listing(
    client, make_admin, make_customer, make_book
):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Catalogue Title", price="400.00")
    _shelve_used(client, admin, user, book)

    items = client.get("/api/catalog/books/paged?page_size=50").json()["items"]
    assert all(i["condition"] == "new" for i in items)


def test_used_stock_has_its_own_view(client, make_admin, make_customer, make_book):
    """`condition=used` is the bargain-hunting list."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Catalogue Title", price="400.00")
    _shelve_used(client, admin, user, book)

    items = client.get("/api/catalog/books/paged?condition=used&page_size=50").json()["items"]
    assert len(items) == 1
    assert items[0]["condition"] == "good"


def test_an_unknown_condition_filter_is_rejected(client):
    assert client.get("/api/catalog/books/paged?condition=mint").status_code == 400


def test_the_product_page_lists_the_used_copies(client, make_admin, make_customer, make_book):
    """This is where a buyer chooses between new and cheaper used."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    _shelve_used(client, admin, user, book, condition="good")
    _shelve_used(client, admin, user, book, condition="fair")

    res = client.get(f"/api/catalog/books/{book.id}/used")
    assert res.status_code == 200, res.text
    rows = res.json()
    assert {r["condition"] for r in rows} == {"good", "fair"}
    # Cheapest first: the saving is the reason to look.
    prices = [Decimal(r["price"]) for r in rows]
    assert prices == sorted(prices)


def test_used_copies_out_of_stock_are_not_offered(
    client, make_admin, make_customer, make_book, db_session
):
    """An unbuyable option looks like a price the shop refuses to honour."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    _shelve_used(client, admin, user, book)

    used = db_session.query(Book).filter(Book.parent_book_id == book.id).first()
    used.stock = 0
    db_session.commit()

    assert client.get(f"/api/catalog/books/{book.id}/used").json() == []


def test_asking_a_used_copy_for_used_copies_gives_its_siblings(
    client, make_admin, make_customer, make_book, db_session
):
    """Landing on a used copy's own page must still show the alternatives."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    _shelve_used(client, admin, user, book, condition="good")
    used = db_session.query(Book).filter(Book.parent_book_id == book.id).first()

    rows = client.get(f"/api/catalog/books/{used.id}/used").json()
    assert len(rows) == 1


def test_related_books_do_not_offer_used_copies(
    client, make_admin, make_customer, make_book
):
    """A used copy of a neighbouring title is not a different book."""
    admin, user = make_admin(), make_customer()
    target = make_book(title="The Target", price="400.00")
    sibling = make_book(title="A Sibling", price="400.00")
    _shelve_used(client, admin, user, sibling)

    rows = client.get(f"/api/catalog/books/{target.id}/related").json()
    assert all(r["condition"] == "new" for r in rows)


def test_the_trending_fallback_skips_used_copies(client, make_admin, make_customer, make_book):
    """Used copies inherit the parent's rating, so a "highest rated" shelf would
    show the same title twice."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Course Text", price="400.00")
    _shelve_used(client, admin, user, book)

    items = client.get("/api/catalog/trending?limit=4").json()["items"]
    assert all(i["condition"] == "new" for i in items)
