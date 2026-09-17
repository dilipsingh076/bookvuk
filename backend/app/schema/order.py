from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.core import shipping


class OrderItemRead(BaseModel):
    id: UUID
    book_id: UUID
    title_snapshot: str
    unit_price_snapshot: Decimal
    quantity: int = Field(..., ge=1)

    model_config = ConfigDict(from_attributes=True)


class OrderShippingAddress(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class OrderRead(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    #: "online" or "cod" — how the customer chose to pay, fixed at checkout.
    payment_method: str = "online"
    #: "test" / "live" when a gateway took the money, null otherwise. Lets a
    #: single database tell a rehearsal apart from a real sale.
    payment_mode: Optional[str] = None
    subtotal: Decimal
    shipping: Decimal
    tax: Decimal
    discount: Decimal = Decimal("0")
    total: Decimal
    coupon_code: Optional[str] = None
    # What store credit covered, and what actually needs paying after it.
    wallet_credit_used: Decimal = Decimal("0")
    payment_status: str = "pending"
    payment_provider: Optional[str] = None
    paid_at: Optional[datetime] = None
    # Present once a cancelled paid order has been refunded, so the customer can
    # see the money is on its way back rather than having to ask.
    refunded_at: Optional[datetime] = None
    refund_amount: Optional[Decimal] = None
    created_at: datetime
    # When each stage was reached; drives the customer's status timeline, which
    # previously read fields that did not exist and so never advanced.
    packed_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    # Which parcel it went in. "Shipped" on its own is the least useful thing the
    # timeline can say — it tells the customer something left and gives them
    # nothing to do with that. `tracking_url` is derived below, never stored.
    tracking_carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    items: List[OrderItemRead] = []

    # Flattened from the ship_* columns so clients get one address object rather
    # than eight loose fields.
    shipping_address: Optional[OrderShippingAddress] = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def order_number(self) -> str:
        """A short reference a customer can read out.

        The clients displayed an `order_number` that nothing ever sent, so every
        order card showed an empty label. Deriving it from the id keeps it stable
        and unique without a column or a sequence to keep in step; the full id is
        still there for anyone who needs to look the order up exactly.
        """
        return "#" + str(self.id).replace("-", "")[:8].upper()

    @computed_field
    @property
    def tracking_carrier_label(self) -> Optional[str]:
        """The courier's name, from its slug."""
        return shipping.label_for(self.tracking_carrier)

    @computed_field
    @property
    def tracking_url(self) -> Optional[str]:
        """A link to the courier's own tracking page, when it has one.

        Derived rather than stored so that a courier changing its tracking path
        is one edit in `core/shipping.py`, not a dead link on every order it ever
        carried. None — not a broken URL — when the courier has no public
        per-consignment page; the number alone is still worth showing.
        """
        return shipping.tracking_url(self.tracking_carrier, self.tracking_number)

    @model_validator(mode="before")
    @classmethod
    def _collect_shipping_address(cls, value):
        """Assemble `shipping_address` from the order's ship_* columns.

        Done here rather than in each route so every endpoint returning an Order
        exposes the address without changes at the call sites.

        Fields are taken from `model_fields` rather than a hand-written list: the
        list version silently dropped any field added to this model afterwards,
        which is exactly what happened to the refund columns.
        """
        if isinstance(value, dict) or not hasattr(value, "ship_line1"):
            return value
        if not value.ship_line1:
            return value

        return {
            **{
                name: getattr(value, name)
                for name in cls.model_fields
                if name != "shipping_address" and hasattr(value, name)
            },
            "shipping_address": {
                "full_name": value.ship_full_name,
                "phone": value.ship_phone,
                "line1": value.ship_line1,
                "line2": value.ship_line2,
                "city": value.ship_city,
                "state": value.ship_state,
                "postal_code": value.ship_postal_code,
                "country": value.ship_country,
            },
        }
