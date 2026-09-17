"""The gaps between what somebody wanted and what the shop could sell them.

Four things, all the same shape: a customer reached a dead end, and until now
nothing recorded it.

* **Used-copy alerts** — they wanted a cheap copy of a title with none.
* **Sell-back quotes on your own orders** — they already own books the shop wants
  to buy, and nothing ever asked.
* **Cart savings** — a used copy exists for something in their basket and the
  cart never mentioned it.
* **Search misses** — they searched for something the shop does not stock.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import buyback as pricing
from app.core import used_alerts
from app.core.pricing import money
from app.database import db, models
from app.database.dep import require_role

router = APIRouter(prefix="/api/customer", tags=["Discovery"])


# ---------------------------------------------------------------------------
# Used-copy alerts
# ---------------------------------------------------------------------------

class UsedAlertCreate(BaseModel):
    #: What they would pay up to. Omitted means any price.
    max_price: Optional[Decimal] = Field(default=None, gt=0)


class UsedAlertRead(BaseModel):
    book_id: UUID
    title: str
    author: Optional[str] = None
    new_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    created_at: datetime
    notified_at: Optional[datetime] = None
    #: How many others are waiting for the same title — it is the reason the shop
    #: will go and find one, and worth saying so.
    waiting: int = 0


@router.get("/used-alerts", response_model=List[UsedAlertRead])
def list_used_alerts(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    rows = (
        db.query(models.UsedCopyAlert, models.Book)
        .join(models.Book, models.Book.id == models.UsedCopyAlert.book_id)
        .filter(models.UsedCopyAlert.user_id == current_user.id)
        .order_by(models.UsedCopyAlert.created_at.desc())
        .all()
    )
    if not rows:
        return []

    # One grouped query for the "others waiting" figures, rather than one per row.
    ids = [a.book_id for a, _ in rows]
    counts = dict(
        db.query(models.UsedCopyAlert.book_id, func.count(models.UsedCopyAlert.id))
        .filter(
            models.UsedCopyAlert.book_id.in_(ids),
            models.UsedCopyAlert.notified_at.is_(None),
        )
        .group_by(models.UsedCopyAlert.book_id)
        .all()
    )

    return [
        UsedAlertRead(
            book_id=alert.book_id,
            title=book.title,
            author=book.author,
            new_price=book.price,
            max_price=alert.max_price,
            created_at=alert.created_at,
            notified_at=alert.notified_at,
            waiting=counts.get(alert.book_id, 0),
        )
        for alert, book in rows
    ]


@router.put("/used-alerts/{book_id}", status_code=status.HTTP_201_CREATED)
def set_used_alert(
    book_id: UUID,
    payload: UsedAlertCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Ask to be told when a second-hand copy of this title appears.

    `PUT` rather than `POST`: asking twice is the same ask, and a second tap
    should update the price ceiling rather than fail.
    """
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.parent_book_id is not None:
        # The alert is about a title, and a used row comes and goes.
        raise HTTPException(
            status_code=400,
            detail="Set the alert on the main listing, not on a used copy.",
        )

    existing = (
        db.query(models.UsedCopyAlert)
        .filter(
            models.UsedCopyAlert.user_id == current_user.id,
            models.UsedCopyAlert.book_id == book_id,
        )
        .first()
    )
    if existing is not None:
        existing.max_price = payload.max_price
        # Asking again means they are still waiting, whatever happened before.
        existing.notified_at = None
        db.commit()
        return {"waiting": used_alerts.waiting_for(db, book_id)}

    db.add(
        models.UsedCopyAlert(
            user_id=current_user.id, book_id=book_id, max_price=payload.max_price
        )
    )
    try:
        db.commit()
    except IntegrityError:
        # The unique constraint caught a double-tap the check above did not.
        db.rollback()
    return {"waiting": used_alerts.waiting_for(db, book_id)}


