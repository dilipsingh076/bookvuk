"""Order status whitelist and terminal-state protection."""

import pytest

from app.core.order_status import can_transition, is_terminal


def _place_order(client, make_customer, make_book):
    user = make_customer()
    book = make_book(stock=10)
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": 2}, headers=user["headers"])
    res = client.post("/api/customer/checkout", headers=user["headers"])
    assert res.status_code == 200, res.text
    return user, book, res.json()["id"]


@pytest.mark.parametrize("status", ["banana", "", "PROCESSING", "deleted", "shipped ", "123"])
def test_unknown_status_values_are_rejected(client, make_admin, make_customer, make_book, status):
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)

    res = client.put(f"/api/admin/orders/{order_id}/status",
                     json={"status": status}, headers=admin["headers"])
    assert res.status_code == 422


@pytest.mark.parametrize("status", ["pending", "paid", "packed", "shipped", "delivered", "cancelled"])
def test_known_status_values_are_accepted(client, make_admin, make_customer, make_book, status):
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)

    res = client.put(f"/api/admin/orders/{order_id}/status",
                     json={"status": status}, headers=admin["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["status"] == status


def test_delivered_is_terminal(client, make_admin, make_customer, make_book):
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "delivered"}, headers=admin["headers"])
    res = client.put(f"/api/admin/orders/{order_id}/status",
                     json={"status": "processing"}, headers=admin["headers"])
    assert res.status_code == 409


def test_cancelled_order_cannot_be_revived(client, make_admin, make_customer, make_book):
    """Reviving a cancelled order would double-count the stock it restored."""
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "cancelled"}, headers=admin["headers"])
    res = client.put(f"/api/admin/orders/{order_id}/status",
                     json={"status": "shipped"}, headers=admin["headers"])
    assert res.status_code == 409


# ----- cancelling must restore stock, whoever does it -----

def test_admin_cancel_restores_stock(client, make_admin, make_customer, make_book, db_session):
    """The admin path used to change the status and leave the stock spent.

    Those units are not sold and not reserved by anything, so leaving them
    decremented loses them from inventory permanently — and `sales-trend` then
    excludes the order on the grounds that its stock came back, which it hadn't.
    """
    admin = make_admin()
    _, book, order_id = _place_order(client, make_customer, make_book)

    db_session.refresh(book)
    assert book.stock == 8, "checkout should have taken 2 of the 10"

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "cancelled"}, headers=admin["headers"])

    db_session.refresh(book)
    assert book.stock == 10


def test_admin_and_customer_cancel_leave_the_same_stock(
    client, make_admin, make_customer, make_book, db_session
):
    """Two ways to cancel must not disagree about inventory."""
    admin = make_admin()

    _, book_a, order_a = _place_order(client, make_customer, make_book)
    client.put(f"/api/admin/orders/{order_a}/status",
               json={"status": "cancelled"}, headers=admin["headers"])

    user_b, book_b, order_b = _place_order(client, make_customer, make_book)
    client.patch(f"/api/customer/orders/{order_b}/cancel", headers=user_b["headers"])

    db_session.refresh(book_a)
    db_session.refresh(book_b)
    assert book_a.stock == book_b.stock == 10


def test_cancelling_twice_restores_stock_once(client, make_admin, make_customer, make_book, db_session):
    admin = make_admin()
    user, book, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "cancelled"}, headers=admin["headers"])
    # A second attempt from either side must be a no-op, not a second restore.
    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "cancelled"}, headers=admin["headers"])
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    db_session.refresh(book)
    assert book.stock == 10


def test_sales_trend_excludes_an_admin_cancelled_order(client, make_admin, make_customer, make_book):
    """The trend excludes cancelled orders because their stock returns — so it must."""
    admin = make_admin()
    _, _, order_id = _place_order(client, make_customer, make_book)

    assert client.get("/api/admin/sales-trend?days=7", headers=admin["headers"]).json()["total"] == 2

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "cancelled"}, headers=admin["headers"])

    assert client.get("/api/admin/sales-trend?days=7", headers=admin["headers"]).json()["total"] == 0


def test_setting_the_same_status_is_idempotent(client, make_admin, make_customer, make_book):
    admin = make_admin()
    user, _, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])
    before = len(client.get("/api/customer/notifications", headers=user["headers"]).json())

    res = client.put(f"/api/admin/orders/{order_id}/status",
                     json={"status": "shipped"}, headers=admin["headers"])
    assert res.status_code == 200

    after = len(client.get("/api/customer/notifications", headers=user["headers"]).json())
    assert after == before, "re-sending the same status should not notify again"


