"""JWT_ISSUER / JWT_AUDIENCE actually validate something.

Both settings existed and were read by nothing, so a deployment could set
JWT_ISSUER and get no validation at all. These pin that they now do, and that
leaving them unset keeps the previous behaviour exactly.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core import security


def _security(monkeypatch, issuer=None, audience=None):
    """Point the module's scoping constants at these values for one test.

    Deliberately `monkeypatch.setattr` rather than `importlib.reload`: reloading
    rebinds the module object while the routes and `database/dep.py` still hold
    references to the *old* functions, so tokens would be minted by one copy and
    verified by another. monkeypatch also unwinds itself, which a reload does
    not — a reloaded module keeps whatever the last test set, and the failure
    lands in some other file.
    """
    monkeypatch.setattr(security, "JWT_ISSUER", issuer)
    monkeypatch.setattr(security, "JWT_AUDIENCE", audience)
    return security


BOOM = HTTPException(status_code=401, detail="nope")


def test_unset_by_default_leaves_tokens_unscoped(monkeypatch):
    s = _security(monkeypatch)
    token = s.create_access_token({"user_id": "u1", "role": "customer"})
    assert s.verify_access_token(token, BOOM).id == "u1"


def test_issuer_is_stamped_and_checked(monkeypatch):
    s = _security(monkeypatch, issuer="bookvuk")
    token = s.create_access_token({"user_id": "u1", "role": "customer"})
    assert s.verify_access_token(token, BOOM).id == "u1"

    # A token minted for a different issuer must not be accepted.
    other = _security(monkeypatch, issuer="somebody-else")
    foreign = other.create_access_token({"user_id": "u1", "role": "admin"})
    ours = _security(monkeypatch, issuer="bookvuk")
    with pytest.raises(HTTPException):
        ours.verify_access_token(foreign, BOOM)


def test_a_token_with_no_issuer_is_rejected_once_an_issuer_is_required(monkeypatch):
    unscoped = _security(monkeypatch)
    legacy = unscoped.create_access_token({"user_id": "u1", "role": "customer"})

    scoped = _security(monkeypatch, issuer="bookvuk")
    with pytest.raises(HTTPException):
        scoped.verify_access_token(legacy, BOOM)


def test_audience_absence_is_rejected(monkeypatch):
    """python-jose accepts a token with no `aud` even when one is expected.

    Without the explicit presence check, configuring an audience would buy
    nothing against a token that simply omits the claim.
    """
    unscoped = _security(monkeypatch)
    no_aud = unscoped.create_access_token({"user_id": "u1", "role": "admin"})

    scoped = _security(monkeypatch, audience="bookvuk-web")
    with pytest.raises(HTTPException):
        scoped.verify_access_token(no_aud, BOOM)


def test_matching_audience_passes_and_wrong_one_does_not(monkeypatch):
    s = _security(monkeypatch, audience="bookvuk-web")
    token = s.create_access_token({"user_id": "u1", "role": "customer"})
    assert s.verify_access_token(token, BOOM).id == "u1"

    other = _security(monkeypatch, audience="someone-else")
    foreign = other.create_access_token({"user_id": "u1", "role": "admin"})
    ours = _security(monkeypatch, audience="bookvuk-web")
    with pytest.raises(HTTPException):
        ours.verify_access_token(foreign, BOOM)


def test_refresh_tokens_are_scoped_too(monkeypatch):
    s = _security(monkeypatch, issuer="bookvuk", audience="bookvuk-web")
    token, jti, _exp = s.create_refresh_token({"user_id": "u1", "role": "customer"})
    data, payload = s._decode(token, expected_type=s.REFRESH_TOKEN_TYPE, credentials_exception=BOOM)
    assert data.id == "u1"
    assert payload["jti"] == jti
    assert payload["iss"] == "bookvuk"
    assert payload["aud"] == "bookvuk-web"