@router.delete("/used-alerts/{book_id}", status_code=204)
def clear_used_alert(
    book_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    db.query(models.UsedCopyAlert).filter(
        models.UsedCopyAlert.user_id == current_user.id,
        models.UsedCopyAlert.book_id == book_id,
    ).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Sell it back — quotes against what this customer already owns
# ---------------------------------------------------------------------------

class SellBackOffer(BaseModel):
    book_id: UUID
    title: str
    #: What they paid, so the offer has something to sit against.
    paid: Decimal
    listed_price: Decimal
    #: What the shop would pay today, at the middle grade. The real figure
    #: depends on condition, which only the seller knows.
    offer: Decimal
    ordered_at: datetime
    #: True once they have already offered this title, so the page can say so
    #: rather than inviting a duplicate.
    already_offered: bool = False


@router.get("/sell-back-offers", response_model=List[SellBackOffer])
def sell_back_offers(
    limit: int = 20,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Books this customer has bought, with what the shop would pay to buy back.

    The supply side of the used-book business was entirely opt-in: a seller had
    to think of it and find `/sell`. But `order_items` already records exactly
    what every customer owns and what it was worth — so the shop can ask, on the
    page where they are looking at the book they finished reading.

    Delivered orders only. Asking somebody to sell back a parcel that has not
    arrived is asking them to sell something they do not have.
    """
    rows = (
        db.query(models.OrderItem, models.Order, models.Book)
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .join(models.Book, models.Book.id == models.OrderItem.book_id)
        .filter(
            models.Order.user_id == current_user.id,
            models.Order.status == "delivered",
            # A used copy bought second-hand is not worth buying back again at
            # these rates; the offer would be under the minimum anyway.
            models.Book.parent_book_id.is_(None),
        )
        .order_by(models.Order.created_at.desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return []

    offered = {
        r.book_id
        for r in db.query(models.BuybackRequest.book_id)
        .filter(
            models.BuybackRequest.user_id == current_user.id,
            models.BuybackRequest.book_id.isnot(None),
        )
        .all()
    }

    out: List[SellBackOffer] = []
    seen: set = set()
    for item, order, book in rows:
        if book.id in seen:
            continue
        seen.add(book.id)
        listed = money(book.price or item.unit_price_snapshot)
        try:
            # The middle grade. Quoting "like new" would overstate what most
            # copies fetch and make the re-grade on arrival feel like a cut.
            offer = pricing.quote(listed, "good", 1)
        except pricing.BuybackError:
            continue
        if offer <= 0:
            continue
        out.append(
            SellBackOffer(
                book_id=book.id,
                title=book.title,
                paid=money(item.unit_price_snapshot),
                listed_price=listed,
                offer=offer,
                ordered_at=order.created_at,
                already_offered=book.id in offered,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Cart savings
# ---------------------------------------------------------------------------

class CartSaving(BaseModel):
    cart_book_id: UUID
    used_book_id: UUID
    title: str
    condition: str
    new_price: Decimal
    used_price: Decimal
    saving: Decimal
    stock: int


@router.get("/cart/used-savings", response_model=List[CartSaving])
def cart_used_savings(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Cheaper second-hand copies of things already in this cart.

    The used block lives on the product page, which is a page somebody has
    already left by the time they are deciding whether to pay. The saving is
    worth naming where the money is about to be spent.
    """
    cart = db.query(models.Cart).filter(models.Cart.user_id == current_user.id).first()
    if cart is None:
        return []

    items = db.query(models.CartItem).filter(models.CartItem.cart_id == cart.id).all()
    book_ids = [i.book_id for i in items]
    if not book_ids:
        return []

    # Only titles in the cart, only buyable used copies, cheapest first so the
    # best offer per title survives the de-duplication below.
    used = (
        db.query(models.Book)
        .filter(
            models.Book.parent_book_id.in_(book_ids),
            models.Book.stock > 0,
        )
        .order_by(models.Book.price.asc())
        .all()
    )
    parents = {
        b.id: b
        for b in db.query(models.Book).filter(models.Book.id.in_(book_ids)).all()
    }

    out: List[CartSaving] = []
    seen: set = set()
    for copy in used:
        if copy.parent_book_id in seen:
            continue
        parent = parents.get(copy.parent_book_id)
        if parent is None or parent.price is None or copy.price is None:
            continue
        saving = money(parent.price) - money(copy.price)
        if saving <= 0:
            continue
        seen.add(copy.parent_book_id)
        out.append(
            CartSaving(
                cart_book_id=parent.id,
                used_book_id=copy.id,
                title=parent.title,
                condition=copy.condition,
                new_price=money(parent.price),
                used_price=money(copy.price),
                saving=saving,
                stock=int(copy.stock or 0),
            )
        )
    return out
