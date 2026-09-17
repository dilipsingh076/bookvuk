"""Store credit: the ledger, the per-order cap, and spending it at checkout.

Store credit is money the shop owes. The two things that must hold: the balance can
never be wrong (which is why it is derived, not stored), and credit can never be
spent twice — including the case where an order is cancelled and the credit has to
come back without the customer gaining any.
"""

from decimal import Decimal

import pytest

from app.core import wallet
from app.core.config import settings
from app.database.models.order import Order
from app.database.models.wallet import WalletTransaction


def _give(db_session, user_id, amount, note="test credit"):
    wallet.credit(db_session, user_id, amount, kind=wallet.KIND_BUYBACK_PAYOUT, note=note)
    db_session.commit()


# ----- the ledger -----

def test_a_new_customer_has_no_credit(db_session, make_customer):
    user = make_customer()
    assert wallet.balance(db_session, user["id"]) == Decimal("0.00")


def test_the_balance_is_the_sum_of_the_ledger(db_session, make_customer):
    """Derived rather than stored: a cached balance and its history are two records
    of the same fact, and there is no way to say which is right when they differ."""
    user = make_customer()
    _give(db_session, user["id"], Decimal("100"))
    _give(db_session, user["id"], Decimal("55.50"))

    assert wallet.balance(db_session, user["id"]) == Decimal("155.50")


def test_credits_and_debits_net_out(db_session, make_customer):
    user = make_customer()
    _give(db_session, user["id"], Decimal("200"))
    wallet.redeem(db_session, user["id"], Decimal("50"), subtotal=Decimal("1000"))
    db_session.commit()

    assert wallet.balance(db_session, user["id"]) == Decimal("150.00")


def test_one_customer_cannot_see_anothers_credit(db_session, make_customer):
    a, b = make_customer(), make_customer()
    _give(db_session, a["id"], Decimal("500"))

    assert wallet.balance(db_session, b["id"]) == Decimal("0.00")


def test_a_zero_credit_is_refused(db_session, make_customer):
    """Always a bug at the call site rather than a real event."""
    user = make_customer()
    with pytest.raises(wallet.WalletError):
        wallet.credit(db_session, user["id"], Decimal("0"),
                      kind=wallet.KIND_ADJUSTMENT, note="nothing")


def test_a_negative_credit_is_refused(db_session, make_customer):
    user = make_customer()
    with pytest.raises(wallet.WalletError):
        wallet.credit(db_session, user["id"], Decimal("-10"),
                      kind=wallet.KIND_ADJUSTMENT, note="wrong direction")


def test_history_is_newest_first(db_session, make_customer):
    user = make_customer()
    _give(db_session, user["id"], Decimal("10"), note="first")
    _give(db_session, user["id"], Decimal("20"), note="second")

    notes = [e.note for e in wallet.history(db_session, user["id"])]
    assert notes[0] == "second"


# ----- the per-order cap -----

def test_credit_cannot_cover_a_whole_order(db_session, make_customer):
    """Without a cap, a seller with a big balance takes stock for nothing and the
    shop ships goods with no money arriving."""
    user = make_customer()
    _give(db_session, user["id"], Decimal("10000"))

    allowed = wallet.max_redeemable(db_session, user["id"], Decimal("1000"))
    percent = Decimal(settings.WALLET_MAX_REDEMPTION_PERCENT) / Decimal("100")
    assert allowed == Decimal("1000") * percent
    assert allowed < Decimal("1000")


def test_the_cap_never_exceeds_the_balance(db_session, make_customer):
    user = make_customer()
    _give(db_session, user["id"], Decimal("30"))

    assert wallet.max_redeemable(db_session, user["id"], Decimal("1000")) == Decimal("30.00")


def test_spending_over_the_cap_is_refused(db_session, make_customer):
    user = make_customer()
    _give(db_session, user["id"], Decimal("10000"))

    with pytest.raises(wallet.WalletError, match="up to"):
        wallet.redeem(db_session, user["id"], Decimal("900"), subtotal=Decimal("1000"))


def test_spending_more_than_you_have_is_refused(db_session, make_customer):
    user = make_customer()
    _give(db_session, user["id"], Decimal("40"))

    with pytest.raises(wallet.WalletError, match="only have"):
        wallet.redeem(db_session, user["id"], Decimal("100"), subtotal=Decimal("10000"))


def test_an_empty_cart_allows_nothing(db_session, make_customer):
    user = make_customer()
    _give(db_session, user["id"], Decimal("500"))
    assert wallet.max_redeemable(db_session, user["id"], Decimal("0")) == Decimal("0.00")


# ----- spending it at checkout -----

def _cart(client, user, book, qty=1):
    client.post("/api/customer/cart/items",
                json={"book_id": str(book.id), "quantity": qty}, headers=user["headers"])


def test_checkout_applies_credit_and_records_it(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="1000.00", stock=5)
    _give(db_session, user["id"], Decimal("300"))
    _cart(client, user, book)

    res = client.post("/api/customer/checkout", json={"wallet_credit": "300"},
                      headers=user["headers"])
    assert res.status_code == 200, res.text
    body = res.json()

    # The order is still worth what the goods are worth; the credit is a tender.
    assert Decimal(body["wallet_credit_used"]) == Decimal("300.00")
    assert Decimal(body["total"]) > Decimal("300.00")
    assert wallet.balance(db_session, user["id"]) == Decimal("0.00")


