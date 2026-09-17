"""Selling a used book to the shop, and spending the credit it earns.

The seller's half of the flow. The shop's half — approving, grading what arrives
and paying out — is in `admin.py`, because it needs the admin role and sits with
the rest of the back-office work.

A quote is deliberately free and instant: the whole reason a student sells a course
book here rather than to a classmate is finding out in one click what it is worth.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core import buyback as pricing
from app.core import storage
from app.core import wallet
from app.core import store_settings
from app.core.config import settings
from app.core.pricing import money
from app.database import db, models
from app.database.dep import require_role
from app.database.models.buyback import (
    BUYBACK_PHOTO_KINDS,
    BuybackPhoto,
    BuybackRequest,
)
from app.schema.pagination import PageMeta
from app.schema.buyback import (
    BuybackDispatch,
    BuybackRequestPage,
    BuybackQuoteRequest,
    BuybackQuoteResponse,
    BuybackRequestRead,
    BuybackSubmitRequest,
    WalletRead,
)

router = APIRouter(prefix="/api/buyback", tags=["Buyback"])

# One seller cannot flood the queue. Not a rate limit on requests per second — a
# cap on how many can be waiting on the shop at once, which is the thing that
# actually costs staff time.
MAX_OPEN_REQUESTS = 10

# Which statuses a seller may still attach or remove photographs on. Once the
# shop has decided, the pictures are evidence of what that decision was taken
# from — changing them afterwards would rewrite the record the decision rests on.
PHOTO_EDITABLE_STATUSES = ("submitted",)


def _quote_expiry():
    """When an offer made now stops standing, or None if expiry is switched off."""
    days = settings.BUYBACK_QUOTE_VALID_DAYS
    if days <= 0:
        return None
    return datetime.now(timezone.utc) + timedelta(days=days)


def _load_own_request(db_session: Session, request_id: UUID, user_id, *, lock: bool = False):
    """One of this seller's requests, or a 404.

    Filtering on `user_id` rather than checking ownership afterwards, so a request
    belonging to somebody else is indistinguishable from one that does not exist —
    a 403 would confirm the id is real.
    """
    query = db_session.query(BuybackRequest).filter(
        BuybackRequest.id == request_id,
        BuybackRequest.user_id == user_id,
    )
    if lock:
        query = query.with_for_update()
    found = query.first()
    if found is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return found


def _price_basis(db_session: Session, book_id, listed_price):
    """Return (title, author, isbn, listed_price) for whichever kind of submission.

    A catalogue book's own price is used rather than anything the client sends: the
    quote is money, so its basis cannot be something the browser gets to choose.
    """
    if book_id is not None:
        book = db_session.query(models.Book).filter(models.Book.id == book_id).first()
        if book is None:
            raise HTTPException(status_code=404, detail="That book is not in our catalogue.")
        if book.condition != "new":
            # A used copy's discounted shelf price is not the printed price, so it
            # is the wrong basis for a quote.
            raise HTTPException(
                status_code=400,
                detail="Pick the main listing for this title, not a used copy.",
            )
        if not book.price or money(book.price) <= 0:
            raise HTTPException(
                status_code=400,
                detail="We do not have a price for that title yet. Enter the price printed on your copy.",
            )
        return book.title, book.author, None, money(book.price)

    return None, None, None, money(listed_price)


@router.post("/quote", response_model=BuybackQuoteResponse)
def get_quote(payload: BuybackQuoteRequest, db: Session = Depends(db.get_db)):
    """What the shop would pay, for every condition at once.

    Public: asking what a book is worth should not require an account. Showing all
    three grades together is what makes a seller grade honestly — they can see what
    admitting to highlighting costs, instead of guessing and risking the offer.
    """
    title, _author, _isbn, listed_price = _price_basis(db, payload.book_id, payload.listed_price)

    try:
        pricing.assert_valid_listed_price(listed_price)
    except pricing.BuybackError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    options = pricing.quote_breakdown(listed_price, payload.quantity)
    best = max((o["offer"] for o in options), default=Decimal("0.00"))

    return BuybackQuoteResponse(
        title=title,
        listed_price=listed_price,
        quantity=payload.quantity,
        options=options,
        can_sell=best > 0,
        message=(
            None
            if best > 0
            else f"We can only buy books worth {pricing.MIN_BUYBACK_AMOUNT} or more."
        ),
    )


@router.post("", response_model=BuybackRequestRead, status_code=status.HTTP_201_CREATED)
def submit_request(
    payload: BuybackSubmitRequest,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Offer the shop a book.

    The quote is recomputed here rather than accepted from the client, and stored on
    the row. Recomputing stops a browser from naming its own price; storing it means
    a later change to the rates cannot move an offer the seller has already been
    given.
    """
    open_count = (
        db.query(BuybackRequest)
        .filter(
            BuybackRequest.user_id == current_user.id,
            BuybackRequest.status.in_(("submitted", "approved", "received")),
        )
        .count()
    )
    if open_count >= MAX_OPEN_REQUESTS:
        raise HTTPException(
            status_code=409,
            detail=f"You already have {open_count} requests with us. "
                   "Please wait for those to be processed first.",
        )

    title, author, isbn, listed_price = _price_basis(db, payload.book_id, payload.listed_price)

    try:
        offer = pricing.quote(listed_price, payload.condition, payload.quantity)
    except pricing.BuybackError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if offer <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"We can only buy books worth {pricing.MIN_BUYBACK_AMOUNT} or more.",
        )

    request = BuybackRequest(
        user_id=current_user.id,
        book_id=payload.book_id,
        title=(title or payload.title or "").strip(),
        author=(author or payload.author or None),
        isbn=(payload.isbn or isbn or None),
        listed_price=listed_price,
        condition=payload.condition,
        quantity=payload.quantity,
        quoted_amount=offer,
        payout_method=payload.payout_method,
        payout_upi=payload.payout_upi,
        payout_account_name=payload.payout_account_name,
        seller_note=payload.seller_note,
        status="submitted",
        quote_expires_at=_quote_expiry(),
    )
    db.add(request)

    # Every admin should see it without polling the queue.
    for admin in db.query(models.User).filter(models.User.role == "admin").all():
        db.add(
            models.Notification(
                user_id=admin.id,
                title="Book offered for buyback",
                body=f'"{request.title}" ({pricing.CONDITION_LABELS[request.condition]}) '
                     f"x{request.quantity} — offer {offer}.",
                is_read=False,
            )
        )

    db.commit()
    db.refresh(request)
    return request


