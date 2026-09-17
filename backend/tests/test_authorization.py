"""Role enforcement and per-user data isolation."""

import pytest

ADMIN_READ_ROUTES = [
    "/api/admin/overview",
    "/api/admin/orders",
    "/api/admin/authors",
    "/api/admin/notifications",
]


@pytest.mark.parametrize("path", ADMIN_READ_ROUTES)
def test_customer_cannot_reach_admin_routes(client, make_customer, path):
    user = make_customer()
    assert client.get(path, headers=user["headers"]).status_code == 403


@pytest.mark.parametrize("path", ADMIN_READ_ROUTES)
def test_anonymous_cannot_reach_admin_routes(client, path):
    assert client.get(path).status_code == 401


def test_admin_can_reach_admin_routes(client, make_admin):
    admin = make_admin()
    for path in ADMIN_READ_ROUTES:
        res = client.get(path, headers=admin["headers"])
        assert res.status_code == 200, f"{path} -> {res.status_code} {res.text[:120]}"


def test_admin_cannot_use_customer_only_routes(client, make_admin):
    """require_role is an exact match, so an admin is not implicitly a customer."""
    admin = make_admin()
    assert client.get("/api/customer/cart", headers=admin["headers"]).status_code == 403


def test_admin_write_routes_reject_customers(client, make_customer, make_book):
    user = make_customer()
    book = make_book()
    assert client.delete(f"/api/admin/books/{book.id}", headers=user["headers"]).status_code == 403
    assert client.post(
        "/api/admin/categories", json={"name": "Nope"}, headers=user["headers"]
    ).status_code == 403


def test_a_customer_cannot_read_another_customers_order(client, make_customer, make_book):
    """Object-level authorisation: order ids must not be guessable across users."""
    book = make_book(stock=5)
    owner = make_customer()
    other = make_customer()

    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=owner["headers"])
    placed = client.post("/api/customer/checkout", headers=owner["headers"])
    assert placed.status_code == 200, placed.text
    order_id = placed.json()["id"]

    assert client.get(f"/api/customer/orders/{order_id}", headers=owner["headers"]).status_code == 200
    assert client.get(f"/api/customer/orders/{order_id}", headers=other["headers"]).status_code == 404


def test_a_customer_cannot_cancel_another_customers_order(client, make_customer, make_book):
    book = make_book(stock=5)
    owner = make_customer()
    other = make_customer()

    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=owner["headers"])
    order_id = client.post("/api/customer/checkout", headers=owner["headers"]).json()["id"]

    res = client.patch(f"/api/customer/orders/{order_id}/cancel", headers=other["headers"])
    assert res.status_code == 404


def test_carts_are_isolated_per_user(client, make_customer, make_book):
    book = make_book(stock=10)
    a = make_customer()
    b = make_customer()

    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 2}, headers=a["headers"])

    assert len(client.get("/api/customer/cart", headers=a["headers"]).json()["items"]) == 1
    assert client.get("/api/customer/cart", headers=b["headers"]).json()["items"] == []


def test_notifications_are_isolated_per_user(client, make_customer, make_book):
    book = make_book(stock=5)
    a = make_customer()
    b = make_customer()

    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 1}, headers=a["headers"])
    client.post("/api/customer/checkout", headers=a["headers"])

    assert len(client.get("/api/customer/notifications", headers=a["headers"]).json()) >= 1
    assert client.get("/api/customer/notifications", headers=b["headers"]).json() == []


# ----- a disabled account -----
#
# `User.is_active` existed, the admin screen showed "account disabled" against
# it, and nothing anywhere read it: a disabled customer could sign in and shop
# as normal, and an account disabled mid-session carried on working. The switch
# in the admin did nothing at all.


def _disable(user_id):
    from app.database.db import SessionLocal
    from app.database.models.user import User

    with SessionLocal() as s:
        s.query(User).filter(User.id == user_id).update({"is_active": False})
        s.commit()


def test_a_disabled_account_cannot_sign_in(client, make_customer):
    user = make_customer()
    _disable(user["id"])

    res = client.post("/auth/login", data={"username": user["email"], "password": user["password"]})
    assert res.status_code == 403, res.text
    assert "disabled" in res.json()["detail"].lower()


def test_the_reason_is_only_given_once_the_password_is_right(client, make_customer):
    """Saying "disabled" to anyone who types an address would confirm it exists."""
    user = make_customer()
    _disable(user["id"])

    res = client.post("/auth/login", data={"username": user["email"], "password": "wrong-password"})
    assert res.status_code == 401
    assert "disabled" not in res.json()["detail"].lower()


def test_a_token_issued_before_the_account_was_disabled_stops_working(client, make_customer):
    """Not in thirty minutes when it expires — now.

    This is the reason `get_current_user` reads the row at all: the token already
    carries the id and the role, so without this check the query would only be
    catching deleted accounts.
    """
    user = make_customer()
    assert client.get("/api/customer/cart", headers=user["headers"]).status_code == 200

    _disable(user["id"])

    res = client.get("/api/customer/cart", headers=user["headers"])
    # 401 so the client treats it as a dead session and signs them out, rather
    # than leaving them on a page where every request quietly fails.
    assert res.status_code == 401, res.text


def test_an_active_account_is_unaffected(client, make_customer):
    user = make_customer()
    assert client.get("/api/customer/cart", headers=user["headers"]).status_code == 200
    login = client.post("/auth/login", data={"username": user["email"], "password": user["password"]})
    assert login.status_code == 200, login.text
