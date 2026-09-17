"""Schemas for addresses, coupons, reviews, payments and password resets."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.payment import PaymentMethod


# ----- addresses -----

class AddressBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=6, max_length=32)
    line1: str = Field(..., min_length=3, max_length=255)
    line2: Optional[str] = Field(default=None, max_length=255)
    city: str = Field(..., min_length=1, max_length=120)
    state: str = Field(..., min_length=1, max_length=120)
    postal_code: str = Field(..., min_length=3, max_length=20)
    # ISO 3166-1 alpha-2.
    country: str = Field(default="IN", min_length=2, max_length=2)


class AddressCreate(AddressBase):
    is_default: bool = False


class AddressRead(AddressBase):
    id: UUID
    is_default: bool

    model_config = ConfigDict(from_attributes=True)


# ----- coupons -----

class CouponPreviewRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)


class CouponPreview(BaseModel):
    code: str
    description: Optional[str] = None
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal


class CartTotals(BaseModel):
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    tax: Decimal
    total: Decimal
    coupon_code: Optional[str] = None
    # Why an applied code did not price anything, when a cart was asked for with
    # one. The cart itself still answers: a code that expired between being
    # applied and the next request must not be able to fail the whole page, so
    # this reports it instead of the request raising.
    coupon_error: Optional[str] = None
    # Whether cash on delivery may be chosen for *this* total. Sent with the
    # totals rather than fetched separately because it depends on them: the
    # ceiling is a rule about the amount, so it can change as the cart does.
    # The server re-checks at checkout regardless — this only decides whether the
    # option is worth showing.
    cod_available: bool = False
    cod_unavailable_reason: Optional[str] = None


class AdminCouponCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=32)
    description: Optional[str] = Field(default=None, max_length=255)
    discount_type: Literal["percent", "fixed"]
    value: Decimal = Field(..., gt=0)
    min_subtotal: Decimal = Field(default=Decimal("0"), ge=0)
    max_discount: Optional[Decimal] = Field(default=None, gt=0)
    is_active: bool = True
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    max_redemptions: Optional[int] = Field(default=None, ge=1)
    max_redemptions_per_user: Optional[int] = Field(default=1, ge=1)


class AdminCouponRead(BaseModel):
    id: UUID
    code: str
    description: Optional[str]
    discount_type: str
    value: Decimal
    min_subtotal: Decimal
    max_discount: Optional[Decimal]
    is_active: bool
    starts_at: Optional[datetime]
    expires_at: Optional[datetime]
    max_redemptions: Optional[int]
    max_redemptions_per_user: Optional[int]
    times_redeemed: int

    # What the code actually did. `times_redeemed` alone says a code was popular,
    # which is not the question — a code that was used forty times and gave away
    # more than it brought in is a loss the counter reports as a success.
    #
    # Both are computed from `coupon_redemptions`, joined to the orders that were
    # actually paid for. An unpaid checkout that quoted a discount is not money
    # given away.
    discount_given: Decimal = Decimal("0")
    #: Revenue on the paid orders this code was used on. Deliberately the order
    #: total, not the margin: the shop knows its own margin and this endpoint
    #: does not.
    revenue: Decimal = Decimal("0")

    model_config = ConfigDict(from_attributes=True)


# ----- checkout -----

class CheckoutRequest(BaseModel):
    """Either reference a saved address or supply one inline."""

    address_id: Optional[UUID] = None
    address: Optional[AddressCreate] = None
    coupon_code: Optional[str] = Field(default=None, max_length=32)
    save_address: bool = False
    # Store credit to put towards this order. Capped server-side against the
    # balance and the per-order limit — the browser proposes, it does not decide.
    wallet_credit: Optional[Decimal] = Field(default=None, ge=0)
    # "online" or "cod". Defaults to online, which is what every client sent
    # before cash on delivery existed. Eligibility is re-checked server-side:
    # the ceiling is a money rule, so the browser must not be the one enforcing it.
    payment_method: PaymentMethod = "online"


# ----- reviews -----

class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(default=None, max_length=120)
    body: Optional[str] = Field(default=None, max_length=4000)


class ReviewRead(BaseModel):
    id: UUID
    rating: int
    title: Optional[str]
    body: Optional[str]
    author_name: str
    is_mine: bool = False
    #: True when this reviewer has a delivered order containing this book.
    #:
    #: A label, not a gate. Blocking unverified reviews loses the genuine ones
    #: from people who bought the book elsewhere and still have something worth
    #: saying; labelling them lets a reader weigh the difference themselves.
    verified_purchase: bool = False
    created_at: datetime


class ReviewSummary(BaseModel):
    average: float
    count: int
    # Rating value (as a string key) -> number of reviews.
    breakdown: dict[str, int]
    items: List[ReviewRead]
    my_review: Optional[ReviewRead] = None


# ----- payments -----

class PaymentIntentRead(BaseModel):
    enabled: bool
    provider: Optional[str] = None
    key_id: Optional[str] = None
    currency: Optional[str] = None
    amount: Optional[int] = None
    payment_order_id: Optional[str] = None
    order_id: UUID


class PaymentConfirmRequest(BaseModel):
    razorpay_order_id: str = Field(..., min_length=1, max_length=128)
    razorpay_payment_id: str = Field(..., min_length=1, max_length=128)
    razorpay_signature: str = Field(..., min_length=1, max_length=256)


# ----- password reset -----

class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(..., min_length=10, max_length=128)
    password: str = Field(..., min_length=8, max_length=128)
