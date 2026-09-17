from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator

from app.core.order_status import ORDER_STATUS_SHIPPED, OrderStatus
from app.core.shipping import CARRIER_SLUGS, normalise_number
from app.schema.pagination import PageMeta


class AdminDashboardOverviewCard(BaseModel):
    title: str
    value: str
    sub: str


class AdminAuthorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    bio: str = ""
    status: str = Field("active", max_length=32)  # active | draft


class AdminAuthorCreate(AdminAuthorBase):
    pass


class AdminAuthorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    bio: Optional[str] = None
    status: Optional[str] = Field(None, max_length=32)


class AdminAuthorRead(AdminAuthorBase):
    id: UUID
    created_at: datetime
    book_count: int = Field(0, alias="bookCount")

    model_config = ConfigDict(from_attributes=True)


class AdminInventoryRestockRequest(BaseModel):
    add_stock: int = Field(..., ge=0, alias="addStock")

    model_config = ConfigDict(populate_by_name=True)


class AdminOrderItemRead(BaseModel):
    id: UUID
    book_id: UUID = Field(..., alias="bookId")
    title_snapshot: str = Field(..., alias="title")
    unit_price_snapshot: Decimal = Field(..., alias="price")
    quantity: int = Field(..., ge=1, alias="qty")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AdminOrderRead(BaseModel):
    id: UUID
    created_at: datetime = Field(..., alias="createdAt")
    status: str
    user_id: UUID = Field(..., alias="userId")
    customer_name: str = Field(..., alias="customerName")
    customer_email: str = Field(..., alias="customerEmail")
    subtotal: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal
    discount: Decimal = Decimal("0")
    coupon_code: Optional[str] = Field(default=None, alias="couponCode")
    wallet_credit_used: Decimal = Field(default=Decimal("0"), alias="walletCreditUsed")

    # Whether the money arrived, and how. None of this used to reach the admin
    # screen, which meant a paid order and an unpaid one looked identical there —
    # and a cash-on-delivery order could not be told apart from a card one, so
    # there was no way to know which ones still needed collecting.
    payment_status: str = Field(default="pending", alias="paymentStatus")
    payment_method: str = Field(default="online", alias="paymentMethod")
    #: "test" / "live" when a gateway took it. One database serves both, so an
    #: order from a rehearsal has to be visibly a rehearsal.
    payment_mode: Optional[str] = Field(default=None, alias="paymentMode")
    paid_at: Optional[datetime] = Field(default=None, alias="paidAt")

    # Where it goes. Without this the admin screen could not fulfil an order at
    # all — the address existed only on the customer's own order page.
    ship_full_name: Optional[str] = Field(default=None, alias="shipFullName")
    ship_phone: Optional[str] = Field(default=None, alias="shipPhone")
    ship_line1: Optional[str] = Field(default=None, alias="shipLine1")
    ship_line2: Optional[str] = Field(default=None, alias="shipLine2")
    ship_city: Optional[str] = Field(default=None, alias="shipCity")
    ship_state: Optional[str] = Field(default=None, alias="shipState")
    ship_postal_code: Optional[str] = Field(default=None, alias="shipPostalCode")
    ship_country: Optional[str] = Field(default=None, alias="shipCountry")

    # Which parcel it went in. `shipped` used to be the entire shipping record,
    # so the admin could not answer "which courier" without asking whoever
    # packed it. `trackingUrl` is derived from the other two, never stored.
    tracking_carrier: Optional[str] = Field(default=None, alias="trackingCarrier")
    tracking_carrier_label: Optional[str] = Field(default=None, alias="trackingCarrierLabel")
    tracking_number: Optional[str] = Field(default=None, alias="trackingNumber")
    tracking_url: Optional[str] = Field(default=None, alias="trackingUrl")

    # When each stage was reached, so the admin sees the same timeline the
    # customer does rather than a single current status.
    packed_at: Optional[datetime] = Field(default=None, alias="packedAt")
    shipped_at: Optional[datetime] = Field(default=None, alias="shippedAt")
    delivered_at: Optional[datetime] = Field(default=None, alias="deliveredAt")
    cancelled_at: Optional[datetime] = Field(default=None, alias="cancelledAt")

    items: List[AdminOrderItemRead]

    model_config = ConfigDict(populate_by_name=True)


class AdminOrderPage(BaseModel):
    """A page of orders, with the tab counts for the whole set.

    The counts do not describe `items`. The screen's tabs answer "how much work
    is outstanding", which a single page cannot know — and computing them from
    the page is exactly the bug that paginating would otherwise introduce, in a
    form that looks right until the shop has more orders than fit on one page.
    """

    items: List[AdminOrderRead]
    meta: PageMeta
    #: lens name -> how many orders match it, across everything the current
    #: search and date range select.
    counts: dict


class _TrackingFields(BaseModel):
    """The shipment, validated the same way wherever it is set."""

    tracking_carrier: Optional[str] = Field(default=None, alias="trackingCarrier")
    tracking_number: Optional[str] = Field(default=None, max_length=64, alias="trackingNumber")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    @field_validator("tracking_carrier")
    @classmethod
    def _known_carrier(cls, value: Optional[str]) -> Optional[str]:
        """A slug from the registry, not free text.

        The tracking URL is derived from this, so an unrecognised value is not a
        harmless label — it is a courier the customer can never be given a link
        for. `other` is the escape hatch for anyone not on the list.
        """
        if value is None:
            return None
        slug = value.strip().lower()
        if slug not in CARRIER_SLUGS:
            raise ValueError(f"Unknown courier '{value}'")
        return slug

    @field_validator("tracking_number")
    @classmethod
    def _tidy_number(cls, value: Optional[str]) -> Optional[str]:
        return normalise_number(value)

    @model_validator(mode="after")
    def _both_or_neither(self) -> "_TrackingFields":
        """A shipment is a courier *and* a number, or it is nothing.

        Half of one is unusable in both directions: a number with no courier
        cannot be turned into a tracking link, and a courier with no number
        identifies no parcel. Refused here rather than stored, so nothing
        downstream — the e-mail, the customer's timeline, the order search — has
        to carry a branch for a state that should not exist.
        """
        if bool(self.tracking_carrier) != bool(self.tracking_number):
            raise ValueError("Give both the courier and the consignment number, or neither")
        return self


