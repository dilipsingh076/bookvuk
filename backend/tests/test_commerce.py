"""Addresses, coupons at checkout, reviews, payments and password reset."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.database.db import SessionLocal
from app.database.models.book import Book
from app.database.models.coupon import Coupon, CouponRedemption
from app.database.models.order import Order
from app.database.models.password_reset import PasswordResetToken
from app.database.models.review import Review

ADDRESS = {
    "full_name": "Asha Rao",
    "phone": "9876543210",
    "line1": "12 MG Road",
    "line2": "Flat 3B",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postal_code": "560001",
    "country": "IN",
}


def _add(client, headers, book, qty=1):
    return client.post("/api/customer/cart/items",
                       json={"book_id": str(book.id), "quantity": qty}, headers=headers)


def _coupon(db_session, **kw):
    coupon = Coupon(
        code=kw.get("code", "SAVE10"),
        discount_type=kw.get("discount_type", "percent"),
        value=kw.get("value", Decimal("10")),
        max_discount=kw.get("max_discount", Decimal("1000")),
        min_subtotal=kw.get("min_subtotal", Decimal("0")),
        is_active=kw.get("is_active", True),
        expires_at=kw.get("expires_at"),
        max_redemptions=kw.get("max_redemptions"),
        max_redemptions_per_user=kw.get("max_redemptions_per_user", 1),
    )
    db_session.add(coupon)
    db_session.commit()
    db_session.refresh(coupon)
    return coupon


# ----- addresses -----

def test_checkout_requires_an_address(client, make_customer, make_book):
    """An order with nowhere to ship is worse than a rejected one."""
    user, book = make_customer(with_address=False), make_book(stock=5)
    _add(client, user["headers"], book)

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 400
    assert "address" in res.json()["detail"].lower()


def test_checkout_stores_the_address_on_the_order(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=5)
    _add(client, user["headers"], book)

    res = client.post("/api/customer/checkout",
                      json={"address": ADDRESS}, headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["shipping_address"]["line1"] == "12 MG Road"
    assert body["shipping_address"]["city"] == "Bengaluru"
    assert body["shipping_address"]["postal_code"] == "560001"


def test_first_saved_address_becomes_the_default(client, make_customer):
    user = make_customer(with_address=False)
    res = client.post("/api/customer/addresses", json={**ADDRESS}, headers=user["headers"])
    assert res.status_code == 201, res.text
    assert res.json()["is_default"] is True


def test_checkout_uses_the_saved_default_when_none_is_given(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=5)
    client.post("/api/customer/addresses", json={**ADDRESS}, headers=user["headers"])
    _add(client, user["headers"], book)

    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["shipping_address"]["city"] == "Bengaluru"


def test_cannot_check_out_to_another_customers_address(client, make_customer, make_book):
    owner, other = make_customer(), make_customer()
    book = make_book(stock=5)
    created = client.post("/api/customer/addresses", json={**ADDRESS}, headers=owner["headers"]).json()
    _add(client, other["headers"], book)

    res = client.post("/api/customer/checkout",
                      json={"address_id": created["id"]}, headers=other["headers"])
    assert res.status_code == 404


def test_editing_a_saved_address_does_not_rewrite_past_orders(client, make_customer, make_book):
    """Delivery history must reflect where the parcel actually went."""
    user, book = make_customer(), make_book(stock=5)
    created = client.post("/api/customer/addresses", json={**ADDRESS}, headers=user["headers"]).json()
    _add(client, user["headers"], book)
    order = client.post("/api/customer/checkout",
                        json={"address_id": created["id"]}, headers=user["headers"]).json()

    client.delete(f"/api/customer/addresses/{created['id']}", headers=user["headers"])

    again = client.get(f"/api/customer/orders/{order['id']}", headers=user["headers"]).json()
    assert again["shipping_address"]["line1"] == "12 MG Road"


# ----- coupons -----

def test_cart_totals_match_checkout(client, make_customer, make_book, db_session):
    """The number shown must be the number charged."""
    user = make_customer()
    book = make_book(price="100.00", stock=10)
    _add(client, user["headers"], book, 3)
    _coupon(db_session, code="SAVE10", value=Decimal("10"))

    preview = client.get("/api/customer/cart?coupon_code=SAVE10",
                         headers=user["headers"]).json()["totals"]
    charged = client.post("/api/customer/checkout",
                          json={"address": ADDRESS, "coupon_code": "SAVE10"},
                          headers=user["headers"]).json()

    for field in ("subtotal", "discount", "shipping", "tax", "total"):
        assert Decimal(preview[field]) == Decimal(charged[field]), field


def test_percentage_coupon_reduces_the_total(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="100.00", stock=10)
    _add(client, user["headers"], book, 2)
    _coupon(db_session, code="SAVE10", value=Decimal("10"))

    res = client.post("/api/customer/checkout",
                      json={"address": ADDRESS, "coupon_code": "SAVE10"},
                      headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert Decimal(body["subtotal"]) == Decimal("200.00")
    assert Decimal(body["discount"]) == Decimal("20.00")
    # No tax: the price is an MRP, inclusive of it. 180 is under the
    # free-delivery threshold, so delivery is still charged.
    assert Decimal(body["tax"]) == Decimal("0.00")
    assert Decimal(body["total"]) == Decimal("229.00")  # 180 + 49
    assert body["coupon_code"] == "SAVE10"


def test_coupon_codes_are_case_insensitive(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="100.00", stock=5)
    _add(client, user["headers"], book)
    _coupon(db_session, code="SAVE10")

    res = client.get("/api/customer/cart?coupon_code=save10", headers=user["headers"])
    assert res.status_code == 200
    assert Decimal(res.json()["totals"]["discount"]) > 0


def test_unknown_coupon_is_rejected(client, make_customer, make_book):
    user, book = make_customer(), make_book(stock=5)
    _add(client, user["headers"], book)

    res = client.post("/api/customer/checkout",
                      json={"address": ADDRESS, "coupon_code": "NOPE"},
                      headers=user["headers"])
    assert res.status_code == 400


def test_a_coupon_cannot_be_reused_beyond_its_per_user_cap(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="100.00", stock=20)
    _coupon(db_session, code="ONCE", max_redemptions_per_user=1)

    _add(client, user["headers"], book)
    first = client.post("/api/customer/checkout",
                        json={"address": ADDRESS, "coupon_code": "ONCE"}, headers=user["headers"])
    assert first.status_code == 200, first.text

    _add(client, user["headers"], book)
    second = client.post("/api/customer/checkout",
                         json={"address": ADDRESS, "coupon_code": "ONCE"}, headers=user["headers"])
    assert second.status_code == 400
    assert "already used" in second.json()["detail"].lower()


def test_expired_coupon_is_rejected_at_checkout(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="100.00", stock=5)
    _add(client, user["headers"], book)
    _coupon(db_session, code="OLD", expires_at=datetime.now(timezone.utc) - timedelta(days=1))

    res = client.post("/api/customer/checkout",
                      json={"address": ADDRESS, "coupon_code": "OLD"}, headers=user["headers"])
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


def test_redemption_is_recorded_and_counted(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="100.00", stock=5)
    _add(client, user["headers"], book)
    coupon = _coupon(db_session, code="TRACK")

    client.post("/api/customer/checkout",
                json={"address": ADDRESS, "coupon_code": "TRACK"}, headers=user["headers"])

    with SessionLocal() as s:
        refreshed = s.query(Coupon).filter(Coupon.id == coupon.id).first()
        assert refreshed.times_redeemed == 1
        assert s.query(CouponRedemption).filter(CouponRedemption.coupon_id == coupon.id).count() == 1


def test_admin_rejects_uncapped_percentage_coupons(client, make_admin):
    admin = make_admin()
    res = client.post("/api/admin/coupons", headers=admin["headers"], json={
        "code": "RISKY", "discount_type": "percent", "value": "50",
    })
    assert res.status_code == 400
    assert "max_discount" in res.json()["detail"]


def test_admin_rejects_percentages_over_100(client, make_admin):
    admin = make_admin()
    res = client.post("/api/admin/coupons", headers=admin["headers"], json={
        "code": "TOOMUCH", "discount_type": "percent", "value": "150", "max_discount": "10",
    })
    assert res.status_code == 400


def test_customers_cannot_create_coupons(client, make_customer):
    user = make_customer()
    res = client.post("/api/admin/coupons", headers=user["headers"], json={
        "code": "FREE", "discount_type": "fixed", "value": "999",
    })
    assert res.status_code == 403


# ----- reviews -----

def test_reviews_are_public(client, make_book):
    book = make_book()
    res = client.get(f"/api/catalog/books/{book.id}/reviews")
    assert res.status_code == 200
    assert res.json()["count"] == 0


def test_posting_a_review_updates_the_books_rating(client, make_customer, make_book):
    user, book = make_customer(), make_book()
    res = client.put(f"/api/catalog/books/{book.id}/reviews",
                     json={"rating": 5, "title": "Loved it", "body": "Great read"},
                     headers=user["headers"])
    assert res.status_code == 200, res.text

    with SessionLocal() as s:
        refreshed = s.query(Book).filter(Book.id == book.id).first()
        assert refreshed.rating == pytest.approx(5.0)
        assert refreshed.rating_count == 1


def test_a_second_review_averages_the_rating(client, make_customer, make_book):
    book = make_book()
    a, b = make_customer(), make_customer()
    client.put(f"/api/catalog/books/{book.id}/reviews", json={"rating": 5}, headers=a["headers"])
    client.put(f"/api/catalog/books/{book.id}/reviews", json={"rating": 3}, headers=b["headers"])

    summary = client.get(f"/api/catalog/books/{book.id}/reviews").json()
    assert summary["count"] == 2
    assert summary["average"] == pytest.approx(4.0)
    assert summary["breakdown"]["5"] == 1
    assert summary["breakdown"]["3"] == 1


def test_reviewing_twice_edits_rather_than_stacks(client, make_customer, make_book, db_session):
    """Otherwise one account could inflate a book's rating indefinitely."""
    user, book = make_customer(), make_book()
    client.put(f"/api/catalog/books/{book.id}/reviews", json={"rating": 1}, headers=user["headers"])
    client.put(f"/api/catalog/books/{book.id}/reviews", json={"rating": 5}, headers=user["headers"])

    assert db_session.query(Review).filter(Review.book_id == book.id).count() == 1
    summary = client.get(f"/api/catalog/books/{book.id}/reviews").json()
    assert summary["count"] == 1
    assert summary["average"] == pytest.approx(5.0)


