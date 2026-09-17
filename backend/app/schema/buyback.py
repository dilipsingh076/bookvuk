from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.schema.pagination import PageMeta
from app.core.shipping import CARRIER_SLUGS, label_for as carrier_label, normalise_number, tracking_url


class BuybackQuoteRequest(BaseModel):
    """What a seller needs priced, before committing to anything.

    Either a catalogue book (its printed price is known) or a hand-entered one,
    where the seller reads the MRP off the cover.
    """

    book_id: Optional[UUID] = None
    listed_price: Optional[Decimal] = Field(default=None, gt=0)
    quantity: int = Field(default=1, ge=1, le=20)

    @model_validator(mode="after")
    def _need_a_price_basis(self) -> "BuybackQuoteRequest":
        if self.book_id is None and self.listed_price is None:
            raise ValueError("Pick a book from the catalogue, or enter the price printed on it.")
        return self


class ConditionOffer(BaseModel):
    condition: str
    label: str
    description: str
    offer: Decimal
    resale_price: Decimal


class BuybackQuoteResponse(BaseModel):
    title: Optional[str] = None
    listed_price: Decimal
    quantity: int
    options: List[ConditionOffer]
    # False when even the best condition falls under the minimum worth handling.
    can_sell: bool
    message: Optional[str] = None


class BuybackSubmitRequest(BaseModel):
    book_id: Optional[UUID] = None
    # Required for a hand-entered book; ignored when `book_id` is given, because the
    # catalogue is the authority on its own titles.
    title: Optional[str] = Field(default=None, max_length=255)
    author: Optional[str] = Field(default=None, max_length=255)
    isbn: Optional[str] = Field(default=None, max_length=20)
    listed_price: Optional[Decimal] = Field(default=None, gt=0)

    condition: Literal["like_new", "good", "fair"]
    quantity: int = Field(default=1, ge=1, le=20)

    payout_method: Literal["wallet", "bank"]
    # Only for a bank payout. Not validated as a UPI id beyond length: a wrong one
    # fails visibly at transfer time, and rejecting a valid unusual handle here
    # would block a real seller.
    payout_upi: Optional[str] = Field(default=None, max_length=128)
    payout_account_name: Optional[str] = Field(default=None, max_length=128)

    seller_note: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _check_shape(self) -> "BuybackSubmitRequest":
        if self.book_id is None:
            if not (self.title and self.title.strip()):
                raise ValueError("Enter the book's title.")
            if self.listed_price is None:
                raise ValueError("Enter the price printed on the book.")
        if self.payout_method == "bank" and not (self.payout_upi and self.payout_upi.strip()):
            raise ValueError("Enter the UPI id to send the money to.")
        return self


class BuybackPhotoRead(BaseModel):
    id: UUID
    url: str
    #: cover | spine | damage | other — what it shows, so three photographs are
    #: readable at a glance instead of being three pictures of a book.
    kind: str
    position: int

    model_config = ConfigDict(from_attributes=True)