class AdminOrderStatusUpdate(_TrackingFields):
    # Constrained to the known lifecycle so an unknown value is a 422 instead of
    # silently landing in the database and breaking the frontend's status UI.
    status: OrderStatus

    @model_validator(mode="after")
    def _tracking_only_when_shipping(self) -> "AdminOrderStatusUpdate":
        """Tracking rides along with the move to `shipped`, and only that one.

        One request, one transaction: an order never exists in the state "marked
        shipped, consignment number lost because the second call failed". Sent
        with any other status it is a mistake worth refusing rather than storing
        — a consignment number attached to a `cancelled` order is noise nobody
        can interpret later.

        A model validator rather than a field one because this reads two fields,
        and a field validator would see whichever of them Pydantic happened to
        validate first: `status` is declared here but `tracking_number` is
        inherited, so `tracking_number` is validated *before* `status` exists in
        `info.data` and the check would pass unconditionally.
        """
        if (self.tracking_number or self.tracking_carrier) and self.status != ORDER_STATUS_SHIPPED:
            raise ValueError("Tracking can only be set when marking an order shipped")
        return self


class AdminOrderTrackingUpdate(_TrackingFields):
    """Correcting a shipment already recorded, without touching the status.

    Separate from the status update because the two are different events with
    different frequencies: shipping happens once, fixing a mistyped consignment
    number happens whenever somebody notices. Folding the correction into the
    status endpoint would mean re-sending `shipped` to an order that is already
    shipped just to fix a digit.

    Both fields null clears the shipment — the parcel was never actually sent.
    """



class StoreSettingsRead(BaseModel):
    """What is in force, and which of it is an override.

    `effective` is what the shop actually charges. `overrides` is which of those
    the database sets — anything absent is coming from the environment, and the
    screen says so rather than presenting a deployment default as somebody's
    decision.
    """

    effective: dict
    overrides: dict
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class StoreSettingsUpdate(BaseModel):
    """Only the commerce rules. Secrets and infrastructure are not writable here.

    Every field is optional and `None` means **clear the override**, handing that
    setting back to the environment. A field simply absent from the request is
    left alone, so a screen can save one value without resending the rest.
    """

    shipping_flat_rate: Optional[Decimal] = Field(default=None, ge=0)
    free_shipping_threshold: Optional[Decimal] = Field(default=None, ge=0)
    #: A fraction, not a percentage: 0.05 is 5%.
    tax_rate: Optional[Decimal] = Field(default=None, ge=0, le=1)
    #: StrictBool, not bool. Pydantic otherwise coerces "yes" / "0" / 1 into a
    #: boolean, and a malformed request would then *silently pin* this setting —
    #: writing an override that stops following the environment, for a value
    #: nobody deliberately chose. Every other field here is already strict about
    #: its range; this one was strict about nothing.
    cod_enabled: Optional[StrictBool] = None
    cod_max_order_total: Optional[Decimal] = Field(default=None, ge=0)
    wallet_max_redemption_percent: Optional[int] = Field(default=None, ge=0, le=100)

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

class AdminCustomerRead(BaseModel):
    """One person, summarised by what the shop actually needs to know about them.

    The admin could search orders by e-mail but could not look at a *customer*:
    how many times they have ordered, what they have spent, whether they are
    holding store credit. Answering "this person says they ordered twice and only
    got one parcel" meant opening a database client.

    `total_spent` counts paid orders only. Counting placed orders would make an
    abandoned checkout look like revenue, which is the number most likely to be
    read out loud and the one worst to get wrong.
    """

    id: UUID
    name: str
    email: str
    username: str
    is_active: bool = Field(..., alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")

    orders_count: int = Field(0, alias="ordersCount")
    paid_orders_count: int = Field(0, alias="paidOrdersCount")
    total_spent: Decimal = Field(Decimal("0"), alias="totalSpent")
    last_order_at: Optional[datetime] = Field(default=None, alias="lastOrderAt")
    #: Store credit they are holding. The shop owes this; it belongs next to the
    #: person, not buried in a wallet screen nobody opens.
    wallet_balance: Decimal = Field(Decimal("0"), alias="walletBalance")

    model_config = ConfigDict(populate_by_name=True)


class AdminCustomerPage(BaseModel):
    items: List[AdminCustomerRead]
    meta: PageMeta


class AdminWalletEntryRead(BaseModel):
    id: UUID
    amount: Decimal
    kind: str
    note: Optional[str] = None
    created_at: datetime = Field(..., alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class AdminCustomerDetail(AdminCustomerRead):
    """Everything one support conversation needs, in one request.

    Assembled server-side rather than left to the screen to stitch from three
    endpoints: the whole point of this page is that somebody is on the phone.
    """

    orders: List[AdminOrderRead] = []
    wallet_entries: List[AdminWalletEntryRead] = Field(default_factory=list, alias="walletEntries")
    buyback_count: int = Field(0, alias="buybackCount")

    model_config = ConfigDict(populate_by_name=True)
