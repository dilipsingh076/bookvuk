"""Which Razorpay keys are in play, and how an order remembers.

`RAZORPAY_MODE` is the only thing that decides. These pin the two ways that can
go wrong: the wrong key set being used, and — with a single database serving both
modes — a rehearsal becoming indistinguishable from a real sale.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings

BASE = dict(
    SECRET_KEY="x" * 40,
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES=30,
    DATABASE_URL="postgresql://u:p@h:5432/d",
)
KEYS = dict(
    RAZORPAY_TEST_KEY_ID="rzp_test_aaa",
    RAZORPAY_TEST_KEY_SECRET="test-secret",
    RAZORPAY_TEST_WEBHOOK_SECRET="test-hook",
    RAZORPAY_LIVE_KEY_ID="rzp_live_bbb",
    RAZORPAY_LIVE_KEY_SECRET="live-secret",
    RAZORPAY_LIVE_WEBHOOK_SECRET="live-hook",
)


def _settings(**over):
    return Settings(**BASE, **KEYS, **over, _env_file=None)


def test_test_mode_resolves_the_test_keys():
    s = _settings(RAZORPAY_MODE="test")
    assert s.razorpay_key_id == "rzp_test_aaa"
    assert s.razorpay_key_secret == "test-secret"
    assert s.razorpay_webhook_secret == "test-hook"


def test_live_mode_resolves_the_live_keys():
    s = _settings(RAZORPAY_MODE="live")
    assert s.razorpay_key_id == "rzp_live_bbb"
    assert s.razorpay_key_secret == "live-secret"
    assert s.razorpay_webhook_secret == "live-hook"


def test_the_two_sets_never_mix():
    """The failure that costs money: live keys with a test webhook secret, or
    any other half-and-half combination."""
    test, live = _settings(RAZORPAY_MODE="test"), _settings(RAZORPAY_MODE="live")
    assert {test.razorpay_key_id, test.razorpay_key_secret, test.razorpay_webhook_secret}.isdisjoint(
        {live.razorpay_key_id, live.razorpay_key_secret, live.razorpay_webhook_secret}
    )


def test_defaults_to_test():
    """A deployment that forgets the flag rehearses; it does not take real money."""
    assert _settings().RAZORPAY_MODE == "test"


def test_payments_are_off_when_the_active_mode_has_no_keys():
    s = Settings(**BASE, RAZORPAY_MODE="live",
                 RAZORPAY_TEST_KEY_ID="rzp_test_aaa",
                 RAZORPAY_TEST_KEY_SECRET="test-secret", _env_file=None)
    assert s.payments_enabled is False, "test keys must not stand in for missing live ones"


@pytest.mark.parametrize("field,value", [
    ("RAZORPAY_TEST_KEY_ID", "rzp_live_oops"),
    ("RAZORPAY_LIVE_KEY_ID", "rzp_test_oops"),
])
def test_a_key_filed_under_the_wrong_mode_is_refused(field, value):
    """A live key in the test slot charges real cards during what someone
    believes is a rehearsal. Razorpay key ids say which they are, so this is
    cheap to catch at boot."""
    over = dict(KEYS)
    over[field] = value
    with pytest.raises(ValidationError, match="mode key"):
        Settings(**BASE, **over, _env_file=None)


def test_an_unrecognised_key_format_is_left_alone():
    """The check must not lock the app out over a key shape it does not know."""
    over = dict(KEYS, RAZORPAY_TEST_KEY_ID="some_other_format")
    assert Settings(**BASE, **over, _env_file=None).RAZORPAY_MODE == "test"


def test_an_unknown_mode_is_refused():
    with pytest.raises(ValidationError):
        _settings(RAZORPAY_MODE="sandbox")
