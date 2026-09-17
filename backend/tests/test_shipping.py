"""The courier registry, and what the tracking schemas refuse.

Tracking is the one part of an order the customer is given to act on. A number
that reaches the database half-formed — a courier with no number, a number with
no courier, a slug nothing can build a URL from — produces an e-mail and an order
page that promise a parcel can be followed and then cannot follow it.

The rules live in the schema rather than in each route, so these pin the schema.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core import shipping
from app.schema.admin import AdminOrderStatusUpdate, AdminOrderTrackingUpdate


# ---------------------------------------------------------------------------
# The registry
# ---------------------------------------------------------------------------

def test_every_carrier_has_a_unique_slug_and_a_label():
    slugs = [c.slug for c in shipping.CARRIERS]
    assert len(slugs) == len(set(slugs))
    assert all(c.label for c in shipping.CARRIERS)


def test_other_is_present_so_an_unlisted_courier_is_still_recordable():
    """The list will never be complete, and a number is worth having regardless."""
    assert shipping.OTHER in shipping.CARRIER_SLUGS


def test_a_url_template_either_carries_the_number_or_is_empty():
    """A "track it" link that lands on a blank form is worse than no link.

    It looks like it will show the parcel and does not, so the customer has a
    worse experience than being handed the number to paste themselves.
    """
    for c in shipping.CARRIERS:
        if c.url_template:
            assert "{}" in c.url_template, f"{c.slug} has a URL that ignores the number"


def test_tracking_url_includes_the_number():
    url = shipping.tracking_url("delhivery", "ABC123")
    assert url is not None and "ABC123" in url


@pytest.mark.parametrize("slug,number", [
    ("indiapost", "EI123456789IN"),   # no per-consignment page
    ("other", "X1"),                  # hand delivery
    ("no-such-courier", "X1"),        # dropped from the list since
    (None, "X1"),
    ("delhivery", None),
])
def test_tracking_url_is_none_rather_than_broken(slug, number):
    assert shipping.tracking_url(slug, number) is None


def test_label_falls_back_to_the_slug_for_a_retired_courier():
    """Dropping a courier must not blank it out on every order it ever carried."""
    assert shipping.label_for("gone-bust") == "gone-bust"
    assert shipping.label_for(None) is None


@pytest.mark.parametrize("raw,expected", [
    ("  dl 4477 22xy ", "DL447722XY"),
    ("\tab\ncd\r", "ABCD"),
    ("   ", None),
    ("", None),
    (None, None),
])
def test_numbers_are_tidied_because_they_are_transcribed_by_hand(raw, expected):
    """Spaces and case come from reading a label, never from the number itself.

    Left in, the same parcel looks like two different ones in a search.
    """
    assert shipping.normalise_number(raw) == expected


# ---------------------------------------------------------------------------
# What the schemas refuse
# ---------------------------------------------------------------------------

def test_a_known_courier_and_number_are_accepted_and_normalised():
    payload = AdminOrderTrackingUpdate(trackingCarrier="Delhivery", trackingNumber=" ab 12 ")
    assert payload.tracking_carrier == "delhivery"
    assert payload.tracking_number == "AB12"


def test_an_unknown_courier_is_refused():
    """Not a harmless label: the tracking URL is derived from this, so an
    unrecognised value is a courier the customer can never be given a link for."""
    with pytest.raises(ValidationError):
        AdminOrderTrackingUpdate(trackingCarrier="fedex-moon", trackingNumber="X1")


@pytest.mark.parametrize("payload", [
    {"trackingCarrier": "delhivery"},          # courier, no number
    {"trackingNumber": "X1"},                  # number, no courier
])
def test_half_a_shipment_is_refused(payload):
    with pytest.raises(ValidationError):
        AdminOrderTrackingUpdate(**payload)


def test_both_absent_clears_the_shipment():
    """The parcel turned out not to have gone; that has to be recordable."""
    payload = AdminOrderTrackingUpdate()
    assert payload.tracking_carrier is None and payload.tracking_number is None


def test_unknown_fields_are_refused():
    with pytest.raises(ValidationError):
        AdminOrderTrackingUpdate(trackingCarrier="dtdc", trackingNumber="X1", status="shipped")


# ---------------------------------------------------------------------------
# Tracking rides along with `shipped`, and only that
# ---------------------------------------------------------------------------

def test_tracking_is_accepted_alongside_shipped():
    payload = AdminOrderStatusUpdate(
        status="shipped", trackingCarrier="bluedart", trackingNumber="99887766"
    )
    assert payload.tracking_number == "99887766"


def test_a_status_change_without_tracking_is_still_fine():
    assert AdminOrderStatusUpdate(status="packed").tracking_number is None


@pytest.mark.parametrize("status", ["packed", "delivered", "cancelled", "processing"])
def test_tracking_on_any_other_status_is_refused(status):
    """A consignment number on a cancelled order is noise nobody can interpret.

    This is the case a field validator got wrong: `status` is declared on the
    subclass and `tracking_number` is inherited, so the field validator ran
    before `status` existed and the check passed unconditionally.
    """
    with pytest.raises(ValidationError):
        AdminOrderStatusUpdate(
            status=status, trackingCarrier="delhivery", trackingNumber="X1"
        )


def test_an_unknown_status_is_still_refused():
    with pytest.raises(ValidationError):
        AdminOrderStatusUpdate(status="teleported")
