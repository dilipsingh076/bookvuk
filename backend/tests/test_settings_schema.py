"""What the store-settings update schema will and will not accept.

Every field here moves money, and the schema is the only thing between an admin
session and the shop's pricing. These pin the two ways a bad request could get
through: a value outside its range, and a value of the wrong *type* that Pydantic
would otherwise coerce into something plausible.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schema.admin import StoreSettingsUpdate


@pytest.mark.parametrize("payload", [
    {"tax_rate": 1.5},                        # 150% tax
    {"tax_rate": -0.1},
    {"shipping_flat_rate": -5},
    {"free_shipping_threshold": -1},
    {"cod_max_order_total": -1},
    {"wallet_max_redemption_percent": 150},
    {"wallet_max_redemption_percent": -1},
])
def test_values_outside_their_range_are_refused(payload):
    with pytest.raises(ValidationError):
        StoreSettingsUpdate(**payload)


@pytest.mark.parametrize("payload", [
    {"database_url": "postgres://evil"},
    {"secret_key": "x"},
    {"razorpay_key_secret": "x"},
])
def test_settings_this_endpoint_does_not_own_are_refused(payload):
    """`extra="forbid"`. A request naming a secret must be an error, not something
    quietly dropped — silence would read as success to whoever sent it."""
    with pytest.raises(ValidationError):
        StoreSettingsUpdate(**payload)


@pytest.mark.parametrize("value", ["yes", "true", "1", 1, 0])
def test_a_non_boolean_cannot_switch_cash_on_delivery(value):
    """Pydantic coerces these to booleans by default, and the coercion is the bug:
    a malformed request would *silently pin* cod_enabled as an override, so the
    setting stops following the environment for a value nobody chose."""
    with pytest.raises(ValidationError):
        StoreSettingsUpdate(cod_enabled=value)


def test_real_booleans_still_work():
    assert StoreSettingsUpdate(cod_enabled=True).cod_enabled is True
    assert StoreSettingsUpdate(cod_enabled=False).cod_enabled is False


def test_null_is_distinguishable_from_absent():
    """The distinction the whole update path rests on: sent-as-null clears the
    override, absent leaves it alone. Without `exclude_unset` they are one request."""
    cleared = StoreSettingsUpdate(tax_rate=None)
    untouched = StoreSettingsUpdate()
    assert "tax_rate" in cleared.model_dump(exclude_unset=True)
    assert "tax_rate" not in untouched.model_dump(exclude_unset=True)


@pytest.mark.parametrize("payload", [
    {"tax_rate": 0}, {"tax_rate": 1},
    {"wallet_max_redemption_percent": 0}, {"wallet_max_redemption_percent": 100},
    {"shipping_flat_rate": 0}, {"free_shipping_threshold": 0},
])
def test_the_edges_of_each_range_are_allowed(payload):
    StoreSettingsUpdate(**payload)
