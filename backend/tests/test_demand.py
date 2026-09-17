"""What people are waiting for, and telling them when it arrives.

The loop this protects: a shopper hits an out-of-stock book, saves it, the shop sees
that demand ranked against everything else, restocks the top of the list, and
everyone waiting is told. Each step is worthless without the next — a waiting list
nobody reads, or a restock that notifies nobody, both leave the sale unmade.
"""

from decimal import Decimal

from app.core import job_handlers
from app.database.models.job import Job


def _wishlist(client, user, book):
    res = client.post(
        "/api/customer/wishlist/wishlistToggle",
        json={"book_id": str(book.id)},
        headers=user["headers"],
    )
    assert res.status_code == 200, res.text


def _demand(client, admin, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    res = client.get(
        "/api/admin/inventory/demand" + (f"?{query}" if query else ""),
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    return res.json()


# ----- the waiting list -----

def test_an_out_of_stock_book_someone_saved_shows_up(client, make_admin, make_customer, make_book):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Wanted Text", stock=0)
    _wishlist(client, user, book)

    body = _demand(client, admin)
    assert [i["title"] for i in body["items"]] == ["Wanted Text"]
    assert body["items"][0]["waiting"] == 1


def test_a_book_in_stock_is_not_on_the_list(client, make_admin, make_customer, make_book):
    """It does not need reordering; it needs selling."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Available Text", stock=5)
    _wishlist(client, user, book)

    assert _demand(client, admin)["items"] == []


def test_an_out_of_stock_book_nobody_wants_is_not_on_the_list(
    client, make_admin, make_book
):
    """Running out is only worth acting on when somebody is waiting."""
    admin = make_admin()
    make_book(title="Unwanted Text", stock=0)

    assert _demand(client, admin)["items"] == []


def test_the_most_wanted_comes_first(client, make_admin, make_customer, make_book):
    """The whole point: this is the reorder queue, not an alphabetical list."""
    admin = make_admin()
    quiet = make_book(title="One Person Wants This", stock=0)
    popular = make_book(title="Everyone Wants This", stock=0)

    _wishlist(client, make_customer(), quiet)
    for _ in range(3):
        _wishlist(client, make_customer(), popular)

    titles = [i["title"] for i in _demand(client, admin)["items"]]
    assert titles == ["Everyone Wants This", "One Person Wants This"]


def test_each_person_is_counted_once(client, make_admin, make_customer, make_book):
    """The toggle is idempotent per person; two clicks are not two customers."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Wanted Text", stock=0)

    _wishlist(client, user, book)   # on
    _wishlist(client, user, book)   # off
    _wishlist(client, user, book)   # on again

    assert _demand(client, admin)["items"][0]["waiting"] == 1


def test_removing_it_from_a_wishlist_removes_the_demand(
    client, make_admin, make_customer, make_book
):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Wanted Text", stock=0)
    _wishlist(client, user, book)
    _wishlist(client, user, book)  # toggled off

    assert _demand(client, admin)["items"] == []


def test_the_total_counts_everyone_waiting(client, make_admin, make_customer, make_book):
    admin = make_admin()
    a, b = make_book(title="A", stock=0), make_book(title="B", stock=0)
    _wishlist(client, make_customer(), a)
    _wishlist(client, make_customer(), a)
    _wishlist(client, make_customer(), b)

    assert _demand(client, admin)["total_waiting"] == 3


def test_used_copies_are_not_listed_separately(
    client, make_admin, make_customer, make_book, db_session
):
    """The thing to reorder is the title, not one of its second-hand variants."""
    admin, user = make_admin(), make_customer()
    parent = make_book(title="Course Text", stock=0)
    used = make_book(title="Course Text", stock=0)
    used.condition = "good"
    used.parent_book_id = parent.id
    db_session.commit()

    _wishlist(client, user, parent)
    _wishlist(client, user, used)

    assert len(_demand(client, admin)["items"]) == 1


def test_the_waiting_list_is_admin_only(client, make_customer):
    user = make_customer()
    assert client.get(
        "/api/admin/inventory/demand", headers=user["headers"]
    ).status_code == 403


def test_an_absurd_limit_is_rejected(client, make_admin):
    admin = make_admin()
    assert client.get(
        "/api/admin/inventory/demand?limit=5000", headers=admin["headers"]
    ).status_code == 400


# ----- restocking closes the loop -----

def test_restocking_a_wanted_book_queues_the_notice(
    client, make_admin, make_customer, make_book, db_session
):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Wanted Text", stock=0)
    _wishlist(client, user, book)

    client.post(
        f"/api/admin/inventory/books/{book.id}/restock",
        json={"add_stock": 5},
        headers=admin["headers"],
    )

    queued = db_session.query(Job).filter(Job.kind == "back_in_stock_email").all()
    assert len(queued) == 1
    assert queued[0].payload["book_id"] == str(book.id)


def test_everyone_waiting_is_told(client, make_admin, make_customer, make_book, db_session):
    admin = make_admin()
    watchers = [make_customer() for _ in range(3)]
    bystander = make_customer()
    book = make_book(title="Wanted Text", stock=0)
    for w in watchers:
        _wishlist(client, w, book)

    client.post(
        f"/api/admin/inventory/books/{book.id}/restock",
        json={"add_stock": 5},
        headers=admin["headers"],
    )
    job_handlers.back_in_stock_email(db_session, {"book_id": str(book.id)})

    for w in watchers:
        notes = client.get("/api/customer/notifications", headers=w["headers"]).json()
        assert any(n["title"] == "Back in stock" for n in notes), "a waiting customer was not told"

    ignored = client.get("/api/customer/notifications", headers=bystander["headers"]).json()
    assert not any(n["title"] == "Back in stock" for n in ignored)


def test_the_book_leaves_the_waiting_list_once_restocked(
    client, make_admin, make_customer, make_book
):
    """Otherwise the queue never empties and stops meaning anything."""
    admin, user = make_admin(), make_customer()
    book = make_book(title="Wanted Text", stock=0)
    _wishlist(client, user, book)
    assert len(_demand(client, admin)["items"]) == 1

    client.post(
        f"/api/admin/inventory/books/{book.id}/restock",
        json={"add_stock": 5},
        headers=admin["headers"],
    )

    assert _demand(client, admin)["items"] == []


def test_a_book_that_sells_out_again_returns_to_the_list(
    client, make_admin, make_customer, make_book, db_session
):
    admin, user = make_admin(), make_customer()
    book = make_book(title="Wanted Text", stock=1)
    _wishlist(client, user, book)

    book.stock = 0
    db_session.commit()

    assert len(_demand(client, admin)["items"]) == 1


# ----- a waiting book must not block the rest of the cart -----

def _add(client, user, book, qty=1):
    res = client.post(
        "/api/customer/cart/items",
        json={"book_id": str(book.id), "quantity": qty},
        headers=user["headers"],
    )
    assert res.status_code == 200, res.text


def test_an_out_of_stock_book_can_sit_in_the_cart(client, make_customer, make_book):
    """"Notify me" parks it there, so it is waiting when the restock lands."""
    user = make_customer()
    sold_out = make_book(title="Sold Out", stock=0)
    _add(client, user, sold_out)

    cart = client.get("/api/customer/cart", headers=user["headers"]).json()
    assert len(cart["items"]) == 1


def test_it_is_not_charged_for(client, make_customer, make_book):
    """The total shown has to be the total charged."""
    user = make_customer()
    available = make_book(title="Available", price="100.00", stock=5)
    sold_out = make_book(title="Sold Out", price="500.00", stock=0)
    _add(client, user, available)
    _add(client, user, sold_out)

    totals = client.get("/api/customer/cart", headers=user["headers"]).json()["totals"]
    assert Decimal(totals["subtotal"]) == Decimal("100.00")


def test_it_does_not_block_buying_everything_else(client, make_customer, make_book, db_session):
    """The failure this prevents: one book somebody is waiting for makes the whole
    cart un-checkoutable."""
    user = make_customer()
    available = make_book(title="Available", price="100.00", stock=5)
    sold_out = make_book(title="Sold Out", price="500.00", stock=0)
    _add(client, user, available)
    _add(client, user, sold_out)

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text

    ordered = [i["title_snapshot"] for i in res.json()["items"]]
    assert ordered == ["Available"]


def test_the_waiting_book_stays_in_the_cart_after_checkout(
    client, make_customer, make_book
):
    """It is still waiting for its restock notice; removing it would lose that."""
    user = make_customer()
    available = make_book(title="Available", price="100.00", stock=5)
    make_book(title="Filler", stock=5)
    sold_out = make_book(title="Sold Out", price="500.00", stock=0)
    _add(client, user, available)
    _add(client, user, sold_out)

    client.post("/api/customer/checkout", headers=user["headers"])

    cart = client.get("/api/customer/cart", headers=user["headers"]).json()
    assert [i["book"]["title"] for i in cart["items"]] == ["Sold Out"]


def test_a_cart_of_only_waiting_books_says_so(client, make_customer, make_book):
    user = make_customer()
    sold_out = make_book(title="Sold Out", stock=0)
    _add(client, user, sold_out)

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert "Sold Out" in detail
    assert "let you know" in detail.lower()


def test_a_partly_stocked_line_is_not_silently_reduced(
    client, make_customer, make_book, db_session
):
    """Ordering 1 of the 3 somebody asked for changes what they agreed to buy."""
    user = make_customer()
    other = make_book(title="Other", price="100.00", stock=5)
    scarce = make_book(title="Scarce", price="200.00", stock=3)
    _add(client, user, other)
    _add(client, user, scarce, 3)

    scarce.stock = 1
    db_session.commit()

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200
    assert [i["title_snapshot"] for i in res.json()["items"]] == ["Other"]

    db_session.expire_all()
    assert db_session.query(type(scarce)).filter_by(id=scarce.id).first().stock == 1
