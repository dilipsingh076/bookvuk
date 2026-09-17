"""Lifecycle e-mails: order status, back-in-stock, abandoned carts.

All three go through the existing queue rather than the request, so what is tested
here is mostly *when* a job is created and that a retry cannot duplicate the
message. SMTP is not configured in tests, so `send_email` logs instead of sending
— which is the same code path a deployment without credentials takes.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core import job_handlers, sweeps
from app.database.models.cart import Cart, CartItem
from app.database.models.job import Job
from app.database.models.notification import Notification
from app.database.models.wishlist import Wishlist


def _jobs(db_session, kind):
    return db_session.query(Job).filter(Job.kind == kind).all()


def _place_order(client, make_customer, make_book, *, qty=1, stock=10):
    user = make_customer()
    book = make_book(stock=stock)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": qty}, headers=user["headers"])
    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    return user, book, res.json()["id"]


# ----- order status e-mails -----

def test_a_status_change_queues_one_email(client, make_admin, make_customer, make_book, db_session):
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])

    queued = _jobs(db_session, "order_status_email")
    assert len(queued) == 1
    assert queued[0].payload["status"] == "shipped"


def test_repeating_the_same_status_queues_nothing(client, make_admin, make_customer, make_book, db_session):
    """Matches the existing rule for the in-app notification: no change, no news."""
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])
    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])

    assert len(_jobs(db_session, "order_status_email")) == 1


@pytest.fixture
def captured_mail(monkeypatch):
    """Capture what `send_email` was handed, since SMTP is unconfigured in tests."""
    from app.core import email as email_service

    sent = []
    monkeypatch.setattr(
        email_service, "send_email",
        lambda **kw: sent.append(kw) is None and True,
    )
    return sent


def _order_row(db_session, order_id):
    from app.database.models.order import Order

    return db_session.query(Order).filter(Order.id == order_id).first()


def test_the_status_email_names_the_order_the_way_the_site_does(
    client, make_customer, make_book, db_session, captured_mail
):
    """A customer should not have to translate between two references for the
    same order: the e-mail and the order page must agree."""
    from app.core import email as email_service

    user, _, order_id = _place_order(client, make_customer, make_book)
    shown_on_site = client.get(
        f"/api/customer/orders/{order_id}", headers=user["headers"]
    ).json()["order_number"]

    email_service.send_order_status_update(
        to="a@example.com", name="A", order=_order_row(db_session, order_id), status="shipped"
    )

    assert len(captured_mail) == 1
    assert shown_on_site in captured_mail[0]["subject"]
    assert shown_on_site in captured_mail[0]["body"]


@pytest.mark.parametrize(
    "status,expected",
    [
        ("packed", "packed"),
        ("shipped", "on its way"),
        ("delivered", "delivered"),
        ("cancelled", "cancelled"),
    ],
)
def test_each_customer_facing_status_says_what_happened(
    status, expected, client, make_customer, make_book, db_session, captured_mail
):
    from app.core import email as email_service

    _, _, order_id = _place_order(client, make_customer, make_book)

    assert email_service.send_order_status_update(
        to="a@example.com", name="A", order=_order_row(db_session, order_id), status=status
    ) is True
    assert expected in captured_mail[0]["subject"] + captured_mail[0]["body"]


@pytest.mark.parametrize("status", ["paid", "pending", "processing", "banana"])
def test_an_internal_status_sends_no_email_at_all(
    status, client, make_customer, make_book, db_session, captured_mail
):
    """`paid` and `processing` are bookkeeping. Sending a blank "your order is
    processing" e-mail would be noise, so nothing is sent rather than something
    empty."""
    from app.core import email as email_service

    _, _, order_id = _place_order(client, make_customer, make_book)

    assert email_service.send_order_status_update(
        to="a@example.com", name="A", order=_order_row(db_session, order_id), status=status
    ) is False
    assert captured_mail == []


# ----- back in stock -----

def test_restocking_from_zero_queues_a_notice(client, make_admin, make_book, db_session):
    admin = make_admin()
    book = make_book(stock=0)

    client.post(f"/api/admin/inventory/books/{book.id}/restock",
                json={"add_stock": 5}, headers=admin["headers"])

    queued = _jobs(db_session, "back_in_stock_email")
    assert len(queued) == 1
    assert queued[0].payload["book_id"] == str(book.id)


def test_restocking_a_book_that_was_in_stock_queues_nothing(client, make_admin, make_book, db_session):
    """Only the sold-out -> available transition is news."""
    admin = make_admin()
    book = make_book(stock=3)

    client.post(f"/api/admin/inventory/books/{book.id}/restock",
                json={"add_stock": 7}, headers=admin["headers"])

    assert _jobs(db_session, "back_in_stock_email") == []


def test_only_wishlist_holders_are_notified(client, make_admin, make_customer, make_book, db_session):
    admin = make_admin()
    watcher, bystander = make_customer(), make_customer()
    book = make_book(stock=0)

    client.post("/api/customer/wishlist/wishlistToggle",
                json={"book_id": str(book.id)}, headers=watcher["headers"])

    client.post(f"/api/admin/inventory/books/{book.id}/restock",
                json={"add_stock": 4}, headers=admin["headers"])
    job_handlers.back_in_stock_email(db_session, {"book_id": str(book.id)})

    notified = client.get("/api/customer/notifications", headers=watcher["headers"]).json()
    ignored = client.get("/api/customer/notifications", headers=bystander["headers"]).json()

    assert any(n["title"] == "Back in stock" for n in notified)
    assert not any(n["title"] == "Back in stock" for n in ignored)


def test_a_retry_does_not_notify_twice(client, make_admin, make_customer, make_book, db_session):
    admin = make_admin()
    watcher = make_customer()
    book = make_book(stock=0)
    client.post("/api/customer/wishlist/wishlistToggle",
                json={"book_id": str(book.id)}, headers=watcher["headers"])
    client.post(f"/api/admin/inventory/books/{book.id}/restock",
                json={"add_stock": 4}, headers=admin["headers"])

    job_handlers.back_in_stock_email(db_session, {"book_id": str(book.id)})
    job_handlers.back_in_stock_email(db_session, {"book_id": str(book.id)})

    notes = client.get("/api/customer/notifications", headers=watcher["headers"]).json()
    assert sum(1 for n in notes if n["title"] == "Back in stock") == 1


def test_a_book_that_sold_out_again_is_not_advertised(client, make_customer, make_book, db_session):
    """Telling people to come and buy something unavailable is worse than silence."""
    watcher = make_customer()
    book = make_book(stock=0)
    client.post("/api/customer/wishlist/wishlistToggle",
                json={"book_id": str(book.id)}, headers=watcher["headers"])

    # Job runs while stock is still 0 (sold out between restock and delivery).
    job_handlers.back_in_stock_email(db_session, {"book_id": str(book.id)})

    notes = client.get("/api/customer/notifications", headers=watcher["headers"]).json()
    assert not any(n["title"] == "Back in stock" for n in notes)


# ----- abandoned carts -----

def _age_cart(db_session, user_id, *, hours):
    """Backdate a cart's last activity, since tests cannot wait four hours."""
    cart = db_session.query(Cart).filter(Cart.user_id == user_id).first()
    when = datetime.now(timezone.utc) - timedelta(hours=hours)
    for item in db_session.query(CartItem).filter(CartItem.cart_id == cart.id).all():
        item.updated_at = when
    db_session.commit()
    return cart