def test_checkout_without_credit_spends_none(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="500.00", stock=5)
    _give(db_session, user["id"], Decimal("300"))
    _cart(client, user, book)

    client.post("/api/customer/checkout", headers=user["headers"])
    assert wallet.balance(db_session, user["id"]) == Decimal("300.00")


def test_checkout_refuses_more_credit_than_the_cap(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="100.00", stock=5)
    _give(db_session, user["id"], Decimal("10000"))
    _cart(client, user, book)

    res = client.post("/api/customer/checkout", json={"wallet_credit": "5000"},
                      headers=user["headers"])
    assert res.status_code == 400
    assert "credit" in res.json()["detail"].lower()


def test_a_failed_checkout_spends_no_credit(client, make_customer, make_book, db_session):
    """The ledger write and the order are one transaction, so a rejected checkout
    must not leave the credit gone."""
    user = make_customer()
    book = make_book(price="100.00", stock=5)
    _give(db_session, user["id"], Decimal("10000"))
    _cart(client, user, book)

    client.post("/api/customer/checkout", json={"wallet_credit": "5000"}, headers=user["headers"])

    db_session.expire_all()
    assert wallet.balance(db_session, user["id"]) == Decimal("10000.00")


def test_the_ledger_entry_names_the_order_that_spent_it(
    client, make_customer, make_book, db_session
):
    user = make_customer()
    book = make_book(price="1000.00", stock=5)
    _give(db_session, user["id"], Decimal("200"))
    _cart(client, user, book)

    order_id = client.post("/api/customer/checkout", json={"wallet_credit": "200"},
                           headers=user["headers"]).json()["id"]

    entry = (
        db_session.query(WalletTransaction)
        .filter(WalletTransaction.kind == wallet.KIND_ORDER_REDEMPTION)
        .first()
    )
    assert str(entry.order_id) == order_id


def test_the_gateway_is_only_asked_for_what_credit_did_not_cover(
    client, make_customer, make_book, db_session
):
    """Charging the full total would take the money twice for the same goods."""
    from app.api.routes.customer import _amount_payable

    user = make_customer()
    book = make_book(price="1000.00", stock=5)
    _give(db_session, user["id"], Decimal("400"))
    _cart(client, user, book)

    order_id = client.post("/api/customer/checkout", json={"wallet_credit": "400"},
                           headers=user["headers"]).json()["id"]

    order = db_session.query(Order).filter(Order.id == order_id).first()
    assert _amount_payable(order) == Decimal(str(order.total)) - Decimal("400.00")


# ----- cancelling -----

def test_cancelling_returns_the_credit(client, make_customer, make_book, db_session):
    """Otherwise the credit half of a part-paid order simply vanishes: the gateway
    refund only covers what went on a card."""
    user = make_customer()
    book = make_book(price="1000.00", stock=5)
    _give(db_session, user["id"], Decimal("300"))
    _cart(client, user, book)

    order_id = client.post("/api/customer/checkout", json={"wallet_credit": "300"},
                           headers=user["headers"]).json()["id"]
    assert wallet.balance(db_session, user["id"]) == Decimal("0.00")

    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    db_session.expire_all()
    assert wallet.balance(db_session, user["id"]) == Decimal("300.00")


def test_cancelling_twice_returns_the_credit_once(client, make_customer, make_book, db_session):
    user = make_customer()
    book = make_book(price="1000.00", stock=5)
    _give(db_session, user["id"], Decimal("300"))
    _cart(client, user, book)

    order_id = client.post("/api/customer/checkout", json={"wallet_credit": "300"},
                           headers=user["headers"]).json()["id"]
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])
    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])

    db_session.expire_all()
    assert wallet.balance(db_session, user["id"]) == Decimal("300.00")


def test_an_admin_cancellation_also_returns_the_credit(
    client, make_admin, make_customer, make_book, db_session
):
    """Both cancellation paths go through the same function, so this cannot drift."""
    admin, user = make_admin(), make_customer()
    book = make_book(price="1000.00", stock=5)
    _give(db_session, user["id"], Decimal("250"))
    _cart(client, user, book)

    order_id = client.post("/api/customer/checkout", json={"wallet_credit": "250"},
                           headers=user["headers"]).json()["id"]
    client.put(f"/api/admin/orders/{order_id}/status", json={"status": "cancelled"},
               headers=admin["headers"])

    db_session.expire_all()
    assert wallet.balance(db_session, user["id"]) == Decimal("250.00")


def test_cancelling_an_order_with_no_credit_changes_nothing(
    client, make_customer, make_book, db_session
):
    user = make_customer()
    book = make_book(price="500.00", stock=5)
    _cart(client, user, book)
    order_id = client.post("/api/customer/checkout", headers=user["headers"]).json()["id"]

    client.patch(f"/api/customer/orders/{order_id}/cancel", headers=user["headers"])
    assert wallet.balance(db_session, user["id"]) == Decimal("0.00")


# ----- the API -----

def test_the_wallet_endpoint_reports_balance_and_cap(client, make_customer, db_session):
    user = make_customer()
    _give(db_session, user["id"], Decimal("500"))

    body = client.get("/api/buyback/wallet?subtotal=200", headers=user["headers"]).json()
    assert Decimal(body["balance"]) == Decimal("500.00")
    assert Decimal(body["max_redeemable_now"]) == Decimal("100.00")  # 50% of 200
    assert body["max_redemption_percent"] == settings.WALLET_MAX_REDEMPTION_PERCENT
    assert len(body["entries"]) == 1


def test_the_wallet_endpoint_needs_an_account(client):
    assert client.get("/api/buyback/wallet").status_code == 401
