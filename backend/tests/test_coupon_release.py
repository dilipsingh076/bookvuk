"""Cancelling an order gives its coupon back.

Cancellation restored the stock and returned the store credit but left the
coupon spent, in two ways: the global `times_redeemed` counter stayed up, so a
capped code permanently lost a slot to an order that never happened; and the
per-customer cap counts redemption rows, so somebody who used a first-order code
and then cancelled could never use it again.

These run against a database because the whole behaviour is about what the rows
say afterwards.
"""

from __future__ import annotations

from decimal import Decimal

from app.core.fulfilment import redemptions_for_user, release_coupon
from app.database import models


def _order(db, user_id, status: str = "processing") -> models.Order:
    """A bare order row. These tests are about the coupon, not the checkout."""
    order = models.Order(
        user_id=user_id, status=status,
        subtotal=Decimal("100"), shipping=Decimal("0"), tax=Decimal("0"),
        total=Decimal("100"),
    )
    db.add(order)
    db.flush()
    return order


def _coupon(db, **kw):
    coupon = models.Coupon(
        code=kw.pop("code", "TESTCODE"),
        discount_type="percent",
        value=Decimal("10"),
        max_discount=Decimal("100"),
        is_active=True,
        max_redemptions_per_user=1,
        times_redeemed=0,
        **kw,
    )
    db.add(coupon)
    db.flush()
    return coupon


def _redeem(db, coupon, user_id, order):
    db.add(
        models.CouponRedemption(
            coupon_id=coupon.id, user_id=user_id, order_id=order.id, amount=Decimal("10")
        )
    )
    coupon.times_redeemed = int(coupon.times_redeemed or 0) + 1
    db.flush()


def test_a_live_order_counts_towards_the_per_user_cap(db_session, make_customer):
    user = make_customer()
    order = _order(db_session, user["id"])
    coupon = _coupon(db_session)
    _redeem(db_session, coupon, user["id"], order)

    assert redemptions_for_user(db_session, coupon.id, user["id"]) == 1


def test_a_cancelled_order_does_not_count(db_session, make_customer):
    """The cap stops one person taking a first-order discount twice. It is not
    meant to punish somebody for changing their mind."""
    user = make_customer()
    order = _order(db_session, user["id"])
    coupon = _coupon(db_session)
    _redeem(db_session, coupon, user["id"], order)

    order.status = "cancelled"
    db_session.flush()

    assert redemptions_for_user(db_session, coupon.id, user["id"]) == 0


def test_release_returns_the_global_slot(db_session, make_customer):
    user = make_customer()
    order = _order(db_session, user["id"])
    coupon = _coupon(db_session)
    _redeem(db_session, coupon, user["id"], order)
    assert coupon.times_redeemed == 1

    order.coupon_code = coupon.code
    order.status = "cancelled"
    release_coupon(db_session, order)

    assert coupon.times_redeemed == 0


def test_release_is_idempotent(db_session, make_customer):
    """`cancel_order_in_transaction` sets the status before this runs, so there is
    no local signal that a release already happened — which is why the counter is
    recomputed from the ledger rather than decremented."""
    user = make_customer()
    order = _order(db_session, user["id"])
    coupon = _coupon(db_session)
    _redeem(db_session, coupon, user["id"], order)

    order.coupon_code = coupon.code
    order.status = "cancelled"
    release_coupon(db_session, order)
    once = coupon.times_redeemed
    release_coupon(db_session, order)
    release_coupon(db_session, order)

    assert coupon.times_redeemed == once


def test_release_sees_the_status_set_by_its_caller(db_session, make_customer):
    """The session runs with `autoflush=False`, so a query inside the release
    would otherwise read the *old* status and count the cancellation as live.

    This is the case that made the first version of the fix wrong.
    """
    user = make_customer()
    order = _order(db_session, user["id"])
    coupon = _coupon(db_session)
    _redeem(db_session, coupon, user["id"], order)

    order.coupon_code = coupon.code
    order.status = "cancelled"
    # Deliberately no flush here: the release has to do it.
    release_coupon(db_session, order)

    assert coupon.times_redeemed == 0


def test_another_customers_live_redemption_is_not_released(db_session, make_customer):
    """Releasing one order's slot must not clear the whole coupon."""
    a, b = make_customer(), make_customer()
    order_a = _order(db_session, a["id"])
    order_b = _order(db_session, b["id"])
    coupon = _coupon(db_session)
    _redeem(db_session, coupon, a["id"], order_a)
    _redeem(db_session, coupon, b["id"], order_b)
    assert coupon.times_redeemed == 2

    order_a.coupon_code = coupon.code
    order_a.status = "cancelled"
    release_coupon(db_session, order_a)

    assert coupon.times_redeemed == 1
    assert redemptions_for_user(db_session, coupon.id, b["id"]) == 1


def test_an_order_with_no_coupon_is_left_alone(db_session, make_customer):
    user = make_customer()
    order = _order(db_session, user["id"])
    order.coupon_code = None
    # No exception, no query — nothing to give back.
    release_coupon(db_session, order)


def test_a_deleted_coupon_does_not_raise(db_session, make_customer):
    """The code can be gone by the time an old order is cancelled."""
    user = make_customer()
    order = _order(db_session, user["id"])
    order.coupon_code = "NEVEREXISTED"
    release_coupon(db_session, order)
