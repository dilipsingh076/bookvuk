"""Refresh tokens are recorded server-side so they can actually be revoked."""

from datetime import datetime, timedelta, timezone

from app.database.models.refresh_token import RefreshToken


def test_issuing_tokens_records_the_refresh_token(make_customer, db_session):
    user = make_customer()
    rows = db_session.query(RefreshToken).all()
    assert len(rows) == 1
    assert rows[0].revoked_at is None
    # The token string itself must never be stored.
    assert user["refresh_token"] not in (rows[0].jti,)
    assert len(rows[0].jti) <= 64


def test_login_issues_an_additional_refresh_token(client, make_customer, db_session):
    """Signing in on a second device must not invalidate the first."""
    user = make_customer()
    res = client.post("/auth/login", data={"username": user["email"], "password": user["password"]})
    assert res.status_code == 200
    second = res.json()["refresh_token"]

    assert db_session.query(RefreshToken).count() == 2
    for token in (user["refresh_token"], second):
        assert client.post("/auth/refresh", json={"refresh_token": token}).status_code == 200


def test_logout_revokes_the_refresh_token(client, make_customer, db_session):
    user = make_customer()
    assert client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]}).status_code == 200

    assert client.post("/auth/logout", json={"refresh_token": user["refresh_token"]}).status_code == 204

    row = db_session.query(RefreshToken).first()
    assert row.revoked_at is not None
    assert client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]}).status_code == 401


def test_logout_only_revokes_the_session_it_was_given(client, make_customer):
    """Logging out of one device must leave other sessions working."""
    user = make_customer()
    other = client.post("/auth/login",
                        data={"username": user["email"], "password": user["password"]}).json()

    client.post("/auth/logout", json={"refresh_token": user["refresh_token"]})

    assert client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]}).status_code == 401
    assert client.post("/auth/refresh", json={"refresh_token": other["refresh_token"]}).status_code == 200


def test_logout_is_idempotent_and_quiet_about_unknown_tokens(client, make_customer):
    user = make_customer()
    assert client.post("/auth/logout", json={"refresh_token": user["refresh_token"]}).status_code == 204
    assert client.post("/auth/logout", json={"refresh_token": user["refresh_token"]}).status_code == 204
    # Garbage must not reveal whether it was a real token.
    assert client.post("/auth/logout", json={"refresh_token": "not-a-token"}).status_code == 204


def test_refresh_rejected_when_the_record_is_expired(client, make_customer, db_session):
    """Server-side expiry is enforced even if the JWT itself still looks valid."""
    user = make_customer()
    row = db_session.query(RefreshToken).first()
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    assert client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]}).status_code == 401


def test_refresh_rejected_when_the_record_is_gone(client, make_customer, db_session):
    """A purged registry row means the token can no longer be honoured."""
    user = make_customer()
    db_session.query(RefreshToken).delete()
    db_session.commit()

    assert client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]}).status_code == 401


def test_revoking_every_session_for_a_user(client, make_customer, db_session):
    user = make_customer()
    client.post("/auth/login", data={"username": user["email"], "password": user["password"]})

    updated = (
        db_session.query(RefreshToken)
        .filter(RefreshToken.revoked_at.is_(None))
        .update({"revoked_at": datetime.now(timezone.utc)})
    )
    db_session.commit()
    assert updated == 2

    assert client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]}).status_code == 401


def test_deleting_a_user_cascades_to_their_refresh_tokens(make_customer, db_session):
    from app.database.models.user import User

    user = make_customer()
    assert db_session.query(RefreshToken).count() == 1

    db_session.query(User).filter(User.email == user["email"]).delete()
    db_session.commit()

    assert db_session.query(RefreshToken).count() == 0
