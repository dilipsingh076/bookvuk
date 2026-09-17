from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload
from app.database import models, db
from app.schema.wishlist import WishlistResponse, WishlistToggleRequest
from app.schema.cart import (
    CartItemCreate,
    CartMergeRequest,
    CartQuantityChange,
    CartRead,
)
from app.schema.order import OrderRead
from app.schema.notification import NotificationRead
from app.schema.commerce import (
    AddressCreate,
    AddressRead,
    CartTotals,
    CheckoutRequest,
    PaymentConfirmRequest,
    PaymentIntentRead,
)
from app.core import payments
from app.core.store_settings import current as _rules
from app.core.payment import (
    PAYMENT_METHOD_COD,
    PAYMENT_STATUS_PENDING,
    cod_available,
)
from app.core.jobs import enqueue
from app.core.config import settings
from app.core import wallet
from app.core.fulfilment import cancel_order_in_transaction, redemptions_for_user
from app.core.order_status import ORDER_STATUS_CANCELLED, ORDER_STATUS_PROCESSING
from app.core.pricing import (
    CouponError,
    assert_coupon_usable,
    compute_totals,
    discount_for,
    money,
)
from app.database.dep import require_role


def _amount_payable(order) -> "Decimal":
    """What the gateway should charge: the order total less any store credit.

    Charging `order.total` would take the money twice — once as credit, once on the
    card — for the same goods.
    """
    return max(money(0), money(order.total) - money(order.wallet_credit_used or 0))

router = APIRouter(
    prefix="/api/customer",
    tags=["Customer"]
)

ADDRESS_FIELDS = (
    "full_name", "phone", "line1", "line2", "city", "state", "postal_code", "country",
)


def _load_coupon_for_update(db_session: Session, code: str) -> models.Coupon:
    """Fetch a coupon by code with its row locked.

    Locking matters for limited codes: without it two concurrent checkouts both
    read the same `times_redeemed` and both increment it to the same value, so a
    100-use code can be redeemed more than 100 times.
    """
    coupon = (
        db_session.query(models.Coupon)
        .filter(models.Coupon.code == code.strip().upper())
        .with_for_update()
        .first()
    )
    if coupon is None:
        raise HTTPException(status_code=400, detail="This code is not valid.")
    return coupon


def _split_by_availability(items, books_by_id):
    """Split cart lines into what can be ordered now and what cannot.

    A cart may legitimately hold an out-of-stock book: "notify me" puts it there so
    it is waiting when the restock lands. Checkout must therefore not treat one
    unavailable line as a reason to refuse the whole order — that would mean a
    single book somebody is waiting for blocks them buying anything else.

    A line needs its *full* quantity in stock to be ordered. Quietly reducing
    someone's quantity would change what they agreed to buy.
    """
    available, unavailable = [], []
    for it in items:
        book = books_by_id.get(it.book_id)
        if book is None:
            # The book was deleted out from under the cart; nothing to order.
            unavailable.append(it)
        elif int(book.stock or 0) >= int(it.quantity):
            available.append(it)
        else:
            unavailable.append(it)
    return available, unavailable


def _subtotal_of(rows) -> Decimal:
    """Price cart lines whose books are already loaded — what `get_cart` holds.

    The one place the cart's arithmetic lives, so the figure `/cart` embeds and
    the one checkout charges cannot drift apart.

    Unavailable lines are excluded: the customer is not being charged for a book
    the order will not contain, and the total shown has to be the total charged.
    """
    return money(
        sum(
            (
                Decimal(str(r.unit_price_snapshot)) * int(r.quantity)
                for r in rows
                if r.book is not None and int(r.book.stock or 0) >= int(r.quantity)
            ),
            Decimal("0.00"),
        )
    )


def _resolve_coupon(db_session: Session, code, subtotal: Decimal, user_id):
    """Price a code against this customer, and say why if it will not apply.

    Returns `(discount, applied_code, error)` and never raises. That is the
    point: this runs on every cart read and write once a code is applied, and a
    code that has since expired must not be able to fail the cart itself — the
    shopper would lose the whole page over a discount.

    """
    if not code:
        return Decimal("0.00"), None, None

    coupon = (
        db_session.query(models.Coupon)
        .filter(models.Coupon.code == str(code).strip().upper())
        .first()
    )
    # Cancelled orders do not count towards the per-customer cap — see
    # `core/fulfilment.redemptions_for_user`.
    redemptions = redemptions_for_user(db_session, coupon.id, user_id) if coupon else 0
    try:
        assert_coupon_usable(coupon, subtotal=subtotal, user_redemptions=redemptions)
    except CouponError as exc:
        return Decimal("0.00"), None, str(exc)
    return discount_for(coupon, subtotal), coupon.code, None


