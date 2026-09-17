"""Returns: the customer's half.

An order could be cancelled before dispatch and nothing existed afterwards, so
"it arrived torn" was an e-mail — a refund decided with no record of what was
claimed, what was seen, or what was paid back. On second-hand stock that happens
regularly, and it is exactly the stock where a buyer most needs to believe the
shop will put it right.

The shop's half — deciding and paying — is in `admin.py`, with the rest of the
back-office work.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core import storage
from app.core.config import settings
from app.database import db, models
from app.database.dep import require_role
from app.database.models.returns import ReturnPhoto, ReturnRequest
from app.schema.returns import ReturnCreate, ReturnRead

router = APIRouter(prefix="/api/customer/returns", tags=["Returns"])

#: How long after delivery a claim may be opened. A window rather than forever:
#: past it nobody can tell whether the damage came from the shop or from the
#: bookshelf, and a claim that cannot be judged is one that gets refused anyway.
RETURN_WINDOW_DAYS = 14

#: Photographs per claim. The argument about damage is visual, and three angles
#: settle almost all of it.
MAX_RETURN_PHOTOS = 4

#: While the shop is still looking, the customer can add or drop pictures. Once
#: it has decided, they are the evidence that decision was taken from.
PHOTO_EDITABLE_STATUSES = ("requested",)


def _load_own(db_session: Session, request_id: UUID, user_id):
    found = (
        db_session.query(ReturnRequest)
        .options(selectinload(ReturnRequest.photos))
        .filter(ReturnRequest.id == request_id, ReturnRequest.user_id == user_id)
        .first()
    )
    if found is None:
        # A 404 rather than a 403 for somebody else's claim: a 403 confirms the
        # id is real.
        raise HTTPException(status_code=404, detail="Return not found")
    return found


def _to_read(request: ReturnRequest) -> ReturnRead:
    return ReturnRead(
        **{c.name: getattr(request, c.name) for c in request.__table__.columns},
        # A relationship, so it is not in the column spread above.
        photos=list(request.photos or []),
        book_title=request.item.title_snapshot if request.item else None,
    )


@router.get("", response_model=List[ReturnRead])
def list_my_returns(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    rows = (
        db.query(ReturnRequest)
        .options(selectinload(ReturnRequest.photos), selectinload(ReturnRequest.item))
        .filter(ReturnRequest.user_id == current_user.id)
        .order_by(ReturnRequest.created_at.desc())
        .all()
    )
    return [_to_read(r) for r in rows]


@router.post("", response_model=ReturnRead, status_code=status.HTTP_201_CREATED)
def open_return(
    payload: ReturnCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Claim against one line of a delivered order."""
    item = (
        db.query(models.OrderItem)
        .filter(models.OrderItem.id == payload.order_item_id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="That item is not on any order")

    order = db.query(models.Order).filter(models.Order.id == item.order_id).first()
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="That item is not on any of your orders")

    if order.status != "delivered":
        raise HTTPException(
            status_code=409,
            detail="You can raise a return once the order has been delivered. "
                   "Before then, cancel it instead.",
        )

    delivered = order.delivered_at
    if delivered is not None:
        # Compared as instants. `delivered_at` is timezone-aware; a naive
        # comparison here would be wrong by the server's offset.
        if datetime.now(timezone.utc) - delivered > timedelta(days=RETURN_WINDOW_DAYS):
            raise HTTPException(
                status_code=409,
                detail=f"Returns close {RETURN_WINDOW_DAYS} days after delivery. "
                       "Write to us and we will still take a look.",
            )

    if payload.quantity > item.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"You ordered {item.quantity} of these.",
        )

    # The partial unique index enforces this too; checking here turns a database
    # error into a sentence that says what happened.
    existing = (
        db.query(ReturnRequest)
        .filter(
            ReturnRequest.order_item_id == item.id,
            ReturnRequest.status.in_(("requested", "approved")),
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="You already have an open return for this item.",
        )

    request = ReturnRequest(
        order_id=order.id,
        order_item_id=item.id,
        user_id=current_user.id,
        reason=payload.reason,
        detail=payload.detail,
        quantity=payload.quantity,
        status="requested",
    )
    db.add(request)

    for admin in db.query(models.User).filter(models.User.role == "admin").all():
        db.add(
            models.Notification(
                user_id=admin.id,
                title="Return requested",
                body=f'"{item.title_snapshot}" — {payload.reason.replace("_", " ")}.',
                is_read=False,
            )
        )

    try:
        db.commit()
    except IntegrityError:
        # `uq_return_open_per_item` caught a claim the check above did not: two
        # requests can both read "no open claim" before either commits. The
        # index is what actually prevents the double refund; this turns its
        # error into the same sentence the check gives.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="You already have an open return for this item.",
        )
    db.refresh(request)
    return _to_read(request)


@router.post("/{request_id}/photos", response_model=ReturnRead, status_code=201)
def add_photo(
    request_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Show what arrived.

    The whole argument about a damage claim is visual, and settling it over
    e-mail means settling it from a description.
    """
    request = _load_own(db, request_id, current_user.id)
    if request.status not in PHOTO_EDITABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="This return has already been reviewed, so its photos cannot change.",
        )
    if len(request.photos) >= MAX_RETURN_PHOTOS:
        raise HTTPException(
            status_code=409, detail=f"A return can carry at most {MAX_RETURN_PHOTOS} photos."
        )

    ext = storage.extension_for(file.filename or "")
    if ext is None:
        raise HTTPException(status_code=400, detail="Only .jpg/.jpeg/.png/.webp allowed")

    limit = settings.MAX_COVER_UPLOAD_BYTES
    data = file.file.read(limit + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > limit:
        raise HTTPException(
            status_code=413, detail=f"Photo must be {limit // (1024 * 1024)}MB or smaller"
        )

    try:
        url = storage.save_return_photo(str(request_id), data, ext)
    except storage.StorageError as exc:
        raise HTTPException(status_code=502, detail=f"Could not store the photo: {exc}") from exc

    db.add(ReturnPhoto(request_id=request.id, url=url, position=len(request.photos)))
    db.commit()
    db.refresh(request)
    return _to_read(request)


@router.patch("/{request_id}/cancel", response_model=ReturnRead)
def withdraw(
    request_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Withdraw a claim the shop has not decided yet.

    Recorded as `rejected` with the customer named as the reason rather than
    deleted: the row is the record that a claim was made, and a claim somebody
    withdrew is a different fact from one that was never raised.
    """
    request = _load_own(db, request_id, current_user.id)
    if request.status != "requested":
        raise HTTPException(
            status_code=409,
            detail=f"This return is already {request.status} and cannot be withdrawn.",
        )

    request.status = "rejected"
    request.rejection_reason = "Withdrawn by the customer."
    request.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return _to_read(request)