@router.get("", response_model=BuybackRequestPage)
def list_my_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """This seller's requests, newest first.

    Paginated because nothing ever leaves this list: a cancelled or rejected
    request stays forever, and one real account here already carries 148 of them
    — 95 KB on every visit to a page that shows the most recent handful. The
    older ones are still reachable, just not all at once.
    """
    base = db.query(BuybackRequest).filter(BuybackRequest.user_id == current_user.id)
    total = base.with_entities(func.count(BuybackRequest.id)).scalar() or 0
    rows = (
        base
        # Every row renders its photographs, so the default lazy load would be
        # one round trip per request on a page that exists to list them.
        .options(selectinload(BuybackRequest.photos))
        .order_by(BuybackRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    open_count = base.filter(
        BuybackRequest.status.in_(("submitted", "approved", "received"))
    ).with_entities(func.count(BuybackRequest.id)).scalar() or 0

    return BuybackRequestPage(
        items=rows,
        meta=PageMeta.from_total(page=page, page_size=page_size, total=total),
        open_count=open_count,
    )


@router.get("/conditions")
def list_conditions():
    """The grades and what each one means.

    Served from the backend so the seller's form and the shop's grading screen
    cannot end up describing the same word differently.
    """
    return {
        "conditions": [
            {
                "value": c,
                "label": pricing.CONDITION_LABELS[c],
                "description": pricing.CONDITION_DESCRIPTIONS[c],
                "buyback_percent": int(pricing.BUYBACK_RATES[c] * 100),
            }
            for c in pricing.CONDITIONS
        ],
        "minimum_amount": pricing.MIN_BUYBACK_AMOUNT,
        # Reported for the same reason as the grades above: the seller's form has
        # to be able to say "we can take two more from you" before the seller
        # picks a book, grades it and chooses a payout — rather than refusing the
        # eleventh request after all that work. A copy of the number in the
        # frontend would be a copy that can drift.
        "max_open_requests": MAX_OPEN_REQUESTS,
        # Where to post an approved book. `None` until configured, which the UI
        # reads as "we will email you the address" rather than telling a seller
        # to post something nowhere.
        "ship_to": settings.buyback_ship_to,
    }


@router.patch("/{request_id}/cancel", response_model=BuybackRequestRead)
def cancel_request(
    request_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Withdraw a request the shop has not paid for yet."""
    request = (
        db.query(BuybackRequest)
        .filter(BuybackRequest.id == request_id, BuybackRequest.user_id == current_user.id)
        .with_for_update()
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.status == "cancelled":
        return request
    if request.status in ("paid", "rejected", "expired"):
        raise HTTPException(
            status_code=409,
            detail=f"This request is already {request.status} and cannot be cancelled.",
        )

    request.status = "cancelled"
    request.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return request


# ----- photographs -----

@router.post("/{request_id}/photos", response_model=BuybackRequestRead, status_code=201)
def add_photo(
    request_id: UUID,
    file: UploadFile = File(...),
    kind: str = Form("other"),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Attach a photograph of the book being offered.

    This is what makes the grade mean anything. Without it an admin approved a
    request having never seen the book, re-graded it on arrival, and the payout
    changed — which is the complaint sellers actually make, and it was structural
    rather than anybody's mistake.

    One file per request rather than a multi-file form: a phone upload over a
    patchy connection fails often enough that failing one photograph out of three
    should not lose the other two.
    """
    if kind not in BUYBACK_PHOTO_KINDS:
        raise HTTPException(
            status_code=400,
            detail=f"kind must be one of {', '.join(BUYBACK_PHOTO_KINDS)}",
        )

    request = _load_own_request(db, request_id, current_user.id)
    if request.status not in PHOTO_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="This request has already been reviewed, so its photos cannot change.",
        )

    if len(request.photos) >= settings.MAX_BUYBACK_PHOTOS:
        raise HTTPException(
            status_code=409,
            detail=f"A request can carry at most {settings.MAX_BUYBACK_PHOTOS} photos.",
        )

    ext = storage.extension_for(file.filename or "")
    if ext is None:
        raise HTTPException(status_code=400, detail="Only .jpg/.jpeg/.png/.webp allowed")

    # Read with a ceiling rather than `file.file.read()`: the unbounded form pulls
    # the whole body into memory, and `Content-Length` is supplied by the client
    # and can lie. Phone photographs are routinely larger than this, which is why
    # the browser downscales before uploading.
    limit = settings.MAX_COVER_UPLOAD_BYTES
    data = file.file.read(limit + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"Photo must be {limit // (1024 * 1024)}MB or smaller",
        )

    try:
        url = storage.save_buyback_photo(str(request_id), data, ext)
    except storage.StorageError as exc:
        # The upload genuinely did not happen. A 200 here would leave a row
        # pointing at an object that was never written.
        raise HTTPException(status_code=502, detail=f"Could not store the photo: {exc}") from exc

    db.add(
        BuybackPhoto(
            request_id=request.id,
            url=url,
            kind=kind,
            # Append. The seller's order is the order they took them in.
            position=len(request.photos),
        )
    )
    db.commit()
    db.refresh(request)
    return request


@router.delete("/{request_id}/photos/{photo_id}", response_model=BuybackRequestRead)
def remove_photo(
    request_id: UUID,
    photo_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Drop a photograph before the shop has looked at the request.

    The stored file is deliberately left in place. It is content-addressed, so it
    is unreferenced rather than orphaned-and-dangerous, and deleting it here would
    also delete an identical photograph on another request that happens to hash
    the same.
    """
    request = _load_own_request(db, request_id, current_user.id)
    if request.status not in PHOTO_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="This request has already been reviewed, so its photos cannot change.",
        )

    photo = next((p for p in request.photos if p.id == photo_id), None)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    db.delete(photo)
    db.flush()
    # Close the gap, so `position` stays a dense 0..n-1 and the next upload does
    # not collide with a number a deletion left behind.
    for index, remaining in enumerate(p for p in request.photos if p.id != photo_id):
        remaining.position = index
    db.commit()
    db.refresh(request)
    return request


# ----- dispatch -----

@router.post("/{request_id}/dispatch", response_model=BuybackRequestRead)
def mark_dispatched(
    request_id: UUID,
    payload: BuybackDispatch,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """The seller has posted an approved book.

    `approved_at` and `received_at` had nothing between them, so one status —
    "awaiting arrival" — covered both "in the post" and "never sent", and neither
    side could find out which. That is the state a seller chases and the state an
    admin cannot chase, at the same time.

    The consignment number is optional. Plenty of sellers hand a parcel over a
    counter and get no docket, and refusing their "I have posted it" because of
    that would leave the shop blinder than before.
    """
    request = _load_own_request(db, request_id, current_user.id, lock=True)

    if request.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Only an approved request can be marked as posted.",
        )

    request.seller_tracking_carrier = payload.carrier
    request.seller_tracking_number = payload.tracking_number
    # Idempotent: re-sending to correct a mistyped number must not move the date.
    first_time = request.dispatched_at is None
    if first_time:
        request.dispatched_at = datetime.now(timezone.utc)

    # Only the first time. A seller fixing a digit is not a second parcel, and
    # telling every admin "it is on its way" again turns the correction into
    # noise — the same reason the orders screen's tracking correction is silent.
    if first_time:
        for admin in db.query(models.User).filter(models.User.role == "admin").all():
            db.add(
                models.Notification(
                    user_id=admin.id,
                    title="Book posted for buyback",
                    body=f'"{request.title}" is on its way'
                         + (f" — {request.seller_tracking_number}." if request.seller_tracking_number else "."),
                    is_read=False,
                )
            )

    db.commit()
    db.refresh(request)
    return request


# ----- store credit -----

@router.get("/wallet", response_model=WalletRead)
def get_wallet(
    subtotal: Decimal = Decimal("0"),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Balance, history, and how much of a given subtotal the credit could cover.

    `subtotal` is a query parameter rather than read from the cart so the checkout
    page can ask about the order it is actually about to place, coupon and all.
    """
    return WalletRead(
        balance=wallet.balance(db, current_user.id),
        max_redeemable_now=wallet.max_redeemable(db, current_user.id, subtotal),
        max_redemption_percent=store_settings.current().wallet_max_redemption_percent,
        entries=wallet.history(db, current_user.id),
    )
