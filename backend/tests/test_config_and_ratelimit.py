"""Settings guards (weak secrets, DB config) and the auth rate limiter."""

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import Settings
from app.core.ratelimit import RateLimiter

BASE_ENV = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": 30,
}

GOOD_KEY = "a" * 64


def _settings(**overrides):
    # _env_file=None keeps the developer's real .env out. Init kwargs also
    # outrank process environment variables, which matters because conftest sets
    # DATABASE_URL for the whole session.
    return Settings(_env_file=None, **{**BASE_ENV, **overrides})


def test_publicly_known_secret_key_is_rejected():
    with pytest.raises(ValidationError, match="publicly known"):
        _settings(SECRET_KEY="09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")


@pytest.mark.parametrize("key", ["secret", "changeme", "replace-me"])
def test_placeholder_secret_keys_are_rejected(key):
    with pytest.raises(ValidationError):
        _settings(SECRET_KEY=key)


def test_short_secret_key_is_rejected():
    with pytest.raises(ValidationError, match="too short"):
        _settings(SECRET_KEY="a" * 31)


def test_strong_secret_key_is_accepted():
    assert _settings(SECRET_KEY=GOOD_KEY).SECRET_KEY == GOOD_KEY


def test_special_characters_in_password_are_percent_encoded():
    """A raw '@' or '/' in the password would otherwise corrupt the URL."""
    s = Settings(
        _env_file=None,
        DATABASE_URL=None,  # must lose to the discrete fields below
        DATABASE_USERNAME="user",
        DATABASE_PASSWORD="p@ss/w?rd#1",
        DATABASE_HOSTNAME="db.example.com",
        DATABASE_PORT="5432",
        DATABASE_NAME="bookvuk",
        SECRET_KEY=GOOD_KEY,
        ALGORITHM="HS256",
        ACCESS_TOKEN_EXPIRE_MINUTES=30,
    )
    from urllib.parse import urlsplit

    parts = urlsplit(s.sqlalchemy_url)
    assert parts.hostname == "db.example.com"
    assert parts.port == 5432
    assert parts.path == "/bookvuk"


def test_postgres_scheme_is_normalised():
    s = _settings(SECRET_KEY=GOOD_KEY, DATABASE_URL="postgres://u:p@h:5432/d")
    assert s.sqlalchemy_url.startswith("postgresql://")


def test_sslmode_is_added_and_explicit_value_wins():
    added = _settings(SECRET_KEY=GOOD_KEY, DATABASE_SSLMODE="require")
    assert "sslmode=require" in added.sqlalchemy_url

    explicit = _settings(
        SECRET_KEY=GOOD_KEY,
        DATABASE_URL="postgresql://u:p@h:5432/d?sslmode=verify-full",
        DATABASE_SSLMODE="require",
    )
    assert "sslmode=verify-full" in explicit.sqlalchemy_url
    assert "sslmode=require" not in explicit.sqlalchemy_url


def test_unreplaced_supabase_placeholder_is_rejected():
    with pytest.raises(ValidationError, match="placeholder"):
        _settings(SECRET_KEY=GOOD_KEY,
                  DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.x.supabase.co:5432/postgres")


def test_incomplete_database_config_is_rejected():
    with pytest.raises(ValidationError, match="Incomplete database configuration"):
        Settings(_env_file=None, DATABASE_URL=None, DATABASE_HOSTNAME="localhost",
                 SECRET_KEY=GOOD_KEY, ALGORITHM="HS256", ACCESS_TOKEN_EXPIRE_MINUTES=30)


def test_safe_database_target_hides_credentials():
    s = _settings(SECRET_KEY=GOOD_KEY, DATABASE_URL="postgresql://bob:hunter2@h.example.com:5432/d")
    target = s.safe_database_target
    assert "hunter2" not in target and "bob" not in target
    assert target == "h.example.com:5432/d"


def test_cors_origins_are_split_and_trimmed():
    s = _settings(SECRET_KEY=GOOD_KEY, CORS_ORIGINS="http://a.test, http://b.test ,")
    assert s.cors_origins == ["http://a.test", "http://b.test"]


# --- rate limiter ---

class _FakeRequest:
    def __init__(self, ip="1.2.3.4", forwarded=None):
        self.headers = {"x-forwarded-for": forwarded} if forwarded else {}
        self.client = type("C", (), {"host": ip})()


def test_limiter_allows_up_to_the_limit_then_blocks():
    limiter = RateLimiter(attempts=3, window_seconds=60, name="login")
    req = _FakeRequest()

    for _ in range(3):
        limiter.check(req)

    with pytest.raises(HTTPException) as exc:
        limiter.check(req)
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_limiter_counts_per_client():
    limiter = RateLimiter(attempts=1, window_seconds=60, name="login")
    limiter.check(_FakeRequest(ip="10.0.0.1"))
    # A different client is unaffected.
    limiter.check(_FakeRequest(ip="10.0.0.2"))

    with pytest.raises(HTTPException):
        limiter.check(_FakeRequest(ip="10.0.0.1"))


def test_limiter_uses_leftmost_forwarded_for():
    limiter = RateLimiter(attempts=1, window_seconds=60, name="login")
    limiter.check(_FakeRequest(ip="10.0.0.9", forwarded="203.0.113.5, 70.41.3.18"))

    with pytest.raises(HTTPException):
        limiter.check(_FakeRequest(ip="10.0.0.9", forwarded="203.0.113.5, 9.9.9.9"))


def test_reset_clears_a_client():
    limiter = RateLimiter(attempts=1, window_seconds=60, name="login")
    req = _FakeRequest()
    limiter.check(req)
    limiter.reset(req)
    limiter.check(req)  # allowed again


def test_login_endpoint_returns_429_after_too_many_failures(client, make_customer, monkeypatch):
    from app.api.routes import auth

    user = make_customer()
    monkeypatch.setattr(auth.login_limiter, "attempts", 3)
    auth.login_limiter.reset(_FakeRequest(ip="testclient"))

    codes = [
        client.post("/auth/login", data={"username": user["email"], "password": "wrong"}).status_code
        for _ in range(5)
    ]
    assert 429 in codes, codes
    assert codes.count(401) <= 3, codes


def test_successful_login_clears_the_counter(client, make_customer, monkeypatch):
    from app.api.routes import auth

    user = make_customer()
    monkeypatch.setattr(auth.login_limiter, "attempts", 3)
    auth.login_limiter.reset(_FakeRequest(ip="testclient"))

    client.post("/auth/login", data={"username": user["email"], "password": "wrong"})
    client.post("/auth/login", data={"username": user["email"], "password": "wrong"})
    # A correct login resets, so the next wrong attempt is not immediately blocked.
    assert client.post("/auth/login",
                       data={"username": user["email"], "password": user["password"]}).status_code == 200
    assert client.post("/auth/login",
                       data={"username": user["email"], "password": "wrong"}).status_code == 401
