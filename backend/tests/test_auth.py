"""Auth: registration validation, login, token types, refresh."""

from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.core.config import settings
from tests.conftest import unique_email


def test_register_returns_access_and_refresh_tokens(client):
    email = unique_email()
    res = client.post("/auth/register", json={
        "email": email, "username": "someuser",
        "full_name": "Some User", "password": "Passw0rd!23",
    })
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]
    assert body["access_token"] != body["refresh_token"]
    assert body["user"]["email"] == email
    assert body["user"]["role"] == "customer"


def test_register_always_creates_a_customer_never_an_admin(client):
    """Role must not be settable by the client."""
    email = unique_email()
    res = client.post("/auth/register", json={
        "email": email, "username": "sneaky",
        "password": "Passw0rd!23", "role": "admin",
    })
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "customer"


@pytest.mark.parametrize("password", ["", "short", "1234567"])
def test_register_rejects_passwords_under_eight_characters(client, password):
    res = client.post("/auth/register", json={
        "email": unique_email(), "username": "shortpw", "password": password,
    })
    assert res.status_code == 422


def test_register_rejects_duplicate_email(client, make_customer):
    existing = make_customer()
    res = client.post("/auth/register", json={
        "email": existing["email"], "username": "dupe", "password": "Passw0rd!23",
    })
    assert res.status_code == 400
    assert "already registered" in res.json()["detail"].lower()


def test_login_with_wrong_password_is_401(client, make_customer):
    user = make_customer()
    res = client.post("/auth/login", data={"username": user["email"], "password": "wrong-password"})
    assert res.status_code == 401


def test_login_with_unknown_email_is_401(client):
    res = client.post("/auth/login", data={"username": unique_email(), "password": "whatever12"})
    assert res.status_code == 401


def test_password_is_not_stored_in_plaintext(make_customer, db_session):
    from app.database.models.user import User

    user = make_customer(password="Sup3rSecret!")
    row = db_session.query(User).filter(User.email == user["email"]).first()
    assert row.password_hash != "Sup3rSecret!"
    assert row.password_hash.startswith("$argon2")


def test_protected_route_requires_a_token(client):
    assert client.get("/api/customer/cart").status_code == 401


def test_refresh_token_cannot_be_used_as_an_access_token(client, make_customer):
    """Token confusion: a long-lived refresh token must not authorise requests."""
    user = make_customer()
    res = client.get("/api/customer/cart", headers={"Authorization": f"Bearer {user['refresh_token']}"})
    assert res.status_code == 401


def test_access_token_cannot_be_used_to_refresh(client, make_customer):
    user = make_customer()
    res = client.post("/auth/refresh", json={"refresh_token": user["access_token"]})
    assert res.status_code == 401


def test_refresh_returns_a_working_access_token(client, make_customer):
    user = make_customer()
    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 200, res.text
    new_token = res.json()["access_token"]
    assert res.json()["token_type"] == "bearer"

    cart = client.get("/api/customer/cart", headers={"Authorization": f"Bearer {new_token}"})
    assert cart.status_code == 200


def test_token_signed_with_a_different_secret_is_rejected(client):
    """A forged token (e.g. signed with a leaked example key) must not be accepted."""
    forged = jwt.encode(
        {
            "user_id": "00000000-0000-0000-0000-000000000001",
            "role": "admin",
            "typ": "access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
        algorithm="HS256",
    )
    res = client.get("/api/admin/overview", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_expired_access_token_is_rejected(client, make_customer):
    user = make_customer()
    expired = jwt.encode(
        {
            "user_id": user["user"]["id"],
            "role": "customer",
            "typ": "access",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    res = client.get("/api/customer/cart", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401


def test_token_without_type_claim_is_rejected(client, make_customer):
    """Tokens minted before `typ` existed must not be silently trusted."""
    user = make_customer()
    legacy = jwt.encode(
        {
            "user_id": user["user"]["id"],
            "role": "customer",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    res = client.get("/api/customer/cart", headers={"Authorization": f"Bearer {legacy}"})
    assert res.status_code == 401


def test_refresh_fails_after_the_user_is_deleted(client, make_customer, db_session):
    from app.database.models.user import User

    user = make_customer()
    db_session.query(User).filter(User.email == user["email"]).delete()
    db_session.commit()

    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 401