def _cart_response(db_session: Session, cart_id, user_id, coupon_code=None) -> CartRead:
    """The cart as the client should now see it, priced.

    Returned by every write as well as by the read, so a change costs one
    request instead of two. A quantity press used to be a PATCH answering with
    the single line it touched, followed by a GET for everything else — two
    sequential round trips, measured at 2.6s + 1.2s against the Tokyo database
    for one tap of `+`.

    Takes plain ids, not the ORM rows, and the write paths read them out *before*
    they commit. `commit()` expires every object in the session, so touching
    `cart.id` afterwards silently re-SELECTs the cart — and `current_user.id`
    re-SELECTs the user. Passing the rows in cost two extra round trips per
    write, measured, for two values already in hand.
    """
    if cart_id is None:
        return CartRead(
            id=None, user_id=user_id, items=[], totals=_cart_totals_for(Decimal("0.00"))
        )
    items = (
        db_session.query(models.CartItem)
        # The category is joined rather than left to `Book.category_ref`'s
        # `selectin`, which would fetch it in a second statement — a whole round
        # trip for one string per book. `selectin` is the right default on the
        # model because a joined load cannot be combined with the `FOR UPDATE`
        # that checkout and cancellation use; this read takes no lock, so it can
        # ask for the cheaper shape.
        .options(joinedload(models.CartItem.book).joinedload(models.Book.category_ref))
        .filter(models.CartItem.cart_id == cart_id)
        .order_by(models.CartItem.created_at.asc())
        .all()
    )
    subtotal = _subtotal_of(items)
    discount, applied, coupon_error = _resolve_coupon(db_session, coupon_code, subtotal, user_id)
    return CartRead(
        id=cart_id,
        user_id=user_id,
        items=items,
        totals=_cart_totals_for(
            subtotal, discount=discount, coupon_code=applied, coupon_error=coupon_error
        ),
    )


def _cart_totals_for(
    subtotal: Decimal, *, discount=Decimal("0.00"), coupon_code=None, coupon_error=None
) -> CartTotals:
    """Turn a subtotal into the figures the cart and checkout both show.

    One function, so an embedded total and a fetched one are the same number by
    construction rather than by review.
    """
    totals = compute_totals(subtotal, discount=discount)
    cod_ok, cod_reason = cod_available(
        totals.total, enabled=_rules().cod_enabled, max_total=_rules().cod_max_order_total
    )
    return CartTotals(
        subtotal=totals.subtotal,
        discount=totals.discount,
        shipping=totals.shipping,
        tax=totals.tax,
        total=totals.total,
        coupon_code=coupon_code,
        coupon_error=coupon_error,
        cod_available=cod_ok,
        cod_unavailable_reason=cod_reason,
    )


def _resolve_checkout_address(db_session: Session, user, payload: "CheckoutRequest") -> dict:
    """Work out where this order ships to.

    Order of preference: an explicitly chosen saved address, then one supplied
    inline, then the customer's default. An order with nowhere to go is rejected
    rather than accepted and left unshippable.
    """
    if payload.address_id is not None:
        saved = (
            db_session.query(models.Address)
            .filter(models.Address.id == payload.address_id, models.Address.user_id == user.id)
            .first()
        )
        if saved is None:
            raise HTTPException(status_code=404, detail="Address not found")
        return {field: getattr(saved, field) for field in ADDRESS_FIELDS}

    if payload.address is not None:
        supplied = payload.address.model_dump()
        if payload.save_address:
            _store_address(db_session, user, payload.address)
        return {field: supplied.get(field) for field in ADDRESS_FIELDS}

    default = (
        db_session.query(models.Address)
        .filter(models.Address.user_id == user.id)
        .order_by(models.Address.is_default.desc(), models.Address.created_at.asc())
        .first()
    )
    if default is None:
        raise HTTPException(
            status_code=400,
            detail="A delivery address is required to place an order.",
        )
    return {field: getattr(default, field) for field in ADDRESS_FIELDS}