@pytest.mark.parametrize("rating", [0, 6, -1, 99])
def test_out_of_range_ratings_are_rejected(client, make_customer, make_book, rating):
    user, book = make_customer(), make_book()
    res = client.put(f"/api/catalog/books/{book.id}/reviews",
                     json={"rating": rating}, headers=user["headers"])
    assert res.status_code == 422


def test_guests_cannot_post_reviews(client, make_book):
    book = make_book()
    assert client.put(f"/api/catalog/books/{book.id}/reviews", json={"rating": 5}).status_code == 401


def test_deleting_a_review_restores_the_rating(client, make_customer, make_book):
    user, book = make_customer(), make_book()
    client.put(f"/api/catalog/books/{book.id}/reviews", json={"rating": 5}, headers=user["headers"])
    assert client.delete(f"/api/catalog/books/{book.id}/reviews", headers=user["headers"]).status_code == 204

    with SessionLocal() as s:
        refreshed = s.query(Book).filter(Book.id == book.id).first()
        assert refreshed.rating_count == 0


# ----- payments -----

def test_payment_reports_disabled_without_gateway_keys(client, make_customer, make_book):
    """Better an honest 'not configured' than an order silently marked paid."""
    user, book = make_customer(), make_book(stock=5)
    _add(client, user["headers"], book)
    order = client.post("/api/customer/checkout",
                        json={"address": ADDRESS}, headers=user["headers"]).json()

    assert order["payment_status"] == "pending"

    res = client.post(f"/api/customer/orders/{order['id']}/payment", headers=user["headers"])
    assert res.status_code == 200
    assert res.json()["enabled"] is False