def _fill_cart(client, make_customer, make_book):
    user = make_customer()
    book = make_book(stock=10)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 2}, headers=user["headers"])
    return user, book


def test_a_fresh_cart_is_left_alone(client, make_customer, make_book, db_session):
    """Someone still shopping must not be told they abandoned anything."""
    user, _ = _fill_cart(client, make_customer, make_book)
    _age_cart(db_session, user["id"], hours=0)

    assert sweeps.sweep_abandoned_carts(db_session) == 0


def test_a_cart_quiet_for_six_hours_is_picked_up(client, make_customer, make_book, db_session):
    user, _ = _fill_cart(client, make_customer, make_book)
    _age_cart(db_session, user["id"], hours=6)

    assert sweeps.sweep_abandoned_carts(db_session) == 1
    assert len(_jobs(db_session, "abandoned_cart_email")) == 1


def test_a_very_old_cart_is_forgotten_not_chased(client, make_customer, make_book, db_session):
    user, _ = _fill_cart(client, make_customer, make_book)
    _age_cart(db_session, user["id"], hours=100)

    assert sweeps.sweep_abandoned_carts(db_session) == 0


def test_the_sweep_does_not_remind_twice_within_the_cooldown(
    client, make_customer, make_book, db_session
):
    """The worker restarts and re-sweeps; a second nudge would read as spam."""
    user, _ = _fill_cart(client, make_customer, make_book)
    _age_cart(db_session, user["id"], hours=6)

    assert sweeps.sweep_abandoned_carts(db_session) == 1
    assert sweeps.sweep_abandoned_carts(db_session) == 0
    assert len(_jobs(db_session, "abandoned_cart_email")) == 1


def test_the_reminder_is_skipped_when_the_cart_was_emptied(
    client, make_customer, make_book, db_session, monkeypatch
):
    """The job runs later than the sweep, and by then they may have checked out."""
    sent = []
    monkeypatch.setattr(
        job_handlers.email_service, "send_abandoned_cart",
        lambda **kw: sent.append(kw) or True,
    )

    user, _ = _fill_cart(client, make_customer, make_book)
    client.delete("/api/customer/cart/cartClear", headers=user["headers"])

    job_handlers.abandoned_cart_email(db_session, {"user_id": str(user["id"])})
    assert sent == []


def test_the_reminder_lists_what_is_in_the_cart(
    client, make_customer, make_book, db_session, monkeypatch
):
    sent = {}
    monkeypatch.setattr(
        job_handlers.email_service, "send_abandoned_cart",
        lambda **kw: sent.update(kw) or True,
    )

    user, book = _fill_cart(client, make_customer, make_book)
    job_handlers.abandoned_cart_email(db_session, {"user_id": str(user["id"])})

    assert sent["items"] == [(book.title, 2)]
    assert sent["cart_total"] == 200  # 2 x 100.00


def test_run_due_sweeps_reports_what_it_queued(client, make_customer, make_book, db_session):
    user, _ = _fill_cart(client, make_customer, make_book)
    _age_cart(db_session, user["id"], hours=6)

    assert sweeps.run_due_sweeps(db_session) == {"abandoned_carts": 1}


def test_all_new_kinds_are_registered():
    """`enqueue` rejects an unknown kind, so the routes depend on this."""
    from app.core.jobs import registered_kinds

    for kind in ("order_status_email", "back_in_stock_email", "abandoned_cart_email"):
        assert kind in registered_kinds()
