"""Buying used books from customers, and pricing them for resale.

The business case is course books: the same titles are set every year, so a copy
sold back in June is wanted again in July. The shop buys a copy for a fraction of
its printed price and resells it well below a new one — cheap enough that a student
buys here rather than new elsewhere, with room left over.

Two rates per condition, and they are separate on purpose:

  * `BUYBACK_RATES` — what the shop pays the seller.
  * `RESALE_RATES` — what the used copy is then listed at.

The gap between them is the margin, so they must not be derived from each other:
raising what sellers are paid should be a deliberate decision, not something that
silently changes shelf prices.

Everything is computed from the book's *printed* price. For a title already in the
catalogue that is `books.price`. For one a customer types in by hand, it is the MRP
on the cover, which they enter and an admin verifies when the book arrives — an
Indian edition always has it printed on the back.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

from .pricing import money

BookCondition = Literal["like_new", "good", "fair"]

# What the shop pays, as a share of the printed price. Deliberately 20–30%: the
# copy still has to be received, checked, stored and sold, and the resale price has
# to undercut a new one by enough to be the obvious choice.
BUYBACK_RATES: dict[str, Decimal] = {
    "like_new": Decimal("0.30"),
    "good": Decimal("0.25"),
    "fair": Decimal("0.20"),
}

# What the used copy is listed at: 60–70% of the printed price, so a buyer still
# saves 30–40% against new while the shop keeps between 2.3x and 3x what it paid.
#
# Note the narrow spread. Fair sits only ten points below Like new, so most buyers
# will pay the small extra for the better copy and Fair stock will move slowest —
# widening the gap is the lever if those start sitting on the shelf.
RESALE_RATES: dict[str, Decimal] = {
    "like_new": Decimal("0.70"),
    "good": Decimal("0.65"),
    "fair": Decimal("0.60"),
}

CONDITIONS: tuple[str, ...] = ("like_new", "good", "fair")

CONDITION_LABELS: dict[str, str] = {
    "like_new": "Like new",
    "good": "Good",
    "fair": "Fair",
}

# What each grade means, shown to the seller so they grade honestly and to the
# buyer so they know what arrives. Vague grades are what generate disputes.
CONDITION_DESCRIPTIONS: dict[str, str] = {
    "like_new": "Barely used. No marks, no writing, spine intact, cover clean.",
    "good": "Read a few times. Light shelf wear, maybe a name on the first page. "
            "No missing or torn pages.",
    "fair": "Well used. Highlighting or notes, creased cover or loose spine — "
            "complete and readable, but it looks its age.",
}

# Below this the paperwork costs more than the book is worth, and a ₹4 offer reads
# as an insult rather than an offer.
MIN_BUYBACK_AMOUNT = Decimal("20.00")

# A guard against a typo'd MRP turning into a large payout: nobody is selling the
# shop a book printed at ₹90,000.
MAX_LISTED_PRICE = Decimal("20000.00")


class BuybackError(Exception):
    """The request cannot be priced. The message is safe to show the customer."""


def assert_valid_condition(condition: str) -> None:
    if condition not in BUYBACK_RATES:
        raise BuybackError(
            "Choose a condition: " + ", ".join(CONDITION_LABELS[c] for c in CONDITIONS)
        )


def assert_valid_listed_price(listed_price) -> None:
    price = money(listed_price)
    if price <= 0:
        raise BuybackError("Enter the price printed on the book.")
    if price > MAX_LISTED_PRICE:
        raise BuybackError(
            f"That printed price looks wrong. The most we can accept is {MAX_LISTED_PRICE}."
        )


def quote_per_copy(listed_price, condition: str) -> Decimal:
    """What the shop pays for one copy in `condition`.

    Returns 0 when the result would be under `MIN_BUYBACK_AMOUNT` — a real answer,
    not an error: the caller shows "we cannot buy this one" rather than an offer
    nobody would take.
    """
    assert_valid_condition(condition)
    assert_valid_listed_price(listed_price)

    amount = money(money(listed_price) * BUYBACK_RATES[condition])
    return amount if amount >= MIN_BUYBACK_AMOUNT else Decimal("0.00")


def quote(listed_price, condition: str, quantity: int = 1) -> Decimal:
    """Total offer for `quantity` copies."""
    if quantity < 1:
        raise BuybackError("Quantity must be at least 1.")
    if quantity > 20:
        raise BuybackError("For more than 20 copies, please contact us directly.")

    per_copy = quote_per_copy(listed_price, condition)
    return money(per_copy * quantity)


def resale_price(listed_price, condition: str) -> Decimal:
    """What a used copy in `condition` is put on the shelf at."""
    assert_valid_condition(condition)
    assert_valid_listed_price(listed_price)
    return money(money(listed_price) * RESALE_RATES[condition])


def quote_breakdown(listed_price, quantity: int = 1) -> list[dict]:
    """Every condition priced at once, for the "what would I get" screen.

    Showing all three up front is what makes a seller grade honestly: they can see
    that admitting to highlighting costs them a known amount rather than risking the
    whole offer.
    """
    rows = []
    for condition in CONDITIONS:
        try:
            offer = quote(listed_price, condition, quantity)
        except BuybackError:
            offer = Decimal("0.00")
        rows.append({
            "condition": condition,
            "label": CONDITION_LABELS[condition],
            "description": CONDITION_DESCRIPTIONS[condition],
            "offer": offer,
            "resale_price": resale_price(listed_price, condition),
        })
    return rows
