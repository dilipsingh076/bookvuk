"""What a return claim will and will not accept, before it reaches a database.

Every one of these ends in money moving, so the schema is the last cheap place
to refuse a claim that cannot be acted on.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.database.models.returns import (
    RETURN_REASONS,
    RETURN_RESOLUTIONS,
    RETURN_STATUSES,
    RETURN_TERMINAL_STATUSES,
)
from app.schema.returns import AdminReturnDecision, AdminReturnResolve, ReturnCreate

ITEM = "11111111-1111-1111-1111-111111111111"


# ---------------------------------------------------------------------------
# The vocabulary
# ---------------------------------------------------------------------------

def test_terminal_statuses_are_a_subset_of_the_statuses():
    assert set(RETURN_TERMINAL_STATUSES) <= set(RETURN_STATUSES)


def test_a_claim_cannot_start_in_a_terminal_state():
    assert "requested" not in RETURN_TERMINAL_STATUSES


def test_reasons_are_countable_categories_not_free_text():
    """The point of recording a reason is to be able to count it: damage trending
    up is a packaging problem, "not as described" trending up on used stock is a
    grading problem, and free text answers neither."""
    assert "damaged" in RETURN_REASONS and "not_as_described" in RETURN_REASONS


def test_wallet_is_a_resolution_because_credit_keeps_the_money_in_the_shop():
    assert "wallet" in RETURN_RESOLUTIONS and "source" in RETURN_RESOLUTIONS


# ---------------------------------------------------------------------------
# Opening a claim
# ---------------------------------------------------------------------------

def test_a_normal_claim_is_accepted():
    payload = ReturnCreate(order_item_id=ITEM, reason="damaged")
    assert payload.quantity == 1


def test_other_without_words_is_refused():
    """Every other reason says what happened on its own. "Other" says only that
    none of them fit, which leaves the shop with a claim and no claim."""
    with pytest.raises(ValidationError):
        ReturnCreate(order_item_id=ITEM, reason="other")


def test_other_with_words_is_fine():
    payload = ReturnCreate(order_item_id=ITEM, reason="other", detail="Cover is upside down")
    assert payload.detail


def test_an_unknown_reason_is_refused():
    with pytest.raises(ValidationError):
        ReturnCreate(order_item_id=ITEM, reason="vibes")


@pytest.mark.parametrize("quantity", [0, -1])
def test_a_claim_for_no_copies_is_refused(quantity):
    with pytest.raises(ValidationError):
        ReturnCreate(order_item_id=ITEM, reason="damaged", quantity=quantity)


# ---------------------------------------------------------------------------
# Deciding
# ---------------------------------------------------------------------------

def test_a_refusal_needs_a_reason_the_customer_can_read():
    with pytest.raises(ValidationError):
        AdminReturnDecision(approve=False)


def test_a_refusal_of_whitespace_is_not_a_reason():
    with pytest.raises(ValidationError):
        AdminReturnDecision(approve=False, rejection_reason="   ")


def test_accepting_needs_no_reason():
    assert AdminReturnDecision(approve=True).rejection_reason is None


# ---------------------------------------------------------------------------
# Resolving
# ---------------------------------------------------------------------------

def test_resolution_must_be_one_of_the_known_outcomes():
    with pytest.raises(ValidationError):
        AdminReturnResolve(resolution="cheque")


def test_amount_defaults_to_absent_so_the_route_can_use_the_line_total():
    """None is not zero here. Absent means "the whole line", which is the answer
    in almost every case; zero would be a refund of nothing."""
    assert AdminReturnResolve(resolution="wallet").amount is None


def test_a_negative_refund_is_refused():
    with pytest.raises(ValidationError):
        AdminReturnResolve(resolution="wallet", amount=-1)