def test_payment_confirmation_rejects_a_forged_signature(client, make_customer, make_book):
    """Without signature checking, any client could claim a free order."""
    user, book = make_customer(), make_book(stock=5)
    _add(client, user["headers"], book)
    order = client.post("/api/customer/checkout",
                        json={"address": ADDRESS}, headers=user["headers"]).json()

    res = client.post(
        f"/api/customer/orders/{order['id']}/payment/confirm",
        json={
            "razorpay_order_id": "order_fake",
            "razorpay_payment_id": "pay_fake",
            "razorpay_signature": "definitely-not-valid",
        },
        headers=user["headers"],
    )
    assert res.status_code == 400

    with SessionLocal() as s:
        refreshed = s.query(Order).filter(Order.id == order["id"]).first()
        assert refreshed.payment_status != "paid"


def test_signature_verification_is_correct():
    """A genuine Razorpay signature verifies; a tampered one does not."""
    import hashlib
    import hmac

    from app.core import payments
    from app.core.config import settings

    original = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    settings.RAZORPAY_KEY_ID = "rzp_test_key"
    settings.RAZORPAY_KEY_SECRET = "super-secret"
    try:
        good = hmac.new(b"super-secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
        assert payments.verify_payment_signature(
            razorpay_order_id="order_1", razorpay_payment_id="pay_1", signature=good
        )
        assert not payments.verify_payment_signature(
            razorpay_order_id="order_1", razorpay_payment_id="pay_2", signature=good
        )
    finally:
        settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET = original


def test_rupees_convert_to_paise():
    from app.core.payments import to_minor_units

    assert to_minor_units(Decimal("199.40")) == 19940
    assert to_minor_units(Decimal("1.00")) == 100


def _queued_reset_token(db_session) -> str:
    """The raw token as it was handed to the queue.

    Only its hash is stored on `password_reset_tokens`, so the job payload is the
    only place the usable value exists — which is also what the e-mail sends.
    """
    from app.database.models.job import Job

    job = (
        db_session.query(Job)
        .filter(Job.kind == "password_reset_email")
        .order_by(Job.created_at.desc())
        .first()
    )
    assert job is not None, "no password reset email was queued"
    return job.payload["token"]


# ----- password reset -----

def test_reset_request_does_not_reveal_whether_an_account_exists(client, make_customer):
    user = make_customer()
    known = client.post("/auth/password-reset/request", json={"email": user["email"]})
    unknown = client.post("/auth/password-reset/request", json={"email": "nobody@bookvuk.com"})

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()


def test_reset_flow_changes_the_password(client, make_customer, db_session):
    user = make_customer()
    assert client.post("/auth/password-reset/request", json={"email": user["email"]}).status_code == 202
    token = _queued_reset_token(db_session)

    res = client.post("/auth/password-reset/confirm",
                      json={"token": token, "password": "BrandNewPass1!"})
    assert res.status_code == 200, res.text

    assert client.post("/auth/login",
                       data={"username": user["email"], "password": user["password"]}).status_code == 401
    assert client.post("/auth/login",
                       data={"username": user["email"], "password": "BrandNewPass1!"}).status_code == 200


def test_a_reset_token_works_only_once(client, make_customer, db_session):
    user = make_customer()
    client.post("/auth/password-reset/request", json={"email": user["email"]})
    token = _queued_reset_token(db_session)

    first = client.post("/auth/password-reset/confirm",
                        json={"token": token, "password": "FirstNewPass1!"})
    assert first.status_code == 200
    second = client.post("/auth/password-reset/confirm",
                         json={"token": token, "password": "SecondNewPass1!"})
    assert second.status_code == 400


def test_expired_reset_token_is_rejected(client, make_customer, db_session):
    user = make_customer()
    client.post("/auth/password-reset/request", json={"email": user["email"]})
    token = _queued_reset_token(db_session)

    row = db_session.query(PasswordResetToken).filter(PasswordResetToken.used_at.is_(None)).first()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    res = client.post("/auth/password-reset/confirm",
                      json={"token": token, "password": "AnotherPass1!"})
    assert res.status_code == 400


def test_garbage_reset_token_is_rejected(client):
    res = client.post("/auth/password-reset/confirm",
                      json={"token": "x" * 40, "password": "WhateverPass1!"})
    assert res.status_code == 400


def test_reset_revokes_existing_sessions(client, make_customer, db_session):
    """A reset usually means the account may be compromised."""
    user = make_customer()
    client.post("/auth/password-reset/request", json={"email": user["email"]})
    client.post("/auth/password-reset/confirm",
                json={"token": _queued_reset_token(db_session), "password": "RotatedPass1!"})

    res = client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert res.status_code == 401


def test_reset_tokens_are_stored_hashed(client, make_customer, db_session):
    user = make_customer()
    client.post("/auth/password-reset/request", json={"email": user["email"]})
    token = _queued_reset_token(db_session)

    row = db_session.query(PasswordResetToken).first()
    assert row.token_hash != token
    assert len(row.token_hash) == 64