class BuybackDispatch(BaseModel):
    """The seller posting an approved book.

    Both fields or neither, and a courier the registry knows — the same rule
    outbound order tracking follows, for the same reason: half a shipment cannot
    be turned into a link, and an unknown courier is one nobody can follow.
    """

    carrier: Optional[str] = None
    tracking_number: Optional[str] = Field(default=None, max_length=64)

    @field_validator("carrier")
    @classmethod
    def _known_carrier(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        slug = value.strip().lower()
        if slug not in CARRIER_SLUGS:
            raise ValueError(f"Unknown courier '{value}'")
        return slug

    @field_validator("tracking_number")
    @classmethod
    def _tidy(cls, value: Optional[str]) -> Optional[str]:
        return normalise_number(value)

    @model_validator(mode="after")
    def _both_or_neither(self) -> "BuybackDispatch":
        if bool(self.carrier) != bool(self.tracking_number):
            raise ValueError("Give both the courier and the consignment number, or neither")
        return self


class BuybackRequestRead(BaseModel):
    id: UUID
    status: str
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    book_id: Optional[UUID] = None
    listed_price: Decimal
    condition: str
    quantity: int
    quoted_amount: Decimal
    final_amount: Optional[Decimal] = None
    received_condition: Optional[str] = None
    payout_method: Optional[str] = None
    payout_reference: Optional[str] = None
    rejection_reason: Optional[str] = None
    seller_note: Optional[str] = None
    # What the seller photographed. The reason an admin can grade a book they
    # have not yet held, and the reason the resale listing can show the actual
    # copy rather than the publisher's stock image.
    photos: List[BuybackPhotoRead] = []

    # How it was posted, once it was. Nothing sat between `approved_at` and
    # `received_at` before, so "awaiting arrival" could not tell "in transit"
    # from "never sent".
    seller_tracking_carrier: Optional[str] = None
    seller_tracking_number: Optional[str] = None
    dispatched_at: Optional[datetime] = None

    #: When this offer stops standing. NULL means it does not expire.
    quote_expires_at: Optional[datetime] = None

    created_at: datetime
    approved_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def seller_tracking_url(self) -> Optional[str]:
        """A link to the courier's page, when that courier has one.

        Derived rather than stored, so a courier changing its tracking path is
        one edit in `core/shipping.py` instead of a dead link on every historic
        request it carried.
        """
        return tracking_url(self.seller_tracking_carrier, self.seller_tracking_number)

    @computed_field
    @property
    def seller_tracking_carrier_label(self) -> Optional[str]:
        return carrier_label(self.seller_tracking_carrier)


class BuybackRequestPage(BaseModel):
    """A page of a seller's own requests.

    Nothing ever leaves that list — a cancelled or rejected request stays — so it
    grows without bound on an account that sells regularly.
    """

    items: List[BuybackRequestRead]
    meta: PageMeta
    #: How many are still with the shop, across the whole list. The sell form
    #: warns against the per-seller cap with this, and a page cannot count what
    #: it is a page of — deriving it from `items` would undercount the moment
    #: somebody has more requests than fit on one.
    open_count: int = 0


# ----- wallet -----

class WalletEntryRead(BaseModel):
    id: UUID
    amount: Decimal
    kind: str
    note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WalletRead(BaseModel):
    balance: Decimal
    # How much of *this* cart the credit may cover; 0 when there is no cart.
    max_redeemable_now: Decimal
    max_redemption_percent: int
    entries: List[WalletEntryRead] = []


# ----- admin -----

class AdminBuybackDecision(BaseModel):
    """Approve or reject a submitted request."""

    approve: bool
    admin_note: Optional[str] = Field(default=None, max_length=1000)
    # Shown to the seller, so a rejection has to come with a reason.
    rejection_reason: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _reason_required_to_reject(self) -> "AdminBuybackDecision":
        if not self.approve and not (self.rejection_reason and self.rejection_reason.strip()):
            raise ValueError("Give the seller a reason for the rejection.")
        return self


class AdminBuybackReceive(BaseModel):
    """The book arrived. Grade what actually turned up.

    `received_condition` may differ from what the seller claimed, which re-prices
    the payout — that is the whole point of a separate receiving step.
    """

    received_condition: Literal["like_new", "good", "fair"]
    # Set only to override the recomputed amount (a goodwill top-up, say).
    override_amount: Optional[Decimal] = Field(default=None, ge=0)
    admin_note: Optional[str] = Field(default=None, max_length=1000)


class AdminBuybackPayout(BaseModel):
    """Pay the seller and put the copy on the shelf."""

    # Required for a bank transfer: the UTR is the proof the money moved.
    payout_reference: Optional[str] = Field(default=None, max_length=128)
    # Which catalogue title the used copy belongs under. Required when the seller
    # entered the book by hand, since there is nothing to attach it to yet.
    parent_book_id: Optional[UUID] = None
    # Overrides the shelf price the condition would imply.
    resale_price: Optional[Decimal] = Field(default=None, gt=0)


class AdminBuybackRead(BuybackRequestRead):
    seller_email: Optional[str] = None
    seller_name: Optional[str] = None
    admin_note: Optional[str] = None
    payout_upi: Optional[str] = None
    payout_account_name: Optional[str] = None


class AdminBuybackPage(BaseModel):
    """A page of the queue, plus what each tab holds across the whole of it.

    The counts do not describe `items` — a page cannot know how much work is
    waiting behind it. Declared after `AdminBuybackRead` so the annotation is the
    class itself rather than a forward reference that has to resolve later.
    """

    items: List[AdminBuybackRead]
    meta: PageMeta
    counts: dict
