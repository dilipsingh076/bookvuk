from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.schema.book import BookResponse
from app.schema.commerce import CartTotals

class CartItemBase(BaseModel):
    book_id: UUID
    quantity: int = Field(..., ge=1)


class CartItemCreate(CartItemBase):
    pass


class CartMergeLine(BaseModel):
    book_id: UUID
    quantity: int = Field(..., ge=1, le=99)


class CartMergeRequest(BaseModel):
    """A guest cart being folded into the account cart at sign-in.

    Bounded so a tampered local cart cannot make the server do unbounded work.
    """

    items: List[CartMergeLine] = Field(default_factory=list, max_length=100)


class CartQuantityChange(BaseModel):
    """Relative change applied to a cart line's quantity.

    Bounded so a single request cannot push a line to an absurd quantity, and
    typed so a missing or non-integer field is a 422 rather than a 500.
    """

    quantity_change: int = Field(..., ge=-99, le=99)


class CartItemRead(CartItemBase):
    id: UUID
    cart_id: UUID
    unit_price_snapshot: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime

    # Embedded so a client can render the cart from this response alone. Without
    # it, showing a two-line cart meant downloading the entire catalogue to look
    # up titles and prices. Mirrors `WishlistBookItem` in app/schema/wishlist.py.
    book: Optional[BookResponse] = None

    model_config = ConfigDict(from_attributes=True)


class CartBase(BaseModel):
    user_id: UUID


class CartCreate(CartBase):
    pass


class CartRead(CartBase):
    # None until the user's first add-to-cart: `get_cart` synthesises an empty
    # cart rather than creating a row, so this must be optional or that response
    # fails validation and the endpoint 500s for every brand-new user.
    id: Optional[UUID] = None
    items: List[CartItemRead] = []
    # What the cart costs, priced from the same rows as `items`.
    #
    # Embedded rather than fetched, because the cart handler has already loaded
    # everything the pricing needs: asking separately repeated the identical
    # queries and doubled the wait before a total appeared. Optional so a client
    # written against the older shape still validates.
    #
    # A code applied to the cart arrives as `coupon_code` on the request, so the
    # discount is priced here too. A code that has since stopped working comes
    # back as `coupon_error` rather than failing the cart fetch: the shopper
    # would otherwise lose the whole page for the sake of a discount.
    totals: Optional[CartTotals] = None

    model_config = ConfigDict(from_attributes=True)