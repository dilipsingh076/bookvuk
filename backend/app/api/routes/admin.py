from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, or_
from sqlalchemy.sql.sqltypes import String
from fastapi import Response
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core import buyback as buyback_pricing
from app.core import order_queue
from app.core import shipping
from app.core import storage
from app.core import store_settings
from app.core import used_alerts
from app.core.config import settings
from app.core import wallet
from app.core.fulfilment import cancel_order_in_transaction
from app.core.jobs import enqueue
from app.core.pricing import money
from app.database.models.buyback import BUYBACK_STATUSES
from app.core.order_status import (
    ORDER_STATUS_CANCELLED,
    can_transition,
    stamp_status_time,
)
from app.core.payment import (
    PAYMENT_STATUS_PAID,
    is_cod,
)
from app.schema.commerce import AdminCouponCreate, AdminCouponRead
from app.database.dep import require_role
from app.schema.book import BookResponse, BookCreate
from app.schema.admin import (
    AdminAuthorCreate,
    AdminAuthorRead,
    AdminAuthorUpdate,
    AdminCustomerDetail,
    AdminCustomerPage,
    AdminCustomerRead,
    AdminDashboardOverviewCard,
    AdminInventoryRestockRequest,
    AdminOrderPage,
    AdminOrderRead,
    AdminOrderStatusUpdate,
    AdminOrderTrackingUpdate,
    AdminWalletEntryRead,
    StoreSettingsRead,
    StoreSettingsUpdate,
)
from app.schema.pagination import PageMeta
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from app.database import db, models
from app.schema.category import CategoryCreate, CategoryResponse
from app.schema.buyback import (
    AdminBuybackDecision,
    AdminBuybackPayout,
    AdminBuybackPage,
    AdminBuybackRead,
    AdminBuybackReceive,
)
from app.schema.notification import NotificationRead
from app.database.models.returns import RETURN_STATUSES
from app.schema.returns import (
    AdminReturnDecision,
    AdminReturnRead,
    AdminReturnResolve,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

#: The shop's day. `created_at` is stored as UTC, so a date filter taken as UTC
#: midnight puts the first five and a half hours of every Indian day into the
#: previous one — "today's orders" would be visibly wrong every single morning.
SHOP_TZ = ZoneInfo("Asia/Kolkata")


def _day_start(d: date) -> datetime:
    """Midnight on `d` in the shop's timezone, as an instant."""
    return datetime(d.year, d.month, d.day, tzinfo=SHOP_TZ)

@router.get("/overview", response_model=List[AdminDashboardOverviewCard])
def admin_overview(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    total_books = db.query(func.count(models.Book.id)).scalar() or 0
    authors_count = (
        db.query(func.count(func.distinct(models.Book.author)))
        .filter(models.Book.author.isnot(None))
        .filter(models.Book.author != "")
        .scalar()
        or 0
    )

    orders_today = (
        db.query(func.count(models.Order.id))
        .filter(func.date(models.Order.created_at) == func.current_date())
        .scalar()
        or 0
    )

    low_stock = (
        db.query(func.count(models.Book.id))
        .filter(models.Book.stock <= 10)
        .scalar()
        or 0
    )

    return [
        AdminDashboardOverviewCard(
            title="Total books", value=str(total_books), sub="Books in catalog"
        ),
        AdminDashboardOverviewCard(
            title="Authors", value=str(authors_count), sub="Distinct authors in catalog"
        ),
        AdminDashboardOverviewCard(
            title="Orders today", value=str(orders_today), sub="Orders created today"
        ),
        AdminDashboardOverviewCard(
            title="Low stock", value=str(low_stock), sub="Books with stock ≤ 10"
        ),
    ]

@router.post("/categories", response_model=CategoryResponse)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    category = models.Category(name=payload.name)

    db.add(category)
    db.commit()
    db.refresh(category)
    return category

@router.post("/books", response_model=BookResponse)
def add_books(
    new_book: BookCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):

    category = (
        db.query(models.Category)
        .filter(models.Category.id == new_book.category_id)
        .first()
    )

    if not category:
        raise HTTPException(status_code=400, detail="Category not found")

    book = models.Book(**new_book.model_dump())
    db.add(book)
    db.commit()
    db.refresh(book)

    return book

@router.put("/books/{book_id}", response_model=BookResponse)
def update_book(book_id: UUID, payload: BookCreate, db: Session = Depends(db.get_db), current_user=Depends(require_role("admin"))):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    for k, v in payload.model_dump().items():
        setattr(book, k, v)
    db.add(book)
    db.commit()
    db.refresh(book)
    return book

@router.post("/books/{book_id}/cover", response_model=BookResponse)
def upload_book_cover(
    book_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    ext = storage.extension_for(file.filename or "")
    if ext is None:
        raise HTTPException(status_code=400, detail="Only .jpg/.jpeg/.png/.webp allowed")

    # Read with a ceiling rather than `file.file.read()`. The unbounded form pulls
    # the whole body into memory, so one oversized upload can take down a small
    # instance — and the limit has to be enforced here because `Content-Length` is
    # supplied by the client and can lie.
    limit = settings.MAX_COVER_UPLOAD_BYTES
    data = file.file.read(limit + 1)
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"Cover must be {limit // (1024 * 1024)}MB or smaller",
        )

    try:
        book.cover_image = storage.save_book_cover(str(book_id), data, ext)
    except storage.StorageError as exc:
        # The upload genuinely did not happen. Returning 200 here would leave the
        # catalogue pointing at an object that was never written.
        raise HTTPException(status_code=502, detail=f"Could not store the cover: {exc}") from exc

    db.add(book)
    db.commit()
    db.refresh(book)
    return book

@router.delete("/books/{book_id}", status_code=204)
def delete_book(book_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("admin"))):
    """Remove a book that nothing depends on.

    A book that has ever sold cannot go: `order_items.book_id` is RESTRICT,
    because an order must keep naming what was actually bought. That is right —
    but it used to surface as a bare 500, which tells the admin nothing and looks
    like the shop is broken rather than like the rule it is.
    """
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    sold = (
        db.query(func.count(models.OrderItem.id))
        .filter(models.OrderItem.book_id == book_id)
        .scalar()
        or 0
    )
    if sold:
        raise HTTPException(
            status_code=409,
            detail=(
                f'"{book.title}" is on {sold} past order{"s" if sold != 1 else ""} and cannot be '
                "deleted — those orders have to keep naming what was bought. "
                "Set its stock to 0 to take it off the shelf instead."
            ),
        )

    # A used copy pointing at this title, or anything else that references it.
    # Checked as a backstop rather than enumerated: the count above covers the
    # case that actually happens, and this turns the rest into a sentence too.
    try:
        db.delete(book)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f'"{book.title}" is still referenced elsewhere and cannot be deleted.',
        )
    return None

@router.get("/authors", response_model=List[AdminAuthorRead])
def list_authors(
    q: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(models.Author)
    if status:
        query = query.filter(models.Author.status == status)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(models.Author.name.ilike(term), models.Author.bio.ilike(term)))

    authors = query.order_by(models.Author.created_at.desc()).all()

    counts = dict(
        db.query(models.Book.author, func.count(models.Book.id))
        .filter(models.Book.author.isnot(None))
        .filter(models.Book.author != "")
        .group_by(models.Book.author)
        .all()
    )

    return [
        AdminAuthorRead(
            id=a.id,
            name=a.name,
            bio=a.bio,
            status=a.status,
            created_at=a.created_at,
            bookCount=int(counts.get(a.name, 0) or 0),
        )
        for a in authors
    ]