def test_customer_cannot_cancel_a_shipped_order(client, make_admin, make_customer, make_book):
    admin = make_admin()
    user, _, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])

    res = client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])
    assert res.status_code == 409


def test_status_change_notifies_the_customer(client, make_admin, make_customer, make_book):
    admin = make_admin()
    user, _, order_id = _place_order(client, make_customer, make_book)

    before = len(client.get("/api/customer/notifications", headers=user["headers"]).json())
    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])
    after = client.get("/api/customer/notifications", headers=user["headers"]).json()

    assert len(after) == before + 1
    assert any("shipped" in n["body"] for n in after)


# ----- stage timestamps, which the customer timeline reads -----

def test_each_stage_records_when_it_happened(client, make_admin, make_customer, make_book):
    """The timeline read shipped_at/delivered_at, which did not exist, so it
    showed a dash for every step no matter how far the order had actually got."""
    admin = make_admin()
    user, _, order_id = _place_order(client, make_customer, make_book)

    def order():
        return client.get(f"/api/customer/orders/{order_id}", headers=user["headers"]).json()

    assert order()["shipped_at"] is None

    for status, field in (("packed", "packed_at"), ("shipped", "shipped_at"),
                          ("delivered", "delivered_at")):
        client.put(f"/api/admin/orders/{order_id}/status",
                   json={"status": status}, headers=admin["headers"])
        assert order()[field] is not None, f"{status} did not record {field}"


def test_cancelling_records_when(client, make_customer, make_book):
    user, _, order_id = _place_order(client, make_customer, make_book)
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    body = client.get(f"/api/customer/orders/{order_id}", headers=user["headers"]).json()
    assert body["cancelled_at"] is not None


def test_a_repeated_status_does_not_move_the_timestamp(client, make_admin, make_customer, make_book):
    """The first time a stage was reached is the true one."""
    admin = make_admin()
    user, _, order_id = _place_order(client, make_customer, make_book)

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])
    first = client.get(f"/api/customer/orders/{order_id}", headers=user["headers"]).json()["shipped_at"]

    client.put(f"/api/admin/orders/{order_id}/status",
               json={"status": "shipped"}, headers=admin["headers"])
    again = client.get(f"/api/customer/orders/{order_id}", headers=user["headers"]).json()["shipped_at"]

    assert first == again


# ----- the order reference the UI displays -----

def test_orders_carry_a_readable_reference(client, make_customer, make_book):
    """Both order pages displayed an `order_number` nothing ever sent."""
    user, _, order_id = _place_order(client, make_customer, make_book)
    body = client.get(f"/api/customer/orders/{order_id}", headers=user["headers"]).json()

    assert body["order_number"].startswith("#")
    assert len(body["order_number"]) == 9
    assert body["order_number"][1:] == order_id.replace("-", "")[:8].upper()


def test_the_reference_is_stable_and_present_in_the_list_too(client, make_customer, make_book):
    user, _, order_id = _place_order(client, make_customer, make_book)

    detail = client.get(f"/api/customer/orders/{order_id}", headers=user["headers"]).json()
    listed = client.get("/api/customer/orders", headers=user["headers"]).json()

    assert [o["order_number"] for o in listed] == [detail["order_number"]]


def test_refund_fields_survive_an_order_that_has_an_address(
    client, make_customer, make_book, db_session
):
    """The address validator used a hand-written field list, which dropped any
    field added to the schema afterwards — the refund columns included.

    Real values are written first: a dropped field falls back to its `None`
    default, so only a populated column can tell the two cases apart.
    """
    from datetime import datetime, timezone
    from decimal import Decimal

    from app.database.models.order import Order

    user, _, order_id = _place_order(client, make_customer, make_book)

    order = db_session.query(Order).filter(Order.id == order_id).first()
    order.refund_amount = Decimal("123.45")
    order.refunded_at = datetime.now(timezone.utc)
    order.shipped_at = datetime.now(timezone.utc)
    db_session.commit()

    body = client.get(f"/api/customer/orders/{order_id}", headers=user["headers"]).json()
    assert body["shipping_address"] is not None, "expected this order to have an address"
    assert Decimal(body["refund_amount"]) == Decimal("123.45")
    assert body["refunded_at"] is not None
    assert body["shipped_at"] is not None


# --- pure unit checks on the transition rules ---

def test_terminal_states():
    assert is_terminal("delivered")
    assert is_terminal("cancelled")
    assert not is_terminal("processing")


def test_transition_rules():
    assert can_transition("processing", "shipped")
    assert can_transition("pending", "cancelled")
    assert not can_transition("cancelled", "processing")
    assert not can_transition("delivered", "shipped")
    # Same-status is always allowed so a repeated PUT is idempotent.
    assert can_transition("cancelled", "cancelled")
