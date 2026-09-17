"""Shared test fixtures.

Tests run against a real PostgreSQL database, not SQLite: the app relies on
Postgres-specific behaviour (UUID columns, `SELECT ... FOR UPDATE`), so a SQLite
stand-in would pass while production broke.

Point TEST_DATABASE_URL at a throwaway database. The schema is created once per
session from the models and dropped afterwards; each test then runs against
truncated tables so ordering never matters.

  TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5433/bookvuk_test \
    PYTHONPATH=. ./venv/bin/pytest
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

if not TEST_DATABASE_URL:
    pytest.skip(
        "TEST_DATABASE_URL is not set; refusing to run tests against the app database",
        allow_module_level=True,
    )

# The app reads settings at import time, so the environment must be prepared
# before anything from `app` is imported.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# Set to empty rather than deleted: removing the variable would let the real
# .env supply sslmode=require, which a local test server does not offer.
os.environ["DATABASE_SSLMODE"] = ""
os.environ["DATABASE_SSLROOTCERT"] = ""
os.environ.setdefault("SECRET_KEY", "test-" + "0" * 60)
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
# Effectively disable the auth rate limiter unless a test opts in.
os.environ.setdefault("LOGIN_RATE_LIMIT_ATTEMPTS", "10000")
os.environ.setdefault("REGISTER_RATE_LIMIT_ATTEMPTS", "10000")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import models  # noqa: E402,F401  (registers mappers)
from app.database.base import Base  # noqa: E402
from app.database.db import engine  # noqa: E402
from app.main import app  # noqa: E402

# Every table the models define, ordered so truncation respects foreign keys.
_TABLES = [t.name for t in reversed(Base.metadata.sorted_tables)]


@pytest.fixture(scope="session", autouse=True)
def _schema():
    # `books` carries a trigram index, which cannot be created without the
    # extension. `create_all` does not install extensions, so it has to happen
    # here — the migrations do the same thing for real databases.
    with engine.begin() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        except Exception as exc:  # noqa: BLE001
            pytest.exit(
                "Could not create the pg_trgm extension on the test database: "
                f"{exc}\nGrant the test role rights to create extensions, or run "
                "`CREATE EXTENSION pg_trgm;` on it once as a superuser.",
                returncode=1,
            )

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    quoted = ", ".join('"' + t + '"' for t in _TABLES)
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE " + quoted + " CASCADE"))

    # The bestseller set is cached for five minutes. Without this, a test would see
    # badges computed from the previous test's orders — rows that no longer exist.
    from app.core import merchandising

    merchandising.reset_cache()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session():
    from app.database.db import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@booknest.com"


DEFAULT_ADDRESS = {
    "full_name": "Test Customer",
    "phone": "9876500000",
    "line1": "1 Test Street",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postal_code": "560001",
    "country": "IN",
}


@pytest.fixture(autouse=True)
def _reset_auth_rate_limits():
    """Clear the auth limiters between tests.

    They are per-process and every test calls from the same client host, so
    without this the 5-per-hour reset cap makes later tests fail for reasons that
    have nothing to do with what they assert.
    """
    from app.api.routes import auth

    for limiter in (auth.login_limiter, auth.register_limiter, auth.password_reset_limiter):
        with limiter._lock:  # noqa: SLF001 - test-only reach-in
            limiter._hits.clear()
    yield


@pytest.fixture
def make_customer(client):
    """Register a customer and return (headers, tokens, user).

    Saves a default delivery address unless `with_address=False`, because
    checkout requires one and most tests are not about addresses.
    """

    def _make(password: str = "Passw0rd!23", with_address: bool = True):
        email = unique_email("cust")
        res = client.post(
            "/auth/register",
            json={"email": email, "username": email.split("@")[0][:20],
                  "full_name": "Test Customer", "password": password},
        )
        assert res.status_code == 200, res.text
        body = res.json()
        headers = {"Authorization": f"Bearer {body['access_token']}"}

        if with_address:
            saved = client.post("/api/customer/addresses", json=DEFAULT_ADDRESS, headers=headers)
            assert saved.status_code == 201, saved.text

        return {
            "headers": headers,
            "access_token": body["access_token"],
            "refresh_token": body["refresh_token"],
            "user": body["user"],
            "id": body["user"]["id"],
            "email": email,
            "password": password,
        }

    return _make


@pytest.fixture
def make_admin(client, db_session):
    """Create an admin directly (registration always yields a customer)."""

    def _make(password: str = "Adminp0rd!23"):
        from app.utils.utils import hash_password

        email = unique_email("admin")
        admin = models.User(
            email=email,
            username=email.split("@")[0][:20],
            full_name="Test Admin",
            password_hash=hash_password(password),
            role="admin",
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)

        res = client.post("/auth/login", data={"username": email, "password": password})
        assert res.status_code == 200, res.text
        token = res.json()["access_token"]
        return {
            "headers": {"Authorization": f"Bearer {token}"},
            "access_token": token,
            "id": admin.id,
            "email": email,
        }

    return _make


@pytest.fixture(scope="session")
def live_server():
    """A real uvicorn process, for tests that need genuine request concurrency.

    TestClient funnels every request through one anyio portal, so threads calling
    it are serialised — a concurrency bug cannot reproduce through it. Racing
    against an actual server does reproduce it.
    """
    import socket
    import subprocess
    import time
    import urllib.request

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]

    env = {
        **os.environ,
        "DATABASE_URL": TEST_DATABASE_URL,
        "DATABASE_SSLMODE": "",
        "LOG_LEVEL": "WARNING",
    }
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(BACKEND_ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    base_url = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            output = process.stdout.read().decode(errors="replace") if process.stdout else ""
            pytest.fail(f"live server exited early:\n{output[-2000:]}")
        try:
            with urllib.request.urlopen(base_url + "/health", timeout=1):
                break
        except Exception:
            time.sleep(0.2)
    else:
        process.terminate()
        pytest.fail("live server did not become ready within 30s")

    yield base_url

    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


@pytest.fixture
def make_book(db_session):
    """Create a category + book and return the book."""

    def _make(
        *,
        title: str = "Test Book",
        price: str = "100.00",
        stock: int = 10,
        description: str = "A book used by the tests",
        author: str = "Test Author",
    ):
        category = db_session.query(models.Category).filter_by(name="TestCat").first()
        if not category:
            category = models.Category(name="TestCat")
            db_session.add(category)
            db_session.flush()

        book = models.Book(
            title=title,
            description=description,
            price=price,
            stock=stock,
            format="Paperback",
            rating=4.5,
            rating_count=10,
            category_id=category.id,
            catalog_id=f"test-{uuid.uuid4().hex[:8]}",
            author=author,
        )
        db_session.add(book)
        db_session.commit()
        db_session.refresh(book)
        return book

    return _make
