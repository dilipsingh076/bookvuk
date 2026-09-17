"""Couriers, and how to turn a consignment number into a link.

The order lifecycle went `packed -> shipped -> delivered` without anything ever
recording *which parcel*. So "it has shipped" was the whole message: no courier,
no consignment number, nothing the customer could take to the courier's own
site. Every "where is my order" then had to be answered by hand.

The tracking URL is derived here rather than stored alongside the number. A
stored URL is a second copy of the same fact that can disagree with it, and when
a courier changes its tracking path every historic order keeps the dead link;
derived, one edit here fixes all of them.

`OTHER` exists because the list below will never be complete. A courier nobody
anticipated still has to be recordable — the number is worth having even with no
link to hang it on.
"""

from __future__ import annotations

from typing import Final, NamedTuple, Optional


class Carrier(NamedTuple):
    slug: str
    label: str
    #: `{}` is replaced by the consignment number. Empty when the courier has no
    #: public per-consignment URL.
    url_template: str


OTHER: Final[str] = "other"

#: Ordered as an Indian bookshop would actually pick: the ones that carry most
#: parcels first, `other` last.
CARRIERS: Final[tuple[Carrier, ...]] = (
    Carrier("delhivery", "Delhivery", "https://www.delhivery.com/tracking?trackingId={}"),
    Carrier("bluedart", "Blue Dart", "https://www.bluedart.com/tracking?trackingNo={}"),
    Carrier("dtdc", "DTDC", "https://www.dtdc.in/tracking.asp?strCnno={}"),
    # India Post has no per-consignment URL — its page is a form you paste the
    # number into. Deliberately no template: a "track it" link that lands on a
    # blank form is worse than the number on its own, because it looks like it
    # will show the parcel and does not.
    Carrier("indiapost", "India Post", ""),
    Carrier("ekart", "Ekart", "https://ekartlogistics.com/shipmenttrack/{}"),
    Carrier("xpressbees", "XpressBees", "https://www.xpressbees.com/shipment/tracking?awb={}"),
    Carrier("shadowfax", "Shadowfax", "https://shadowfax.in/track/{}"),
    Carrier("ecomexpress", "Ecom Express", "https://ecomexpress.in/tracking/?awb_field={}"),
    Carrier(OTHER, "Other / hand delivery", ""),
)

CARRIER_SLUGS: Final[frozenset[str]] = frozenset(c.slug for c in CARRIERS)

_BY_SLUG: Final[dict[str, Carrier]] = {c.slug: c for c in CARRIERS}


def label_for(slug: Optional[str]) -> Optional[str]:
    """The courier's display name, or the raw slug if it is no longer listed.

    Falling back to the slug rather than to None on purpose: a carrier dropped
    from the list above must not blank out the courier on every order it ever
    carried.
    """
    if not slug:
        return None
    carrier = _BY_SLUG.get(slug)
    return carrier.label if carrier else slug


def tracking_url(slug: Optional[str], number: Optional[str]) -> Optional[str]:
    """A link the customer can follow, when the courier offers one.

    None — not a broken link — when either half is missing, when the courier is
    unknown, or when it has no per-consignment URL (India Post wants the number
    typed into a form). The screens then show the number as plain text, which is
    still the thing worth having.
    """
    if not slug or not number:
        return None
    carrier = _BY_SLUG.get(slug)
    if carrier is None or not carrier.url_template:
        return None
    return carrier.url_template.format(number.strip())


def normalise_number(number: Optional[str]) -> Optional[str]:
    """Consignment numbers get read off a label and pasted in.

    Spaces and case are noise from that transcription, never part of the number,
    and leaving them in makes the same parcel look like two different ones in a
    search.
    """
    if number is None:
        return None
    cleaned = "".join(number.split()).upper()
    return cleaned or None