@router.post("/authors", response_model=AdminAuthorRead)
def create_author(
    payload: AdminAuthorCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    existing = db.query(models.Author).filter(models.Author.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Author already exists")
    author = models.Author(name=payload.name, bio=payload.bio, status=payload.status)
    db.add(author)
    db.commit()
    db.refresh(author)
    return author

@router.put("/authors/{author_id}", response_model=AdminAuthorRead)
def update_author(
    author_id: UUID,
    payload: AdminAuthorUpdate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    author = db.query(models.Author).filter(models.Author.id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = data["name"]
        if name and name != author.name:
            dupe = db.query(models.Author).filter(models.Author.name == name).first()
            if dupe:
                raise HTTPException(status_code=400, detail="Author name already exists")
    for k, v in data.items():
        setattr(author, k, v)
    db.add(author)
    db.commit()
    db.refresh(author)
    return author

@router.delete("/authors/{author_id}", status_code=204)
def delete_author(
    author_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    author = db.query(models.Author).filter(models.Author.id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    db.delete(author)
    db.commit()
    return None

# -------- Inventory --------

@router.post("/inventory/books/{book_id}/restock", response_model=BookResponse)
def restock_book(
    book_id: UUID,
    payload: AdminInventoryRestockRequest,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    # Locked because the 0 -> positive transition below decides whether to notify,
    # and two concurrent restocks reading stock 0 would both think they were first.
    book = db.query(models.Book).filter(models.Book.id == book_id).with_for_update().first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    was_sold_out = int(book.stock or 0) <= 0
    book.stock = int(book.stock or 0) + int(payload.add_stock)
    db.add(book)

    if was_sold_out and int(book.stock) > 0:
        # Only on the transition back into stock. Anyone who wishlisted it while it
        # was unavailable has already shown they want it.
        enqueue(db, "back_in_stock_email", {"book_id": str(book.id)})

    db.commit()
    db.refresh(book)
    return book

@router.get("/orders", response_model=AdminOrderPage)
def list_orders(
    q: Optional[str] = None,
    status: Optional[str] = None,
    lens: str = order_queue.LENS_ALL,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """A page of orders, plus how much work each lens is holding.

    This used to be `.all()`. Every order, every time, with the screen doing the
    filtering and counting over the whole table in the browser — fine at a
    hundred orders and a multi-megabyte response at ten thousand, on a screen
    somebody opens every morning.

    Paginating alone would have broken the tabs, because their counts were
    derived from the rows on screen and a page does not know what it is a page
    of. So the counts come back with the page, computed over everything the
    current search and date range select. They are not counts of `items`.
    """
    base = db.query(models.Order).join(models.User, models.User.id == models.Order.user_id)
    if status:
        base = base.filter(models.Order.status == status)
    if date_from:
        base = base.filter(models.Order.created_at >= _day_start(date_from))
    if date_to:
        # Inclusive: somebody asking for "1st to 7th" means the whole of the 7th,
        # and an exclusive bound silently drops that day's orders.
        base = base.filter(models.Order.created_at < _day_start(date_to) + timedelta(days=1))
    if q:
        term = f"%{q.strip()}%"
        base = base.filter(
            or_(
                func.cast(models.Order.id, String).ilike(term),
                models.User.email.ilike(term),
                models.User.username.ilike(term),
                models.User.full_name.ilike(term),
                models.Order.status.ilike(term),
                # A courier or a customer quotes a consignment number and expects
                # the order to be findable from it; that is most of what the
                # number is for.
                models.Order.tracking_number.ilike(term),
            )
        )

    # Every tab's count in one round trip. Four separate COUNT queries would be
    # four times the dominant cost of this endpoint, which is the trip itself.
    counts_row = base.with_entities(
        func.count(models.Order.id).filter(order_queue.to_fulfil()).label("todo"),
        func.count(models.Order.id).filter(order_queue.cash_to_collect()).label("cash"),
        func.count(models.Order.id).filter(order_queue.awaiting_payment()).label("unpaid"),
        func.count(models.Order.id).label("all"),
    ).one()
    counts = {
        order_queue.LENS_TODO: counts_row.todo,
        order_queue.LENS_CASH: counts_row.cash,
        order_queue.LENS_UNPAID: counts_row.unpaid,
        order_queue.LENS_ALL: counts_row.all,
    }

    criterion = order_queue.criterion_for(lens)
    query = base.filter(criterion) if criterion is not None else base

    total = counts.get(lens, counts[order_queue.LENS_ALL])
    rows = (
        # `selectinload`, because every row's items are read to build the
        # response and the default lazy load fetches them one order at a time —
        # a page of 50 was 50 extra round trips at ~176 ms each. `joinedload`
        # would also work but multiplies the order row by its item count, which
        # this query then has to de-duplicate.
        query.options(selectinload(models.Order.items))
        .order_by(models.Order.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # One query for every customer on the page, rather than one per row.
    customer_ids = {o.user_id for o in rows if o.user_id}
    customers = (
        {u.id: u for u in db.query(models.User).filter(models.User.id.in_(customer_ids)).all()}
        if customer_ids
        else {}
    )
    return AdminOrderPage(
        items=[_admin_order_read(db, o, customers) for o in rows],
        meta=PageMeta.from_total(page=page, page_size=page_size, total=total),
        counts=counts,
    )

def _admin_order_read(db: Session, o, customers: dict | None = None) -> AdminOrderRead:
    """One `AdminOrderRead`, built the same way everywhere.

    Four routes returned this shape and three of them had assembled it by hand,
    each re-deriving the customer's display name and re-flattening the items. A
    field added to the schema would have had to be remembered in every copy, and
    a copy that forgot it fails at *response* time — a 500 on an endpoint whose
    own logic worked.

    `customers` is an optional id -> user map for the list endpoint, for the same
    reason the buyback queue needed one: a lookup per row is fine for one order
    and quadratic-feeling for a page of them against a remote database.
    """
    if customers is not None:
        user = customers.get(o.user_id)
    else:
        user = db.query(models.User).filter(models.User.id == o.user_id).first()
    return AdminOrderRead(
        id=o.id,
        createdAt=o.created_at,
        status=o.status,
        userId=o.user_id,
        customerName=(user.full_name or user.username) if user else "Customer",
        customerEmail=user.email if user else "",
        subtotal=o.subtotal,
        shipping=o.shipping,
        tax=o.tax,
        total=o.total,
        discount=o.discount,
        couponCode=o.coupon_code,
        walletCreditUsed=o.wallet_credit_used,
        paymentStatus=o.payment_status,
        paymentMethod=o.payment_method,
        paymentMode=o.payment_mode,
        paidAt=o.paid_at,
        shipFullName=o.ship_full_name,
        shipPhone=o.ship_phone,
        shipLine1=o.ship_line1,
        shipLine2=o.ship_line2,
        shipCity=o.ship_city,
        shipState=o.ship_state,
        shipPostalCode=o.ship_postal_code,
        shipCountry=o.ship_country,
        trackingCarrier=o.tracking_carrier,
        # Label and URL are derived, never stored: one edit to the carrier
        # registry fixes every historic order rather than leaving dead links on
        # all of them the day a courier changes its tracking path.
        trackingCarrierLabel=shipping.label_for(o.tracking_carrier),
        trackingNumber=o.tracking_number,
        trackingUrl=shipping.tracking_url(o.tracking_carrier, o.tracking_number),
        packedAt=o.packed_at,
        shippedAt=o.shipped_at,
        deliveredAt=o.delivered_at,
        cancelledAt=o.cancelled_at,
        items=[
            {
                "id": it.id,
                "bookId": it.book_id,
                "title": it.title_snapshot,
                "price": it.unit_price_snapshot,
                "qty": it.quantity,
            }
            for it in (o.items or [])
        ],
    )


@router.get("/orders/{order_id}", response_model=AdminOrderRead)
def get_order(
    order_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    o = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return _admin_order_read(db, o)

@router.post("/orders/{order_id}/collect-cash", response_model=AdminOrderRead)
def collect_cash_on_delivery(
    order_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Record that a cash-on-delivery order was paid for at the door.

    This is the half of COD that has no gateway to do it. Without it a COD order
    stays `pending` forever: delivered, money in hand, and every report that
    counts revenue by `payment_status` quietly missing it.

    Deliberately its own endpoint rather than a field on the status update. Cash
    changing hands and a parcel being marked delivered are two different events —
    a courier can deliver and fail to collect — and folding them together would
    make one impossible to record without the other.
    """
    order = (
        db.query(models.Order)
        .filter(models.Order.id == order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not is_cod(order):
        raise HTTPException(
            status_code=400,
            detail="This order was not placed for cash on delivery.",
        )
    # Idempotent: a double-click, or a retry after a dropped response, must not
    # book the money twice.
    if order.payment_status == PAYMENT_STATUS_PAID:
        return _admin_order_read(db, order)
    if order.status == ORDER_STATUS_CANCELLED:
        raise HTTPException(
            status_code=409, detail="This order was cancelled; there is nothing to collect."
        )

    now = datetime.now(timezone.utc)
    order.payment_status = PAYMENT_STATUS_PAID
    order.payment_provider = "cod"
    order.paid_at = now
    db.add(order)
    db.add(
        models.Notification(
            user_id=order.user_id,
            title="Payment received",
            body=f"We have recorded the cash payment for your order {order.id}.",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(order)
    return _admin_order_read(db, order)


@router.put("/orders/{order_id}/status", response_model=AdminOrderRead)
def update_order_status(
    order_id: UUID,
    payload: AdminOrderStatusUpdate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    o = db.query(models.Order).filter(models.Order.id == order_id).with_for_update().first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    prev_status = o.status

    # `delivered` and `cancelled` are terminal. Reviving a cancelled order would
    # double-count the stock its cancellation already restored.
    if not can_transition(prev_status, payload.status):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot change a {prev_status} order to {payload.status}",
        )

    # Re-sending the current status is a no-op, not a reason to notify again.
    status_changed = prev_status != payload.status
    if status_changed:
        if payload.status == ORDER_STATUS_CANCELLED:
            # Cancelling is not just a status write: the reserved units have to go
            # back and a paid order has to be refunded. Shared with the customer
            # route so the two cannot disagree about what a cancellation means.
            cancel_order_in_transaction(db, o, cancelled_by="admin")
        else:
            o.status = payload.status
            # The consignment lands in the same transaction as the status. Two
            # calls would leave a window — and, if the second failed, a permanent
            # state — where the order says "shipped" and nothing says in what.
            if payload.tracking_carrier or payload.tracking_number:
                o.tracking_carrier = payload.tracking_carrier
                o.tracking_number = payload.tracking_number
            stamp_status_time(o, payload.status, datetime.now(timezone.utc))
            db.add(o)
            body = f"Your order {str(o.id)} status changed from {prev_status} to {o.status}."
            if o.tracking_number:
                # The consignment number is the whole reason somebody opens a
                # "shipped" notice. Leaving it out of the notification and putting
                # it only in the e-mail means whoever reads this one still has to
                # go and look for it.
                body += (
                    f" {shipping.label_for(o.tracking_carrier) or 'Courier'}: {o.tracking_number}."
                )
            db.add(
                models.Notification(
                    user_id=o.user_id,
                    title="Order update",
                    body=body,
                    is_read=False,
                )
            )
        # The in-app notification above is only seen by someone who returns to the
        # site, so "it has shipped" also goes out by e-mail. Enqueued in this
        # transaction, so it cannot describe a status change that rolled back.
        enqueue(db, "order_status_email", {"order_id": str(o.id), "status": payload.status})
        # One commit, so the status change and everything implied by it land
        # together — a cancelled order is never briefly visible with its stock
        # still spent.
        db.commit()
        db.refresh(o)

    return _admin_order_read(db, o)


@router.put("/orders/{order_id}/tracking", response_model=AdminOrderRead)
def update_order_tracking(
    order_id: UUID,
    payload: AdminOrderTrackingUpdate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Fix or clear the shipment on an order that has already been marked shipped.

    Separate from the status update because it happens on a different occasion:
    shipping is once, correcting a consignment number transcribed from a label is
    whenever somebody notices. Without this, fixing a digit would mean re-sending
    `shipped` to an already-shipped order.

    Deliberately silent — no notification, no e-mail. The customer was already
    told the parcel is on its way; a second "your order has shipped" because a
    typo was corrected is worse than the typo.

    Sending both fields null clears the shipment, for the case where the parcel
    turns out not to have gone at all.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.tracking_carrier = payload.tracking_carrier
    order.tracking_number = payload.tracking_number
    db.add(order)
    db.commit()
    db.refresh(order)
    return _admin_order_read(db, order)


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

def _customer_stats(db: Session, user_ids: list) -> dict:
    """Order totals and wallet balances for a page of customers, in two queries.

    Grouped rather than per-row on purpose. The obvious version — loop the page,
    count that person's orders, sum their wallet — is 2N round trips, and at
    ~176 ms each that is a page that takes half a minute to draw. The same shape
    cost the buyback queue 28.9 s before it was fixed.
    """
    if not user_ids:
        return {}

    orders = (
        db.query(
            models.Order.user_id.label("uid"),
            func.count(models.Order.id).label("orders_count"),
            func.count(models.Order.id)
            .filter(models.Order.payment_status == PAYMENT_STATUS_PAID)
            .label("paid_count"),
            # Paid orders only. Summing placed orders would count an abandoned
            # checkout as revenue, and this is the figure most likely to be read
            # out loud.
            func.coalesce(
                func.sum(models.Order.total).filter(
                    models.Order.payment_status == PAYMENT_STATUS_PAID
                ),
                0,
            ).label("total_spent"),
            func.max(models.Order.created_at).label("last_order_at"),
        )
        .filter(models.Order.user_id.in_(user_ids))
        .group_by(models.Order.user_id)
        .all()
    )

    wallets = (
        db.query(
            models.WalletTransaction.user_id.label("uid"),
            func.coalesce(func.sum(models.WalletTransaction.amount), 0).label("balance"),
        )
        .filter(models.WalletTransaction.user_id.in_(user_ids))
        .group_by(models.WalletTransaction.user_id)
        .all()
    )
    balances = {w.uid: w.balance for w in wallets}

    stats = {
        uid: {
            "orders_count": 0,
            "paid_orders_count": 0,
            "total_spent": Decimal("0"),
            "last_order_at": None,
            "wallet_balance": balances.get(uid, Decimal("0")),
        }
        for uid in user_ids
    }
    for row in orders:
        stats[row.uid].update(
            orders_count=row.orders_count,
            paid_orders_count=row.paid_count,
            total_spent=row.total_spent,
            last_order_at=row.last_order_at,
        )
    return stats


def _customer_read(user, stats: dict) -> AdminCustomerRead:
    return AdminCustomerRead(
        id=user.id,
        name=user.full_name or user.username,
        email=user.email,
        username=user.username,
        isActive=bool(user.is_active),
        createdAt=user.created_at,
        **{
            "ordersCount": stats["orders_count"],
            "paidOrdersCount": stats["paid_orders_count"],
            "totalSpent": stats["total_spent"],
            "lastOrderAt": stats["last_order_at"],
            "walletBalance": stats["wallet_balance"],
        },
    )


@router.get("/customers", response_model=AdminCustomerPage)
def list_customers(
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """The people who buy from the shop.

    There was no way to look at a customer at all. Orders could be searched by
    e-mail, which answers "show me this order" but not "how many times has this
    person ordered, and are we holding credit of theirs" — so the commonest
    support question needed a database client.

    Admins are excluded: this is the customer list, and the shop's own accounts
    sitting in it only make the counts wrong.
    """
    base = db.query(models.User).filter(models.User.role == "customer")
    if q:
        term = f"%{q.strip()}%"
        base = base.filter(
            or_(
                models.User.email.ilike(term),
                models.User.username.ilike(term),
                models.User.full_name.ilike(term),
            )
        )

    total = base.with_entities(func.count(models.User.id)).scalar() or 0
    users = (
        base.order_by(models.User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    stats = _customer_stats(db, [u.id for u in users])
    return AdminCustomerPage(
        items=[_customer_read(u, stats[u.id]) for u in users],
        meta=PageMeta.from_total(page=page, page_size=page_size, total=total),
    )


@router.get("/customers/{user_id}", response_model=AdminCustomerDetail)
def get_customer(
    user_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """One customer, with everything a support conversation needs.

    Assembled here rather than left to the screen to stitch from three endpoints,
    because the situation this exists for is somebody on the phone.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")

    stats = _customer_stats(db, [user.id])[user.id]
    orders = (
        db.query(models.Order)
        # Same reason as the order list: the items are read for every row, and
        # lazily that is one round trip per order.
        .options(selectinload(models.Order.items))
        .filter(models.Order.user_id == user.id)
        .order_by(models.Order.created_at.desc())
        .limit(50)
        .all()
    )
    # The customer map is this one person, so `_admin_order_read` does not go
    # back to the database once per order for a row already in hand.
    customers = {user.id: user}
    wallet_entries = (
        db.query(models.WalletTransaction)
        .filter(models.WalletTransaction.user_id == user.id)
        .order_by(models.WalletTransaction.created_at.desc())
        .limit(20)
        .all()
    )
    buyback_count = (
        db.query(func.count(models.BuybackRequest.id))
        .filter(models.BuybackRequest.user_id == user.id)
        .scalar()
        or 0
    )

    base = _customer_read(user, stats)
    return AdminCustomerDetail(
        **base.model_dump(by_alias=True),
        orders=[_admin_order_read(db, o, customers) for o in orders],
        walletEntries=[AdminWalletEntryRead.model_validate(w) for w in wallet_entries],
        buybackCount=buyback_count,
    )


# ---------------------------------------------------------------------------
# Store settings
# ---------------------------------------------------------------------------

@router.get("/queue")
def admin_queue_counts(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """How much work is waiting, as four numbers.

    The dashboard used to compute these by downloading every order and every
    buyback request — 96 KB to render four figures, growing linearly with the
    shop. Counting belongs where the rows are.

    The predicates come from `core/order_queue.py`, which is also what
    `/api/admin/orders` filters and counts its tabs with. They used to be spelled
    out here *and* as TypeScript in `frontend/src/api/admin.ts`, where the Orders
    screen ran them over every order it had downloaded. Paginating that list
    removed the screen's ability to count anything, so both now come from one
    definition; `tests/test_admin_queue.py` pins it.
    """
    orders = db.query(
        func.count(models.Order.id).filter(order_queue.to_fulfil()).label("to_fulfil"),
        func.count(models.Order.id).filter(order_queue.cash_to_collect()).label("cash_to_collect"),
    ).one()

    buyback = db.query(
        func.count(models.BuybackRequest.id)
        .filter(models.BuybackRequest.status == "submitted")
        .label("buyback_to_review"),
        func.count(models.BuybackRequest.id)
        .filter(models.BuybackRequest.status == "received")
        .label("buyback_to_pay"),
    ).one()

    # Returns are work too, and they were the one queue the dashboard and the
    # sidebar could not see — so a damage claim sat unanswered unless somebody
    # happened to open the screen.
    returns = db.query(
        func.count(models.ReturnRequest.id)
        .filter(models.ReturnRequest.status == "requested")
        .label("to_decide"),
        func.count(models.ReturnRequest.id)
        .filter(models.ReturnRequest.status == "approved")
        .label("to_refund"),
    ).one()

    return {
        "orders_to_fulfil": orders.to_fulfil,
        "cash_to_collect": orders.cash_to_collect,
        "buyback_to_review": buyback.buyback_to_review,
        "buyback_to_pay": buyback.buyback_to_pay,
        "returns_to_decide": returns.to_decide,
        "returns_to_refund": returns.to_refund,
    }


@router.get("/settings", response_model=StoreSettingsRead)
def read_store_settings(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """What the shop charges, and which of it somebody chose.

    Returns both the effective values and the overrides, so the screen can show a
    deployment default as a default rather than as a decision — the difference
    matters when you are deciding whether 8% tax was meant.
    """
    row = db.query(models.StoreSettings).first()
    effective = store_settings.current()
    return StoreSettingsRead(
        effective={f: getattr(effective, f) for f in store_settings.EDITABLE_FIELDS},
        overrides=(
            {}
            if row is None
            else {
                f: getattr(row, f)
                for f in store_settings.EDITABLE_FIELDS
                if getattr(row, f) is not None
            }
        ),
        updated_at=row.updated_at if row else None,
        updated_by=row.updated_by if row else None,
    )


@router.put("/settings", response_model=StoreSettingsRead)
def update_store_settings(
    payload: StoreSettingsUpdate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Change the commerce rules.

    A field omitted from the request is left as it was; a field sent as `null`
    clears the override and hands that setting back to the environment. That is
    what makes "reset to default" possible without anyone having to remember what
    the default was.

    `extra="forbid"` on the schema is the guard that matters: a request naming a
    setting this endpoint does not own — a key, a database URL — is a 422 rather
    than something quietly ignored.
    """
    # `exclude_unset` is the whole distinction: sent-as-null means clear, absent
    # means leave alone, and without this they would be the same request.
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return read_store_settings(db=db, current_user=current_user)

    row = db.query(models.StoreSettings).with_for_update().first()
    if row is None:
        row = models.StoreSettings()
        db.add(row)

    for field, value in changes.items():
        setattr(row, field, value)
    row.updated_by = getattr(current_user, "email", None)
    db.commit()

    # The writer must see its own change, whatever the cache TTL says.
    store_settings.invalidate()
    return read_store_settings(db=db, current_user=current_user)


@router.get("/notifications", response_model=List[NotificationRead])
def list_admin_notifications(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )

@router.patch("/notifications/{notification_id}/read", response_model=NotificationRead)
def mark_admin_notification_read(
    notification_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    n = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.add(n)
    db.commit()
    db.refresh(n)
    return n

@router.post("/notifications/read-all")
def read_all_admin_notifications(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id, models.Notification.is_read == False  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"message": "ok"}

# ----- coupons -----

@router.get("/coupons", response_model=List[AdminCouponRead])
def list_coupons(
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Every code, with what it cost and what it brought in.

    `times_redeemed` was the only figure here, and it answers the wrong question.
    A code used forty times looks like a success whether it drew ₹64,000 of
    orders or gave away more than it earned; the counter cannot tell those apart,
    and the counter was all there was.

    Paid orders only. A checkout that quoted a discount and was never paid for is
    not money the shop gave away, and counting it would overstate the cost of
    every code on the screen.
    """
    coupons = db.query(models.Coupon).order_by(models.Coupon.created_at.desc()).all()
    if not coupons:
        return []

    # One grouped query for the whole list. Per-coupon totals would be a round
    # trip each, on a screen that exists to be compared across rows.
    totals = dict(
        (row.coupon_id, row)
        for row in db.query(
            models.CouponRedemption.coupon_id.label("coupon_id"),
            func.coalesce(func.sum(models.CouponRedemption.amount), 0).label("given"),
            func.coalesce(func.sum(models.Order.total), 0).label("revenue"),
        )
        .join(models.Order, models.Order.id == models.CouponRedemption.order_id)
        .filter(models.Order.payment_status == PAYMENT_STATUS_PAID)
        .group_by(models.CouponRedemption.coupon_id)
        .all()
    )

    result: List[AdminCouponRead] = []
    for c in coupons:
        row = totals.get(c.id)
        result.append(
            AdminCouponRead.model_validate(
                {
                    **{k: getattr(c, k) for k in AdminCouponRead.model_fields if hasattr(c, k)},
                    "discount_given": row.given if row else Decimal("0"),
                    "revenue": row.revenue if row else Decimal("0"),
                }
            )
        )
    return result

@router.post("/coupons", response_model=AdminCouponRead, status_code=201)
def create_coupon(
    payload: AdminCouponCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    code = payload.code.strip().upper()
    if db.query(models.Coupon).filter(models.Coupon.code == code).first():
        raise HTTPException(status_code=400, detail="That code already exists")

    # A percentage code without a ceiling can give away an unbounded amount on a
    # large order, so require one.
    if payload.discount_type == "percent":
        if payload.value > 100:
            raise HTTPException(status_code=400, detail="A percentage cannot exceed 100")
        if payload.max_discount is None:
            raise HTTPException(
                status_code=400,
                detail="Percentage codes need a max_discount cap",
            )

    coupon = models.Coupon(**{**payload.model_dump(), "code": code})
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon

@router.delete("/coupons/{coupon_id}", status_code=204)
def delete_coupon(
    coupon_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    coupon = db.query(models.Coupon).filter(models.Coupon.id == coupon_id).first()
    if coupon is None:
        raise HTTPException(status_code=404, detail="Coupon not found")

    # Deactivate rather than delete once it has been used: the redemption rows
    # (and the orders that reference them) are financial history.
    if int(coupon.times_redeemed or 0) > 0:
        coupon.is_active = False
        db.commit()
        return Response(status_code=204)

    db.delete(coupon)
    db.commit()
    return Response(status_code=204)

@router.get("/sales-trend")
def sales_trend(
    days: int = 7,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Units sold per day for the last `days` days.

    Replaces a hardcoded bar chart on the dashboard: a chart that always shows the
    same shape regardless of the business is worse than no chart, because it looks
    like information.

    Cancelled orders are excluded — those units went back into stock.
    """
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")

    rows = (
        db.query(
            func.date(models.Order.created_at).label("day"),
            func.coalesce(func.sum(models.OrderItem.quantity), 0).label("units"),
        )
        .join(models.OrderItem, models.OrderItem.order_id == models.Order.id)
        .filter(models.Order.status != "cancelled")
        .filter(models.Order.created_at >= func.current_date() - days + 1)
        .group_by(func.date(models.Order.created_at))
        .all()
    )
    by_day = {str(r.day): int(r.units) for r in rows}

    # Emit every day in the window, including the zeros, so the chart has a
    # continuous axis instead of silently collapsing quiet days.
    from datetime import date, timedelta

    today = date.today()
    series = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        series.append({
            "date": day.isoformat(),
            "label": day.strftime("%a"),
            "units": by_day.get(day.isoformat(), 0),
        })

    return {"days": days, "series": series, "total": sum(p["units"] for p in series)}

# -------- Buyback: the shop's half of buying a used book --------
#
# Three steps on purpose, each with its own endpoint, because each is a different
# decision made at a different time:
#
#   approve   — do we want it at all, before the seller posts it
#   receive   — grade what actually arrived, which may re-price the offer
#   pay       — move the money and put the copy on the shelf
#
# Folding grading into payout would mean paying for a condition nobody checked.

def _buyback_or_404(db: Session, request_id: UUID, *, lock: bool = False):
    query = db.query(models.BuybackRequest).filter(models.BuybackRequest.id == request_id)
    if lock:
        query = query.with_for_update()
    request = query.first()
    if request is None:
        raise HTTPException(status_code=404, detail="Buyback request not found")
    return request

def _seller_cover(request) -> Optional[str]:
    """The seller's photograph of the cover, if they took one.

    Prefers the one labelled `cover` over whatever happens to be first: a seller
    who photographed the spine and then the cover should not have the spine end
    up as the shop listing's artwork.
    """
    photos = list(request.photos or [])
    if not photos:
        return None
    cover = next((p for p in photos if p.kind == "cover"), None)
    return (cover or photos[0]).url


def _to_admin_read(db: Session, request, sellers: dict | None = None) -> AdminBuybackRead:
    """One request, with the seller's name attached.

    `sellers` is an optional id -> user map for the list endpoint. Without it this
    looks up one user per request, which is fine for a single row and ruinous for
    a page of them: the queue endpoint was issuing 159 queries for 158 rows and
    taking 29 seconds against a remote database, so the screen simply sat on its
    loader.
    """
    if sellers is not None:
        seller = sellers.get(request.user_id)
    else:
        seller = db.query(models.User).filter(models.User.id == request.user_id).first()
    return AdminBuybackRead(
        **{c.name: getattr(request, c.name) for c in request.__table__.columns},
        # Explicit, because the spread above walks *columns* and photos are a
        # relationship — left out, the schema's `[]` default would quietly render
        # every request as having no photographs.
        photos=list(request.photos or []),
        seller_email=seller.email if seller else None,
        seller_name=(seller.full_name or seller.username) if seller else None,
    )

@router.get("/buyback", response_model=AdminBuybackPage)
def list_buyback_requests(
    status_filter: Optional[str] = None,
    lens: str = "all",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """The buyback queue, a page at a time. Oldest first — longest wait served first.

    This was `.all()`: 159 rows and 123 KB on a screen somebody opens every
    morning, growing with every request the shop has ever seen. Cancelled ones
    never leave, and this account already has 148 of them.

    The lens counts come back with the page for the same reason the orders screen
    needs them: the tabs answer "how much work is waiting", which a single page
    cannot know — and deriving them from the rows on screen is a bug that looks
    right until the queue outgrows one page.
    """
    base = db.query(models.BuybackRequest)
    if status_filter:
        if status_filter not in BUYBACK_STATUSES:
            raise HTTPException(status_code=400, detail=f"Unknown status {status_filter!r}")
        base = base.filter(models.BuybackRequest.status == status_filter)

    # Every tab in one round trip, rather than one COUNT each.
    approved = models.BuybackRequest.status == "approved"
    counts_row = base.with_entities(
        func.count(models.BuybackRequest.id)
        .filter(models.BuybackRequest.status == "submitted").label("review"),
        # Approved and not yet posted, versus posted and in transit — the whole
        # reason the seller's dispatch is recorded at all.
        func.count(models.BuybackRequest.id)
        .filter(approved, models.BuybackRequest.dispatched_at.is_(None)).label("arriving"),
        func.count(models.BuybackRequest.id)
        .filter(approved, models.BuybackRequest.dispatched_at.isnot(None)).label("intransit"),
        func.count(models.BuybackRequest.id)
        .filter(models.BuybackRequest.status == "received").label("topay"),
        func.count(models.BuybackRequest.id).label("all"),
    ).one()
    counts = {
        "review": counts_row.review, "arriving": counts_row.arriving,
        "intransit": counts_row.intransit, "topay": counts_row.topay, "all": counts_row.all,
    }

    lens_filters = {
        "review": (models.BuybackRequest.status == "submitted",),
        "arriving": (approved, models.BuybackRequest.dispatched_at.is_(None)),
        "intransit": (approved, models.BuybackRequest.dispatched_at.isnot(None)),
        "topay": (models.BuybackRequest.status == "received",),
    }
    query = base.filter(*lens_filters[lens]) if lens in lens_filters else base
    total = counts.get(lens, counts["all"])

    rows = (
        # Photographs are read for every row — the whole point of the queue is to
        # look at them — so loading them lazily is one round trip per request.
        query.options(selectinload(models.BuybackRequest.photos))
        .order_by(models.BuybackRequest.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # One query for every seller on the page, rather than one per row.
    seller_ids = {r.user_id for r in rows if r.user_id}
    sellers = (
        {u.id: u for u in db.query(models.User).filter(models.User.id.in_(seller_ids)).all()}
        if seller_ids
        else {}
    )
    return AdminBuybackPage(
        items=[_to_admin_read(db, r, sellers) for r in rows],
        meta=PageMeta.from_total(page=page, page_size=page_size, total=total),
        counts=counts,
    )

@router.post("/buyback/{request_id}/decision", response_model=AdminBuybackRead)
def decide_buyback(
    request_id: UUID,
    payload: AdminBuybackDecision,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Accept or turn down a submitted offer, before the seller posts anything."""
    request = _buyback_or_404(db, request_id, lock=True)

    if request.status != "submitted":
        raise HTTPException(
            status_code=409,
            detail=f"This request is {request.status}; only a submitted one can be decided.",
        )

    now = datetime.now(timezone.utc)
    if payload.approve:
        request.status = "approved"
        request.approved_at = now
        body = (
            f'We would like to buy "{request.title}". Offer: {request.quoted_amount}. '
            "Send it in and we will confirm the condition when it arrives."
        )
        title = "Buyback approved"
    else:
        request.status = "rejected"
        request.rejection_reason = payload.rejection_reason
        request.closed_at = now
        body = f'We cannot buy "{request.title}". Reason: {payload.rejection_reason}'
        title = "Buyback declined"

    if payload.admin_note:
        request.admin_note = payload.admin_note

    db.add(models.Notification(user_id=request.user_id, title=title, body=body, is_read=False))
    db.commit()
    db.refresh(request)
    return _to_admin_read(db, request)

@router.post("/buyback/{request_id}/receive", response_model=AdminBuybackRead)
def receive_buyback(
    request_id: UUID,
    payload: AdminBuybackReceive,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Record what actually arrived, and re-price if it graded differently.

    Kept separate from payout so the shop never pays for a condition nobody looked
    at. A downgrade lowers the offer, and the seller is told the new figure before
    any money moves.
    """
    request = _buyback_or_404(db, request_id, lock=True)

    if request.status != "approved":
        raise HTTPException(
            status_code=409,
            detail=f"This request is {request.status}; only an approved one can be received.",
        )

    try:
        recomputed = buyback_pricing.quote(
            request.listed_price, payload.received_condition, request.quantity
        )
    except buyback_pricing.BuybackError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    final = money(payload.override_amount) if payload.override_amount is not None else recomputed

    request.status = "received"
    request.received_condition = payload.received_condition
    request.final_amount = final
    request.received_at = datetime.now(timezone.utc)
    if payload.admin_note:
        request.admin_note = payload.admin_note

    if payload.received_condition != request.condition:
        body = (
            f'"{request.title}" arrived — we graded it '
            f"{buyback_pricing.CONDITION_LABELS[payload.received_condition]} rather than "
            f"{buyback_pricing.CONDITION_LABELS[request.condition]}, so the amount is {final}."
        )
    else:
        body = f'"{request.title}" arrived and matches the condition you described. Paying {final}.'

    db.add(models.Notification(
        user_id=request.user_id, title="Book received", body=body, is_read=False,
    ))
    db.commit()
    db.refresh(request)
    return _to_admin_read(db, request)

@router.post("/buyback/{request_id}/pay", response_model=AdminBuybackRead)
def pay_buyback(
    request_id: UUID,
    payload: AdminBuybackPayout,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Pay the seller and put the copy on the shelf, in one transaction.

    One transaction because these two must not come apart: stock the shop can sell
    without having paid for it, or a payment for a book that never became sellable,
    are both wrong and both invisible until someone reconciles by hand.

    The used copy is a `books` row of its own under the catalogue title, so the
    cart, stock locking and checkout treat it exactly like anything else on sale.
    """
    request = _buyback_or_404(db, request_id, lock=True)

    if request.status == "paid":
        # Idempotent: a double-click must not pay twice or double the stock.
        return _to_admin_read(db, request)
    if request.status != "received":
        raise HTTPException(
            status_code=409,
            detail=f"This request is {request.status}; receive the book before paying for it.",
        )

    amount = money(request.final_amount if request.final_amount is not None else request.quoted_amount)
    condition = request.received_condition or request.condition

    # Which catalogue title the copy goes under. The seller's own choice when they
    # picked from the catalogue; otherwise the admin has to say.
    parent_id = payload.parent_book_id or request.book_id
    if parent_id is None:
        raise HTTPException(
            status_code=400,
            detail="This book was entered by hand. Choose the catalogue title to file the "
                   "used copy under (create one first if it does not exist).",
        )

    parent = db.query(models.Book).filter(models.Book.id == parent_id).first()
    if parent is None:
        raise HTTPException(status_code=404, detail="That catalogue title does not exist.")
    if parent.condition != "new":
        raise HTTPException(
            status_code=400,
            detail="File used copies under the main listing, not under another used copy.",
        )

    if request.payout_method == "bank" and not (payload.payout_reference or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Enter the transfer reference (UTR) — it is the record that the money moved.",
        )

    shelf_price = (
        money(payload.resale_price)
        if payload.resale_price is not None
        else buyback_pricing.resale_price(request.listed_price, condition)
    )

    # One row per condition per title, so a second "Good" copy adds to the existing
    # line rather than creating a duplicate listing next to it.
    used_copy = (
        db.query(models.Book)
        .filter(
            models.Book.parent_book_id == parent.id,
            models.Book.condition == condition,
        )
        .with_for_update()
        .first()
    )

    if used_copy is None:
        used_copy = models.Book(
            title=parent.title,
            author=parent.author,
            description=parent.description,
            price=shelf_price,
            stock=request.quantity,
            format=parent.format,
            rating=parent.rating,
            rating_count=parent.rating_count,
            # The seller's own photograph of the cover, falling back to the
            # publisher's artwork. Inheriting the parent's unconditionally meant a
            # buyer looking at a second-hand copy was shown a pristine stock image
            # of a book that is by definition not pristine — a small lie sitting
            # exactly where the trust barrier to buying used is highest.
            cover_image=_seller_cover(request) or parent.cover_image,
            category_id=parent.category_id,
            condition=condition,
            parent_book_id=parent.id,
            source_buyback_id=request.id,
        )
        db.add(used_copy)
    else:
        used_copy.stock = int(used_copy.stock or 0) + int(request.quantity)
        # Later arrivals do not silently re-price the shelf; an explicit override does.
        if payload.resale_price is not None:
            used_copy.price = shelf_price

    # In this transaction, so "copy on the shelf and nobody told" cannot happen.
    # Flushed first because the session is `autoflush=False` and a brand-new
    # `used_copy` would otherwise have no price for the max_price comparison.
    db.flush()
    used_alerts.notify_for_used_copy(db, used_copy)

    if request.payout_method == "wallet":
        entry = wallet.credit(
            db,
            request.user_id,
            amount,
            kind=wallet.KIND_BUYBACK_PAYOUT,
            note=f'Store credit for "{request.title}"',
            buyback_request_id=request.id,
        )
        db.flush()  # so the ledger row has an id to reference
        request.payout_reference = str(entry.id)
        payout_line = f"{amount} has been added to your BookVuk credit."
    else:
        request.payout_reference = payload.payout_reference.strip()
        payout_line = f"{amount} has been sent to {request.payout_upi} (ref {request.payout_reference})."

    request.status = "paid"
    request.final_amount = amount
    request.paid_at = datetime.now(timezone.utc)
    request.closed_at = request.paid_at

    db.add(models.Notification(
        user_id=request.user_id,
        title="Buyback paid",
        body=f'Thanks for "{request.title}". {payout_line}',
        is_read=False,
    ))

    db.commit()
    db.refresh(request)
    return _to_admin_read(db, request)

# -------- Demand: what people are waiting for --------

@router.get("/inventory/demand")
def inventory_demand(
    limit: int = 20,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Out-of-stock titles ranked by how many people are waiting for them.

    Restocking blind means guessing. A wishlist entry against a book with no stock
    is the clearest demand signal the shop has: somebody wanted it enough to save it
    while unable to buy it. Ordering by that turns restocking into a queue rather
    than a hunch — and every one of those people is already subscribed to the
    back-in-stock notice, so the restock pays for itself immediately.

    Used copies are excluded: they are variants of a listed title, and the thing to
    reorder is the title.
    """
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")

    waiting = func.count(models.Wishlist.id).label("waiting")

    rows = (
        db.query(
            models.Book.id,
            models.Book.title,
            models.Book.author,
            models.Book.price,
            models.Book.stock,
            models.Book.cover_image,
            waiting,
        )
        .join(models.Wishlist, models.Wishlist.book_id == models.Book.id)
        .filter(
            models.Book.stock <= 0,
            models.Book.parent_book_id.is_(None),
        )
        .group_by(models.Book.id)
        .order_by(waiting.desc(), models.Book.title.asc())
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": str(r.id),
                "title": r.title,
                "author": r.author,
                "price": r.price,
                "stock": r.stock,
                "cover_image": r.cover_image,
                "waiting": int(r.waiting),
            }
            for r in rows
        ],
        # The people who will be told the moment any of this is restocked.
        "total_waiting": sum(int(r.waiting) for r in rows),
    }


# ---------------------------------------------------------------------------
# Returns
# ---------------------------------------------------------------------------

def _one_customer(db_session: Session, user_id) -> dict:
    """The id -> user map `_return_read` wants, for a single row."""
    found = db_session.query(models.User).filter(models.User.id == user_id).first()
    return {user_id: found} if found else {}


def _one_order(db_session: Session, order_id) -> dict:
    """The id -> order map `_return_read` wants, for a single row."""
    found = db_session.query(models.Order).filter(models.Order.id == order_id).first()
    return {order_id: found} if found else {}


def _return_read(request, customers: dict | None = None, orders: dict | None = None) -> AdminReturnRead:
    """One claim, with who made it and what the line was worth.

    `line_total` is carried so the admin can see what a full refund means without
    opening the order — which is the number the decision actually turns on.
    """
    customer = (customers or {}).get(request.user_id)
    order = (orders or {}).get(request.order_id)
    item = request.item
    return AdminReturnRead(
        **{c.name: getattr(request, c.name) for c in request.__table__.columns},
        photos=list(request.photos or []),
        book_title=item.title_snapshot if item else None,
        line_total=(
            money(item.unit_price_snapshot) * request.quantity if item else None
        ),
        customer_name=(customer.full_name or customer.username) if customer else None,
        customer_email=customer.email if customer else None,
        order_payment_status=order.payment_status if order else None,
        order_payment_method=order.payment_method if order else None,
    )


@router.get("/returns", response_model=List[AdminReturnRead])
def list_returns(
    status_filter: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """The returns queue. Oldest first — whoever has waited longest is served first."""
    if status_filter and status_filter not in RETURN_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown status {status_filter!r}")

    query = db.query(models.ReturnRequest).options(
        # Both are read for every row, so lazily they are two round trips per claim.
        selectinload(models.ReturnRequest.photos),
        selectinload(models.ReturnRequest.item),
    )
    if status_filter:
        query = query.filter(models.ReturnRequest.status == status_filter)

    rows = query.order_by(models.ReturnRequest.created_at.asc()).all()

    customer_ids = {r.user_id for r in rows if r.user_id}
    customers = (
        {u.id: u for u in db.query(models.User).filter(models.User.id.in_(customer_ids)).all()}
        if customer_ids
        else {}
    )
    # One query for every order on the page. Whether the order was paid decides
    # whether a refund is even allowed, so the queue has to carry it — and a
    # lookup per row would be the same N+1 the buyback queue was fixed for.
    order_ids = {r.order_id for r in rows if r.order_id}
    orders = (
        {o.id: o for o in db.query(models.Order).filter(models.Order.id.in_(order_ids)).all()}
        if order_ids
        else {}
    )
    return [_return_read(r, customers, orders) for r in rows]


@router.post("/returns/{request_id}/decision", response_model=AdminReturnRead)
def decide_return(
    request_id: UUID,
    payload: AdminReturnDecision,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Accept or refuse a claim. Deliberately moves no money.

    Accepting and paying are separate events that can be hours apart, and folding
    them together would make "approved, not yet refunded" unrepresentable — which
    is exactly the state a customer chases.
    """
    request = (
        db.query(models.ReturnRequest)
        .filter(models.ReturnRequest.id == request_id)
        .with_for_update()
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Return not found")
    if request.status != "requested":
        raise HTTPException(
            status_code=409,
            detail=f"This return is already {request.status}.",
        )

    request.status = "approved" if payload.approve else "rejected"
    request.rejection_reason = None if payload.approve else payload.rejection_reason
    request.admin_note = payload.admin_note
    request.decided_at = datetime.now(timezone.utc)

    db.add(
        models.Notification(
            user_id=request.user_id,
            title="Return " + ("approved" if payload.approve else "declined"),
            body=(
                "We have accepted your return and will refund it shortly."
                if payload.approve
                else f"We could not accept this return: {payload.rejection_reason}"
            ),
            is_read=False,
        )
    )
    db.commit()
    db.refresh(request)
    return _return_read(
        request, _one_customer(db, request.user_id), _one_order(db, request.order_id)
    )


@router.post("/returns/{request_id}/resolve", response_model=AdminReturnRead)
def resolve_return(
    request_id: UUID,
    payload: AdminReturnResolve,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Pay an approved claim, and record how.

    Store credit is issued here and now, because it is the shop's own ledger and
    there is nothing to wait for. A refund to the original card is *recorded*
    rather than performed: the gateway refund for an order is already driven by
    `core/fulfilment.py`, and a second path that also moves money through
    Razorpay would be a second place to get double refunds wrong.
    """
    request = (
        db.query(models.ReturnRequest)
        .filter(models.ReturnRequest.id == request_id)
        .with_for_update()
        .first()
    )
    if request is None:
        raise HTTPException(status_code=404, detail="Return not found")
    if request.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Only an approved return can be resolved.",
        )

    item = db.query(models.OrderItem).filter(models.OrderItem.id == request.order_item_id).first()
    # Defaults to what that line was actually charged, which is the answer in
    # almost every case; an explicit amount covers partial refunds and goodwill.
    full_line = money(item.unit_price_snapshot) * request.quantity if item else Decimal("0")
    amount = money(payload.amount) if payload.amount is not None else full_line

    #: Resolutions that move money. The rest — a replacement, or a goodwill
    #: close — settle the claim without any.
    pays_out = payload.resolution in ("wallet", "source")

    if pays_out and amount <= 0:
        raise HTTPException(status_code=400, detail="A refund of zero is not a refund.")

    if pays_out:
        # An order can reach `delivered` without ever being paid for — a cash
        # order nobody collected, or an online one the gateway never confirmed.
        # Refunding one sends out money that never came in, and the screen gave
        # an admin nothing to notice it with. A replacement or a goodwill close
        # is still allowed: neither moves money.
        order = db.query(models.Order).filter(models.Order.id == request.order_id).first()
        if order is not None and order.payment_status != PAYMENT_STATUS_PAID:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This order was never paid for "
                    f"(payment is {order.payment_status}), so there is nothing to refund. "
                    "Send a replacement, or close it with nothing owed."
                ),
            )

    if payload.resolution == "wallet" and amount > 0:
        wallet.credit(
            db,
            request.user_id,
            amount,
            kind=wallet.KIND_ORDER_REFUND,
            note=f'Return refund for "{item.title_snapshot if item else "an item"}"',
            order_id=request.order_id,
        )

    request.status = "refunded"
    request.resolution = payload.resolution
    # Only what actually moved. Recording the line total against a replacement
    # told the customer "₹629 — a replacement is on its way", promising both the
    # money and the book, and made every total that sums this column count
    # replacements as cash paid out.
    request.refund_amount = amount if pays_out else None
    request.admin_note = payload.admin_note or request.admin_note
    request.resolved_at = datetime.now(timezone.utc)

    db.add(
        models.Notification(
            user_id=request.user_id,
            title="Return resolved",
            body={
                "wallet": f"₹{amount} has been added to your store credit.",
                "source": f"₹{amount} is on its way back to how you paid.",
                "replacement": "A replacement copy is on its way.",
                "none": "Your return has been closed.",
            }[payload.resolution],
            is_read=False,
        )
    )
    db.commit()
    db.refresh(request)
    return _return_read(
        request, _one_customer(db, request.user_id), _one_order(db, request.order_id)
    )


# ---------------------------------------------------------------------------
# Demand — what people wanted and the shop could not sell them
# ---------------------------------------------------------------------------

@router.get("/demand/used")
def used_copy_demand(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Titles people are waiting for a *second-hand* copy of.

    This is the buyback shopping list. The used-book side has stock for 2 of 200
    titles, and the reason it stays that way is that nothing told the shop which
    titles to go and pay a seller for. Everyone counted here has said they want a
    cheap copy of a specific book and will be notified the moment one is shelved.
    """
    rows = (
        db.query(
            models.Book.id,
            models.Book.title,
            models.Book.author,
            models.Book.price,
            func.count(models.UsedCopyAlert.id).label("waiting"),
            func.min(models.UsedCopyAlert.max_price).label("lowest_ceiling"),
        )
        .join(models.UsedCopyAlert, models.UsedCopyAlert.book_id == models.Book.id)
        .filter(models.UsedCopyAlert.notified_at.is_(None))
        .group_by(models.Book.id, models.Book.title, models.Book.author, models.Book.price)
        .order_by(func.count(models.UsedCopyAlert.id).desc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": str(r.id),
                "title": r.title,
                "author": r.author,
                "new_price": r.price,
                "waiting": int(r.waiting),
                # What the keenest buyer capped themselves at, so the shop knows
                # what it can pay and still sell.
                "lowest_ceiling": r.lowest_ceiling,
            }
            for r in rows
        ],
        "total_waiting": sum(int(r.waiting) for r in rows),
    }


@router.get("/demand/searches")
def search_misses(
    limit: int = Query(30, ge=1, le=200),
    include_resolved: bool = False,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """What people searched for and the shop does not stock.

    Every one of these used to be discarded. A customer who searched for a title
    has told you what to buy in the plainest terms there are, and the count says
    how many of them did.
    """
    query = db.query(models.SearchMiss)
    if not include_resolved:
        query = query.filter(models.SearchMiss.resolved_at.is_(None))
    rows = (
        query.order_by(models.SearchMiss.hits.desc(), models.SearchMiss.last_seen.desc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": str(r.id),
                "term": r.term,
                "hits": r.hits,
                "first_seen": r.first_seen,
                "last_seen": r.last_seen,
                "resolved_at": r.resolved_at,
            }
            for r in rows
        ]
    }


@router.post("/demand/searches/{miss_id}/resolve")
def resolve_search_miss(
    miss_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    """Mark a term dealt with — stocked, or decided against.

    The list is a to-do, not an archive. Without this it only ever grows and
    stops being read.
    """
    row = db.query(models.SearchMiss).filter(models.SearchMiss.id == miss_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    row.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