def _store_address(db_session: Session, user, data: AddressCreate) -> models.Address:
    address = models.Address(user_id=user.id, **data.model_dump(exclude={"is_default"}))
    address.is_default = data.is_default

    if data.is_default:
        db_session.query(models.Address).filter(
            models.Address.user_id == user.id
        ).update({"is_default": False})

    db_session.add(address)
    db_session.flush()
    return address


# ----- addresses -----

@router.get("/addresses", response_model=List[AddressRead])
def list_addresses(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    return (
        db.query(models.Address)
        .filter(models.Address.user_id == current_user.id)
        .order_by(models.Address.is_default.desc(), models.Address.created_at.asc())
        .all()
    )


@router.post("/addresses", response_model=AddressRead, status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    existing = (
        db.query(models.Address).filter(models.Address.user_id == current_user.id).count()
    )
    # The first address saved is the default, otherwise nothing ever is.
    if existing == 0:
        payload = payload.model_copy(update={"is_default": True})

    address = _store_address(db, current_user, payload)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    address = (
        db.query(models.Address)
        .filter(models.Address.id == address_id, models.Address.user_id == current_user.id)
        .first()
    )
    if address is None:
        raise HTTPException(status_code=404, detail="Address not found")

    db.delete(address)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/wishlist/wishlistToggle")
def toggle_wishlist_book(
    request: WishlistToggleRequest,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    existing = db.query(models.Wishlist).filter_by(user_id=current_user.id, book_id=request.book_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"in_wishlist": False}

    wishlist_item = models.Wishlist(user_id=current_user.id, book_id=request.book_id)
    db.add(wishlist_item)
    db.commit()
    return {"in_wishlist": True}

@router.get("/wishlist", response_model=WishlistResponse)
def get_wishlist_books(db: Session = Depends(db.get_db), current_user = Depends(require_role("customer"))):
    items = (
        db.query(models.Wishlist)
        .options(joinedload(models.Wishlist.book))  # eager load books
        .filter_by(user_id=current_user.id)
        .all()
    )
    return WishlistResponse(items=items)

@router.delete("/wishlist/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wishlist_book(
    book_id: UUID,
    db: Session = Depends(db.get_db),
    current_user = Depends(require_role("customer")),
):
    wishlist_item = db.query(models.Wishlist).filter_by(user_id=current_user.id, book_id=book_id).first()
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Book not found in wishlist")

    db.delete(wishlist_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/cart/merge", response_model=CartRead)
def merge_cart(
    payload: CartMergeRequest,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Fold a guest's cart into the signed-in customer's cart.

    A visitor builds a cart before signing in (kept in their browser); this is
    what stops that cart being thrown away at login. One request and one
    transaction rather than one POST per line, so a half-merged cart is not a
    possible outcome.

    Quantities are summed with any existing line and capped at available stock.
    Unknown or out-of-stock books are skipped rather than failing the whole
    merge — losing one unavailable title must not lose the rest of the cart.
    """
    if not payload.items:
        return get_cart(db=db, current_user=current_user)

    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        cart = models.Cart(user_id=current_user.id)
        db.add(cart)
        db.flush()

    # Collapse duplicate lines in the incoming payload first.
    wanted: dict = {}
    for line in payload.items:
        wanted[line.book_id] = wanted.get(line.book_id, 0) + int(line.quantity)

    books = {
        b.id: b
        for b in db.query(models.Book).filter(models.Book.id.in_(wanted.keys())).all()
    }
    existing = {
        row.book_id: row
        for row in db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).all()
    }

    for book_id, quantity in wanted.items():
        book = books.get(book_id)
        if book is None or int(book.stock or 0) <= 0:
            continue

        row = existing.get(book_id)
        combined = int(row.quantity if row else 0) + quantity
        combined = min(combined, int(book.stock))

        if row is None:
            db.add(
                models.CartItem(
                    cart_id=cart.id,
                    book_id=book_id,
                    quantity=combined,
                    unit_price_snapshot=book.price,
                )
            )
        else:
            row.quantity = combined

    db.commit()
    return get_cart(db=db, current_user=current_user)


@router.post("/cart/items", response_model=CartRead)
def add_to_cart(
    request: CartItemCreate,
    coupon_code: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user = Depends(require_role("customer"))
):

    book = db.query(models.Book).filter(models.Book.id == request.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        cart = models.Cart(user_id=current_user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)

    cart_item = (
        db.query(models.CartItem)
        .filter(models.CartItem.cart_id == cart.id, models.CartItem.book_id == request.book_id)
        .first()
    )

    if cart_item:
        cart_item.quantity += request.quantity
    else:
        cart_item = models.CartItem(
            cart_id=cart.id,
            book_id=request.book_id,
            quantity=request.quantity,
            unit_price_snapshot=book.price  
        )
        db.add(cart_item)

    # Read out before the commit: `commit()` expires every object in the
    # session, so reaching for `cart.id` or `current_user.id` afterwards costs a
    # re-SELECT of each — two round trips for values already in hand.
    cart_id, user_id = cart.id, current_user.id
    db.commit()
    # The whole cart, so an add costs one request. The client used to follow this
    # with a GET to pick up the server's own quantity merging and stock caps —
    # both of which are in here.
    return _cart_response(db, cart_id, user_id, coupon_code)


@router.get("/cart", response_model=CartRead)
def get_cart(
    coupon_code: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """The cart, priced with `coupon_code` when one is applied.

    The code rides along rather than being asked for separately: with one
    applied, every quantity press used to cost a separate totals request before
    the write and another after it — three requests for one tap.
    """
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    # Priced from the rows it loads anyway, so the cart costs one round trip
    # instead of two. The page used to fetch the lines and then a separate
    # totals endpoint, which repeated the same three queries — ~1.2s each
    # against the Tokyo database. A code arrives as `coupon_code`; a rejected
    # one comes back as `totals.coupon_error` rather than failing the fetch.
    return _cart_response(db, cart.id if cart else None, current_user.id, coupon_code)


@router.patch("/cart/items/{book_id}", response_model=CartRead)
def change_cart_quantity(
    book_id: UUID,
    request: CartQuantityChange,
    coupon_code: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    # The line, its cart and the book's stock in one query.
    #
    # Three separate lookups before — cart, then item, then book — which is
    # three round trips, and at ~175 ms each that is most of what a `+` press
    # cost. They are all inner joins on keys that must exist, so one statement
    # answers all three questions.
    #
    # Locked, because this is a read-modify-write on a *relative* change.
    #
    # Without it, several presses of − arriving together all read the same
    # quantity, all compute the same new one, and all write it: five decrements
    # from 6 left the line at 5 instead of 1, with every request answering 200.
    # The customer sees a subtotal that counts their presses and a total that
    # counts the one the server kept.
    #
    # `of=CartItem` locks that row only: without it PostgreSQL would take a lock
    # on the joined `books` row too, so two people changing the quantity of the
    # same title would serialise on the book rather than on their own carts.
    row = (
        db.query(models.CartItem, models.Book.stock, models.Book.title, models.Cart.id)
        .join(models.Cart, models.Cart.id == models.CartItem.cart_id)
        .join(models.Book, models.Book.id == models.CartItem.book_id)
        .filter(models.Cart.user_id == current_user.id, models.CartItem.book_id == book_id)
        .with_for_update(of=models.CartItem)
        .first()
    )
    if not row:
        # The cart may not exist, or may not hold this book. The client treats
        # both the same way — re-read and carry on — so they answer the same.
        raise HTTPException(404, "Item not in cart")
    cart_item, stock, title, cart_id_ = row

    new_quantity = cart_item.quantity + request.quantity_change

    # Don't let the cart hold more than exists; checkout would only fail later.
    if new_quantity >= 1 and new_quantity > stock:
        raise HTTPException(
            status_code=409,
            detail=f"Only {stock} left in stock for {title}",
        )

    if new_quantity < 1:
        # Dropping to zero removes the line. It used to be reported by *raising*
        # a 204, which is a success dressed as an error and left the client to
        # special-case it; the cart below says the same thing plainly.
        db.delete(cart_item)
    else:
        cart_item.quantity = new_quantity

    # Read out before the commit: `commit()` expires every object in the
    # session, so reaching for `cart.id` or `current_user.id` afterwards costs a
    # re-SELECT of each — two round trips for values already in hand.
    cart_id, user_id = cart_id_, current_user.id
    db.commit()

    # The whole cart, so the caller needs no follow-up read. `db.refresh` used to
    # sit here instead: it re-SELECTed the row just written and, because the
    # refresh re-triggers the relationship loads, pulled the book and its
    # category again — three round trips for a quantity we already knew.
    return _cart_response(db, cart_id, user_id, coupon_code)


@router.delete("/cart/items/{book_id}", response_model=CartRead)
def delete_cart_item(
    book_id: UUID,
    coupon_code: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(404, "Cart not found")

    cart_item = db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id, models.CartItem.book_id == book_id).first()
    if not cart_item:
        raise HTTPException(404, "Item not in cart")

    db.delete(cart_item)
    # Read out before the commit: `commit()` expires every object in the
    # session, so reaching for `cart.id` or `current_user.id` afterwards costs a
    # re-SELECT of each — two round trips for values already in hand.
    cart_id, user_id = cart.id, current_user.id
    db.commit()
    # Removing a line changes the price, and the price comes back with the cart:
    # this answered 204 and the client then had to ask what the cart now was.
    return _cart_response(db, cart_id, user_id, coupon_code)


@router.delete("/cart/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove_cart_item(book_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):

    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(404, "Cart not found")
    
    cart_item = (db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id, models.CartItem.book_id == book_id).first())
    if not cart_item:
        raise HTTPException(404, "Item not in cart")
    
    db.delete(cart_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.delete("/cart/cartClear", response_model=CartRead)
def clear_cart(
    coupon_code: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(404, "Cart not found")

    db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).delete(synchronize_session=False)
    # Read out before the commit: `commit()` expires every object in the
    # session, so reaching for `cart.id` or `current_user.id` afterwards costs a
    # re-SELECT of each — two round trips for values already in hand.
    cart_id, user_id = cart.id, current_user.id
    db.commit()
    # An emptied cart still has to be priced — at zero, by the server rather than
    # by the client assuming it.
    return _cart_response(db, cart_id, user_id, coupon_code)

@router.get("/notifications", response_model=List[NotificationRead])
def list_notifications(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(notification_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    n = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == current_user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.post("/notifications/read-all")
def read_all_notifications(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    db.query(models.Notification).filter(models.Notification.user_id == current_user.id, models.Notification.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()
    return {"message": "ok"}


@router.post("/checkout", response_model=OrderRead)
def cart_checkout(
    payload: Optional[CheckoutRequest] = None,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    payload = payload or CheckoutRequest()

    # Checkout takes money and decrements stock, so a double submit must not
    # produce a second order. A client that sends the header gets its first order
    # back on a replay.
    if idempotency_key:
        seen = (
            db.query(models.IdempotencyKey)
            .filter(
                models.IdempotencyKey.user_id == current_user.id,
                models.IdempotencyKey.scope == "checkout",
                models.IdempotencyKey.key == idempotency_key,
            )
            .first()
        )
        if seen is not None and seen.order_id is not None:
            existing = (
                db.query(models.Order)
                .options(joinedload(models.Order.items))
                .filter(models.Order.id == seen.order_id)
                .first()
            )
            if existing is not None:
                return existing

    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=400, detail="Cart is empty")

    items = (
        db.query(models.CartItem)
        .filter(models.CartItem.cart_id == cart.id)
        .all()
    )
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    shipping_address = _resolve_checkout_address(db, current_user, payload)

    # Lock the book rows before checking stock. Without this, two concurrent
    # checkouts both read the old stock, both pass the check and both write
    # `stock - their_quantity`, so the shop oversells. Ordering by id gives every
    # transaction the same lock order, which avoids deadlocking against itself.
    book_ids = {it.book_id for it in items}
    locked_books = (
        db.query(models.Book)
        .filter(models.Book.id.in_(book_ids))
        .order_by(models.Book.id)
        .with_for_update()
        .all()
    )
    books_by_id = {b.id: b for b in locked_books}

    orderable, waiting = _split_by_availability(items, books_by_id)

    if not orderable:
        titles = ", ".join(
            books_by_id[it.book_id].title for it in waiting if it.book_id in books_by_id
        )
        raise HTTPException(
            status_code=409,
            detail=(
                f"Nothing in your cart is available right now ({titles}). "
                "We will let you know when it is back."
            ),
        )

    subtotal = Decimal("0.00")
    for it in orderable:
        subtotal += Decimal(str(it.unit_price_snapshot)) * int(it.quantity)

    # Resolve and lock the coupon before pricing, so two orders cannot both take
    # the last redemption of a limited code.
    coupon = None
    discount = Decimal("0.00")
    if payload.coupon_code:
        # Raises 400 if the code does not exist, so `coupon` is set from here on.
        coupon = _load_coupon_for_update(db, payload.coupon_code)
        redemptions = redemptions_for_user(db, coupon.id, current_user.id)
        try:
            assert_coupon_usable(coupon, subtotal=subtotal, user_redemptions=redemptions)
            discount = discount_for(coupon, subtotal)
        except CouponError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    totals = compute_totals(subtotal, discount=discount)

    # Store credit, validated against the balance and the per-order cap here rather
    # than trusting the amount the browser asked for. Applied against the order
    # total, so it also covers shipping and tax — credit the shop already owes the
    # customer should not be restricted to the goods line.
    credit_applied = money(0)
    credit_entry = None
    if payload.wallet_credit and money(payload.wallet_credit) > 0:
        try:
            credit_entry = wallet.redeem(
                db,
                current_user.id,
                payload.wallet_credit,
                subtotal=totals.total,
                note="Applied to an order",
            )
        except wallet.WalletError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        credit_applied = money(payload.wallet_credit)

    # Re-checked here rather than trusted from the request: the ceiling exists
    # because an order refused at the door costs the courier fee both ways, and a
    # client that simply omits the check would walk straight past it.
    if payload.payment_method == PAYMENT_METHOD_COD:
        allowed, reason = cod_available(
            totals.total,
            enabled=_rules().cod_enabled,
            max_total=_rules().cod_max_order_total,
        )
        if not allowed:
            raise HTTPException(status_code=400, detail=reason)

    order = models.Order(
        user_id=current_user.id,
        status=ORDER_STATUS_PROCESSING,
        subtotal=totals.subtotal,
        shipping=totals.shipping,
        tax=totals.tax,
        discount=totals.discount,
        total=totals.total,
        wallet_credit_used=credit_applied,
        coupon_code=coupon.code if coupon else None,
        payment_method=payload.payment_method,
        payment_status=PAYMENT_STATUS_PENDING,
        # Snapshot the address: editing the saved one later must not rewrite
        # where this order was actually sent.
        ship_full_name=shipping_address.get("full_name"),
        ship_phone=shipping_address.get("phone"),
        ship_line1=shipping_address.get("line1"),
        ship_line2=shipping_address.get("line2"),
        ship_city=shipping_address.get("city"),
        ship_state=shipping_address.get("state"),
        ship_postal_code=shipping_address.get("postal_code"),
        ship_country=shipping_address.get("country"),
    )
    db.add(order)
    db.flush()

    if credit_entry is not None:
        # The ledger row was created before the order had an id, so it is linked
        # here. It has to be the object itself: `db.new` is empty by this point
        # because the flush above moved it out, and without the link
        # `refund_redemption` cannot find the entry when the order is cancelled —
        # the customer's credit would simply disappear.
        credit_entry.order_id = order.id

    if coupon is not None:
        coupon.times_redeemed = int(coupon.times_redeemed or 0) + 1
        db.add(
            models.CouponRedemption(
                coupon_id=coupon.id,
                user_id=current_user.id,
                order_id=order.id,
                amount=totals.discount,
            )
        )

    # Only what was ordered. Anything unavailable stays in the cart, still waiting
    # for its restock notice.
    for it in orderable:
        book = books_by_id[it.book_id]
        db.add(
            models.OrderItem(
                order_id=order.id,
                book_id=it.book_id,
                title_snapshot=book.title,
                unit_price_snapshot=it.unit_price_snapshot,
                quantity=it.quantity,
            )
        )
        book.stock = int(book.stock) - int(it.quantity)
        db.delete(it)

    # The customer's own notification is cheap and they expect it immediately.
    db.add(
        models.Notification(
            user_id=current_user.id,
            title="Order placed",
            body=f"Your order {str(order.id)} has been placed successfully.",
            is_read=False,
        )
    )

    # Everything else leaves the request. These are enqueued in the *same*
    # transaction as the order, so the order can never commit without its
    # follow-up work being recorded — and the customer never waits on an SMTP
    # round trip for an order that is already placed.
    enqueue(db, "order_confirmation_email", {"order_id": str(order.id)})
    enqueue(db, "admin_order_notifications", {"order_id": str(order.id)})

    if idempotency_key:
        db.add(
            models.IdempotencyKey(
                user_id=current_user.id,
                scope="checkout",
                key=idempotency_key,
                order_id=order.id,
            )
        )

    depleted = [str(b.id) for b in books_by_id.values() if int(b.stock or 0) <= 10]
    if depleted:
        enqueue(db, "low_stock_alert", {"book_ids": depleted, "threshold": 10})

    db.commit()

    order_full = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order.id, models.Order.user_id == current_user.id)
        .first()
    )

    return order_full


# ----- payment -----

@router.post("/orders/{order_id}/payment", response_model=PaymentIntentRead)
def start_payment(
    order_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Create a gateway payment order for an unpaid order.

    Reports `enabled: false` when no gateway keys are configured, rather than
    pretending the order was paid.
    """
    order = (
        db.query(models.Order)
        .filter(models.Order.id == order_id, models.Order.user_id == current_user.id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == "paid":
        raise HTTPException(status_code=409, detail="This order is already paid.")

    if not settings.payments_enabled:
        return PaymentIntentRead(enabled=False, order_id=order.id)

    try:
        gateway_order = payments.create_payment_order(
            amount=_amount_payable(order),
            receipt=str(order.id),
            notes={"order_id": str(order.id), "user_id": str(current_user.id)},
        )
    except payments.PaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    order.payment_provider = payments.PROVIDER
    # Stamped at the moment the gateway order is created, not read from settings
    # later: the flag can be flipped between a payment and the report that counts
    # it, and the order has to keep saying which keys actually took the money.
    order.payment_mode = settings.RAZORPAY_MODE
    order.payment_order_id = gateway_order.get("id")
    db.commit()

    return PaymentIntentRead(
        enabled=True,
        provider=payments.PROVIDER,
        key_id=settings.razorpay_key_id,
        currency=settings.CURRENCY,
        amount=payments.to_minor_units(_amount_payable(order)),
        payment_order_id=gateway_order.get("id"),
        order_id=order.id,
    )


@router.post("/orders/{order_id}/payment/confirm", response_model=OrderRead)
def confirm_payment(
    order_id: UUID,
    payload: PaymentConfirmRequest,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Mark an order paid, but only against a valid gateway signature.

    The browser reports the outcome, so it cannot be trusted: without verifying
    the HMAC anyone could POST here and get a free order.
    """
    # Lock without eager-loading items: PostgreSQL refuses FOR UPDATE on the
    # nullable side of the LEFT OUTER JOIN that joinedload produces. Items are
    # loaded lazily for the response after the row is locked.
    order = (
        db.query(models.Order)
        .filter(models.Order.id == order_id, models.Order.user_id == current_user.id)
        .with_for_update()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == "paid":
        return order

    if order.payment_order_id and order.payment_order_id != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment does not belong to this order.")

    if not payments.verify_payment_signature(
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        signature=payload.razorpay_signature,
    ):
        order.payment_status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Payment could not be verified.")

    order.payment_status = "paid"
    order.payment_reference = payload.razorpay_payment_id
    order.paid_at = datetime.now(timezone.utc)

    db.add(
        models.Notification(
            user_id=current_user.id,
            title="Payment received",
            body=f"Payment for order {order.id} was received.",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=List[OrderRead])
def list_orders(db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    return (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.user_id == current_user.id)
        .order_by(models.Order.created_at.desc())
        .all()
    )


@router.get("/orders/{order_id}", response_model=OrderRead)
def get_order(order_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id, models.Order.user_id == current_user.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/orders/{order_id}/cancel", response_model=OrderRead)
def cancel_order(order_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("customer"))):
    # Lock the order row so two concurrent cancels cannot both pass the status
    # check below and restore the stock twice.
    order = (
        db.query(models.Order)
        .filter(models.Order.id == order_id, models.Order.user_id == current_user.id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == ORDER_STATUS_CANCELLED:
        return order

    if order.status != ORDER_STATUS_PROCESSING:
        raise HTTPException(status_code=409, detail="Only processing orders can be cancelled")

    # Stock restore, the notification and any refund all live here so the admin
    # route cannot drift from this one again.
    cancel_order_in_transaction(db, order, cancelled_by="customer")
    db.commit()
    db.refresh(order)
    return order

