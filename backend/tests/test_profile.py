"""Profile: renaming, username uniqueness, and password change.

Before this existed the Profile page showed "updated successfully" while saving
nothing, so these tests are as much about the claim being true as about the code.
"""

from app.database.db import SessionLocal
from app.database.models.refresh_token import RefreshToken
from app.database.models.user import User


def test_profile_requires_a_signed_in_user(client):
    assert client.get("/api/profile").status_code == 401


def test_profile_returns_the_current_account(client, make_customer):
    user = make_customer()
    res = client.get("/api/profile", headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email"] == user["email"]
    assert body["role"] == "customer"


def test_admins_can_read_their_profile_too(client, make_admin):
    """The page is not customer-only, so the endpoint must not be either."""
    admin = make_admin()
    res = client.get("/api/profile", headers=admin["headers"])
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_renaming_persists(client, make_customer, db_session):
    user = make_customer()
    res = client.patch("/api/profile", json={"full_name": "Renamed Person"},
                       headers=user["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["full_name"] == "Renamed Person"

    # The point of the fix: it is actually stored.
    row = db_session.query(User).filter(User.email == user["email"]).first()
    assert row.full_name == "Renamed Person"


def test_a_partial_update_does_not_blank_other_fields(client, make_customer, db_session):
    user = make_customer()
    before = client.get("/api/profile", headers=user["headers"]).json()

    client.patch("/api/profile", json={"full_name": "Only Name"}, headers=user["headers"])

    after = client.get("/api/profile", headers=user["headers"]).json()
    assert after["username"] == before["username"]
    assert after["email"] == before["email"]


def test_username_can_be_changed(client, make_customer):
    user = make_customer()
    res = client.patch("/api/profile", json={"username": "freshhandle"},
                       headers=user["headers"])
    assert res.status_code == 200
    assert res.json()["username"] == "freshhandle"


def test_a_taken_username_is_rejected(client, make_customer):
    first, second = make_customer(), make_customer()
    taken = client.get("/api/profile", headers=first["headers"]).json()["username"]

    res = client.patch("/api/profile", json={"username": taken}, headers=second["headers"])
    assert res.status_code == 400
    assert "already taken" in res.json()["detail"].lower()


def test_keeping_your_own_username_is_not_a_conflict(client, make_customer):
    user = make_customer()
    mine = client.get("/api/profile", headers=user["headers"]).json()["username"]
    res = client.patch("/api/profile", json={"username": mine}, headers=user["headers"])
    assert res.status_code == 200


def test_email_and_role_cannot_be_changed_here(client, make_customer):
    """Email is the login identity and role is a privilege — neither is editable."""
    user = make_customer()
    before = client.get("/api/profile", headers=user["headers"]).json()

    client.patch(
        "/api/profile",
        json={"email": "attacker@bookvuk.com", "role": "admin", "full_name": "X"},
        headers=user["headers"],
    )

    after = client.get("/api/profile", headers=user["headers"]).json()
    assert after["email"] == before["email"]
    assert after["role"] == "customer"


# ----- password change -----

def test_password_change_requires_the_current_password(client, make_customer):
    user = make_customer()
    res = client.post(
        "/api/profile/password",
        json={"current_password": "not-it", "new_password": "BrandNewPass1!"},
        headers=user["headers"],
    )
    assert res.status_code == 400
    assert "not correct" in res.json()["detail"].lower()


def test_password_change_works_and_the_old_password_stops_working(client, make_customer):
    user = make_customer()
    res = client.post(
        "/api/profile/password",
        json={"current_password": user["password"], "new_password": "BrandNewPass1!"},
        headers=user["headers"],
    )
    assert res.status_code == 200, res.text

    assert client.post("/auth/login",
                       data={"username": user["email"], "password": user["password"]}).status_code == 401
    assert client.post("/auth/login",
                       data={"username": user["email"], "password": "BrandNewPass1!"}).status_code == 200


def test_password_change_rejects_reusing_the_same_password(client, make_customer):
    user = make_customer()
    res = client.post(
        "/api/profile/password",
        json={"current_password": user["password"], "new_password": user["password"]},
        headers=user["headers"],
    )
    assert res.status_code == 400
    assert "different" in res.json()["detail"].lower()


def test_password_change_rejects_a_short_password(client, make_customer):
    user = make_customer()
    res = client.post(
        "/api/profile/password",
        json={"current_password": user["password"], "new_password": "short"},
        headers=user["headers"],
    )
    assert res.status_code == 422


def test_password_change_revokes_other_sessions(client, make_customer):
    """A password change is how you lock out whoever else is signed in."""
    user = make_customer()
    other = client.post("/auth/login",
                        data={"username": user["email"], "password": user["password"]}).json()

    client.post(
        "/api/profile/password",
        json={"current_password": user["password"], "new_password": "BrandNewPass1!"},
        headers=user["headers"],
    )

    # The other device can no longer refresh.
    assert client.post("/auth/refresh",
                       json={"refresh_token": other["refresh_token"]}).status_code == 401


def test_password_change_keeps_the_current_device_signed_in(client, make_customer):
    """It returns a fresh pair, so changing your password is not a self-logout."""
    user = make_customer()
    res = client.post(
        "/api/profile/password",
        json={"current_password": user["password"], "new_password": "BrandNewPass1!"},
        headers=user["headers"],
    ).json()

    assert res["access_token"] and res["refresh_token"]
    # The returned pair works...
    assert client.post("/auth/refresh",
                       json={"refresh_token": res["refresh_token"]}).status_code == 200
    # ...and the old one does not.
    assert client.post("/auth/refresh",
                       json={"refresh_token": user["refresh_token"]}).status_code == 401


def test_only_the_new_refresh_token_survives(client, make_customer, db_session):
    user = make_customer()
    client.post(
        "/api/profile/password",
        json={"current_password": user["password"], "new_password": "BrandNewPass1!"},
        headers=user["headers"],
    )

    with SessionLocal() as s:
        row = s.query(User).filter(User.email == user["email"]).first()
        live = (
            s.query(RefreshToken)
            .filter(RefreshToken.user_id == row.id, RefreshToken.revoked_at.is_(None))
            .count()
        )
        assert live == 1


# ----- sales trend (replaced a hardcoded chart) -----

def test_sales_trend_is_admin_only(client, make_customer):
    user = make_customer()
    assert client.get("/api/admin/sales-trend", headers=user["headers"]).status_code == 403


def test_sales_trend_returns_a_continuous_series(client, make_admin):
    """Quiet days must appear as zeros, not be missing from the axis."""
    admin = make_admin()
    res = client.get("/api/admin/sales-trend?days=7", headers=admin["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["series"]) == 7
    assert all("units" in p and "label" in p for p in body["series"])


def test_sales_trend_counts_units_sold(client, make_admin, make_customer, make_book):
    admin = make_admin()
    user, book = make_customer(), make_book(stock=10)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 3}, headers=user["headers"])
    client.post("/api/customer/checkout", headers=user["headers"])

    body = client.get("/api/admin/sales-trend?days=7", headers=admin["headers"]).json()
    assert body["total"] == 3
    assert body["series"][-1]["units"] == 3  # today


def test_cancelled_orders_are_excluded(client, make_admin, make_customer, make_book):
    """Those units went back into stock, so counting them would overstate sales."""
    admin = make_admin()
    user, book = make_customer(), make_book(stock=10)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 2}, headers=user["headers"])
    order_id = client.post("/api/customer/checkout", headers=user["headers"]).json()["id"]
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    body = client.get("/api/admin/sales-trend?days=7", headers=admin["headers"]).json()
    assert body["total"] == 0


def test_sales_trend_rejects_an_absurd_window(client, make_admin):
    admin = make_admin()
    assert client.get("/api/admin/sales-trend?days=9999", headers=admin["headers"]).status_code == 400
