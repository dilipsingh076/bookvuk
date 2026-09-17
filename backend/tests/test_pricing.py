"""Pricing arithmetic and coupon rules (pure functions, no database)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.core import store_settings
from app.core.pricing import (
    CouponError,
    assert_coupon_usable,
    compute_totals,
    discount_for,
    money,
)


@pytest.fixture
def rates(monkeypatch):
    """Price against rates this test chose, not against the deployment's.

    `compute_totals` reads the live store settings, so these tests were really
    asserting two things at once: that the arithmetic is right, and that the
    shop currently charges 8% tax and ₹5 shipping. The second is not a property
    of the function — when the shop moved to MRP-inclusive pricing (tax 0,
    ₹49 delivery, free over ₹499) four of them failed without anything being
    wrong.

    Pinning the rates leaves each test asserting the one thing it is named for.
    A test that wants to check tax is applied to the discounted amount needs
    *some* non-zero rate; which one is arbitrary, so it says so out loud.
    """

    def _set(*, shipping="5.00", threshold="0", tax="0.08"):
        cfg = store_settings.StoreConfig(
            shipping_flat_rate=Decimal(shipping),
            free_shipping_threshold=Decimal(threshold),
            tax_rate=Decimal(tax),
            cod_enabled=True,
            cod_max_order_total=Decimal("3000"),
            wallet_max_redemption_percent=50,
        )
        monkeypatch.setattr(store_settings, "current", lambda: cfg)
        return cfg

    return _set


class FakeCoupon:
    def __init__(self, **kw):
        self.discount_type = kw.get("discount_type", "percent")
        self.value = kw.get("value", Decimal("10"))
        self.max_discount = kw.get("max_discount")
        self.min_subtotal = kw.get("min_subtotal", Decimal("0"))
        self.is_active = kw.get("is_active", True)
        self.starts_at = kw.get("starts_at")
        self.expires_at = kw.get("expires_at")
        self.max_redemptions = kw.get("max_redemptions")
        self.max_redemptions_per_user = kw.get("max_redemptions_per_user", 1)
        self.times_redeemed = kw.get("times_redeemed", 0)
        self.code = kw.get("code", "TEST")


def test_money_rounds_half_up():
    assert money("10.005") == Decimal("10.01")
    assert money("10.004") == Decimal("10.00")


def test_totals_apply_shipping_and_tax(rates):
    rates(shipping="5.00", tax="0.08")
    t = compute_totals(Decimal("300.00"))
    assert t.subtotal == Decimal("300.00")
    assert t.shipping == Decimal("5.00")
    assert t.tax == Decimal("24.00")  # 8% of 300
    assert t.total == Decimal("329.00")


def test_empty_order_is_not_charged_shipping():
    t = compute_totals(Decimal("0.00"))
    assert t.shipping == Decimal("0.00")
    assert t.total == Decimal("0.00")


def test_tax_is_charged_on_the_discounted_amount(rates):
    """Taxing the pre-discount price would overcharge the customer."""
    rates(shipping="5.00", tax="0.08")
    t = compute_totals(Decimal("300.00"), discount=Decimal("100.00"))
    assert t.discount == Decimal("100.00")
    assert t.tax == Decimal("16.00")  # 8% of 200, not of 300
    assert t.total == Decimal("221.00")  # 200 + 5 shipping + 16 tax


def test_a_discount_cannot_make_the_total_negative():
    t = compute_totals(Decimal("50.00"), discount=Decimal("500.00"))
    assert t.total >= Decimal("0.00")
    assert t.shipping == Decimal("0.00")


def test_percentage_discount_respects_its_cap():
    coupon = FakeCoupon(discount_type="percent", value=Decimal("50"), max_discount=Decimal("100"))
    assert discount_for(coupon, Decimal("1000.00")) == Decimal("100.00")


def test_percentage_discount_without_cap():
    coupon = FakeCoupon(discount_type="percent", value=Decimal("10"))
    assert discount_for(coupon, Decimal("250.00")) == Decimal("25.00")


def test_fixed_discount_never_exceeds_the_subtotal():
    coupon = FakeCoupon(discount_type="fixed", value=Decimal("500"))
    assert discount_for(coupon, Decimal("120.00")) == Decimal("120.00")


def test_unknown_discount_type_is_rejected():
    with pytest.raises(CouponError):
        discount_for(FakeCoupon(discount_type="bogus"), Decimal("100"))


def test_inactive_and_missing_coupons_are_rejected():
    with pytest.raises(CouponError, match="not valid"):
        assert_coupon_usable(None, subtotal=Decimal("100"), user_redemptions=0)
    with pytest.raises(CouponError, match="not valid"):
        assert_coupon_usable(FakeCoupon(is_active=False), subtotal=Decimal("100"), user_redemptions=0)


def test_expired_and_not_yet_started_coupons_are_rejected():
    now = datetime.now(timezone.utc)
    with pytest.raises(CouponError, match="expired"):
        assert_coupon_usable(
            FakeCoupon(expires_at=now - timedelta(minutes=1)),
            subtotal=Decimal("100"), user_redemptions=0,
        )
    with pytest.raises(CouponError, match="not active yet"):
        assert_coupon_usable(
            FakeCoupon(starts_at=now + timedelta(hours=1)),
            subtotal=Decimal("100"), user_redemptions=0,
        )


def test_global_and_per_user_limits_are_enforced():
    with pytest.raises(CouponError, match="usage limit"):
        assert_coupon_usable(
            FakeCoupon(max_redemptions=5, times_redeemed=5),
            subtotal=Decimal("100"), user_redemptions=0,
        )
    with pytest.raises(CouponError, match="already used"):
        assert_coupon_usable(
            FakeCoupon(max_redemptions_per_user=1),
            subtotal=Decimal("100"), user_redemptions=1,
        )


def test_minimum_subtotal_is_enforced():
    with pytest.raises(CouponError, match="minimum order"):
        assert_coupon_usable(
            FakeCoupon(min_subtotal=Decimal("500")),
            subtotal=Decimal("100"), user_redemptions=0,
        )


def test_a_usable_coupon_raises_nothing():
    assert_coupon_usable(
        FakeCoupon(min_subtotal=Decimal("50"), max_redemptions=10, times_redeemed=2),
        subtotal=Decimal("100"), user_redemptions=0,
    )


# ----- MRP-inclusive pricing, which is the shop's actual configuration -----


def test_a_printed_book_is_not_taxed_on_top_of_its_mrp():
    """The *deployment's* default — deliberately not pinned by the fixture.

    `books.price` is the MRP from the cover.

    Under the Legal Metrology (Packaged Commodities) Rules, 2011 that price is
    declared inclusive of all taxes, so adding to it sells above MRP. Printed
    books (HSN 4901) are NIL-rated under GST as well. This used to add 8% — a US
    sales-tax placeholder — to every order.
    """
    t = compute_totals(Decimal("619.00"))
    assert t.tax == Decimal("0.00")


def test_a_book_over_the_threshold_costs_exactly_its_printed_price(rates):
    """What a shopper checks: the number on the cover is the number charged."""
    rates(shipping="49.00", threshold="499", tax="0")
    t = compute_totals(Decimal("619.00"))
    assert t.shipping == Decimal("0.00")
    assert t.total == Decimal("619.00")


def test_delivery_is_still_added_below_the_threshold(rates):
    """MRP covers the book, not carrying it to the door — that stays separate."""
    rates(shipping="49.00", threshold="499", tax="0")
    t = compute_totals(Decimal("389.00"))
    assert t.shipping == Decimal("49.00")
    assert t.total == Decimal("438.00")
