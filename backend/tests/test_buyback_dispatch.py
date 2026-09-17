"""The seller's dispatch, and what a photograph may be labelled.

Both are small surfaces that sit in front of something expensive: a shipment the
shop waits for, and the evidence a grade is decided from.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.database.models.buyback import (
    BUYBACK_PHOTO_KINDS,
    BUYBACK_STATUSES,
    BUYBACK_TERMINAL_STATUSES,
)
from app.schema.buyback import BuybackDispatch


def test_expired_is_a_known_status_and_a_terminal_one():
    """A lapsed offer is closed. Re-opening it would revive a price the shop no
    longer stands behind."""
    assert "expired" in BUYBACK_STATUSES
    assert "expired" in BUYBACK_TERMINAL_STATUSES


def test_terminal_statuses_are_a_subset_of_the_statuses():
    assert set(BUYBACK_TERMINAL_STATUSES) <= set(BUYBACK_STATUSES)


def test_photo_kinds_cover_what_decides_a_grade():
    """Three labelled photographs are readable at a glance; three unlabelled ones
    are three pictures of a book."""
    assert {"cover", "spine", "damage"} <= set(BUYBACK_PHOTO_KINDS)


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def test_an_empty_dispatch_is_allowed():
    """Plenty of sellers hand a parcel over a counter and get no docket. Refusing
    their "I have posted it" for want of a number would leave the shop blinder
    than it was before."""
    payload = BuybackDispatch()
    assert payload.carrier is None and payload.tracking_number is None


def test_a_complete_dispatch_is_normalised():
    payload = BuybackDispatch(carrier="DTDC", tracking_number=" dt 99 11 aa ")
    assert payload.carrier == "dtdc"
    assert payload.tracking_number == "DT9911AA"


def test_an_unknown_courier_is_refused():
    with pytest.raises(ValidationError):
        BuybackDispatch(carrier="owl-post", tracking_number="X1")


@pytest.mark.parametrize("payload", [
    {"carrier": "dtdc"},            # courier, no number
    {"tracking_number": "X1"},      # number, no courier
])
def test_half_a_shipment_is_refused(payload):
    """A number with no courier cannot be turned into a link, and a courier with
    no number identifies no parcel."""
    with pytest.raises(ValidationError):
        BuybackDispatch(**payload)


def test_whitespace_only_number_counts_as_absent():
    """It arrives from a paste, and treating it as a number would produce half a
    shipment the both-or-neither rule then has to refuse — confusingly, since the
    seller believes they entered something."""
    assert BuybackDispatch(tracking_number="   ").tracking_number is None
