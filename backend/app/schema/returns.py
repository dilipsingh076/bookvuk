"""Asking for a book to be taken back, and the shop's answer."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReturnPhotoRead(BaseModel):
    id: UUID
    url: str
    position: int

    model_config = ConfigDict(from_attributes=True)


class ReturnCreate(BaseModel):
    """What the customer is claiming, against one line of one order."""

    order_item_id: UUID
    reason: Literal["damaged", "not_as_described", "wrong_item", "missing_pages", "other"]
    detail: Optional[str] = Field(default=None, max_length=2000)
    quantity: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def _other_needs_words(self) -> "ReturnCreate":
        """"Other" with no explanation is a request nobody can act on.

        Every other reason says what happened on its own; this one says only that
        none of them fit, which leaves the shop with a claim and no claim.
        """
        if self.reason == "other" and not (self.detail and self.detail.strip()):
            raise ValueError("Tell us what went wrong.")
        return self


class ReturnRead(BaseModel):
    id: UUID
    order_id: UUID
    order_item_id: UUID
    reason: str
    detail: Optional[str] = None
    quantity: int
    status: str
    resolution: Optional[str] = None
    refund_amount: Optional[Decimal] = None
    rejection_reason: Optional[str] = None
    photos: List[ReturnPhotoRead] = []
    created_at: datetime
    decided_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    # What was returned, carried on the row so the customer's list reads as books
    # rather than as identifiers.
    book_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AdminReturnDecision(BaseModel):
    """Accept or refuse a claim. Money does not move here."""

    approve: bool
    admin_note: Optional[str] = Field(default=None, max_length=2000)
    #: Shown to the customer, so a refusal has to come with a reason.
    rejection_reason: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _reason_required_to_reject(self) -> "AdminReturnDecision":
        if not self.approve and not (self.rejection_reason and self.rejection_reason.strip()):
            raise ValueError("Give the customer a reason.")
        return self


class AdminReturnResolve(BaseModel):
    """What was actually done about an approved claim.

    Separate from the decision because they are separate events: a claim can be
    accepted in the morning and paid in the afternoon, and collapsing them would
    make "approved but not yet refunded" unrepresentable — which is precisely the
    state somebody chases.
    """

    resolution: Literal["wallet", "source", "replacement", "none"]
    #: Defaults to what that line was charged. Set it to refund part of a line,
    #: or to add goodwill.
    amount: Optional[Decimal] = Field(default=None, ge=0)
    admin_note: Optional[str] = Field(default=None, max_length=2000)


class AdminReturnRead(ReturnRead):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    admin_note: Optional[str] = None
    #: What the line was charged, so the admin can see what a full refund means
    #: without opening the order.
    line_total: Optional[Decimal] = None
    #: Whether the order was ever paid for. An order can reach `delivered`
    #: unpaid — cash nobody collected, or a gateway that never confirmed — and
    #: refunding one sends out money that never came in. The screen showed
    #: nothing about this, so there was no way to catch it.
    order_payment_status: Optional[str] = None
    order_payment_method: Optional[str] = None
