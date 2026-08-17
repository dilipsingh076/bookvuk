from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pathlib import Path
from sqlalchemy import func, or_
from sqlalchemy.sql.sqltypes import String
from app.database.dep import require_role
from app.schema.book import BookResponse, BookCreate
from app.schema.admin import (
    AdminAuthorCreate,
    AdminAuthorRead,
    AdminAuthorUpdate,
    AdminDashboardOverviewCard,
    AdminInventoryRestockRequest,
    AdminOrderRead,
    AdminOrderStatusUpdate,
)
from app.schema.pagination import PaginatedBooks, PageMeta
from sqlalchemy.orm import Session
from app.database import db, models
from app.schema.category import CategoryCreate, CategoryResponse
from app.schema.notification import NotificationRead


router = APIRouter(prefix="/api/admin", tags=["Admin"])

static_books_dir = Path(__file__).resolve().parents[3] / "static" / "books"
static_books_dir.mkdir(parents=True, exist_ok=True)


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

    filename = (file.filename or "").lower()
    if not (filename.endswith(".jpg") or filename.endswith(".jpeg") or filename.endswith(".png") or filename.endswith(".webp")):
        raise HTTPException(status_code=400, detail="Only .jpg/.jpeg/.png/.webp allowed")

    ext = "." + filename.split(".")[-1]
    out_name = f"{book_id}{ext}"
    out_path = static_books_dir / out_name

    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    out_path.write_bytes(data)

    book.cover_image = f"/static/books/{out_name}"
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.delete("/books/{book_id}", status_code=204)
def delete_book(book_id: UUID, db: Session = Depends(db.get_db), current_user=Depends(require_role("admin"))):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()
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
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book.stock = int(book.stock or 0) + int(payload.add_stock)
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.get("/orders", response_model=List[AdminOrderRead])
def list_orders(
    q: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    query = db.query(models.Order).join(models.User, models.User.id == models.Order.user_id)
    if status:
        query = query.filter(models.Order.status == status)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                func.cast(models.Order.id, String).ilike(term),
                models.User.email.ilike(term),
                models.User.username.ilike(term),
                models.User.full_name.ilike(term),
                models.Order.status.ilike(term),
            )
        )
    rows = query.order_by(models.Order.created_at.desc()).all()

    result: List[AdminOrderRead] = []
    for o in rows:
        user = db.query(models.User).filter(models.User.id == o.user_id).first()
        customer_name = (user.full_name or user.username) if user else "Customer"
        customer_email = user.email if user else ""
        result.append(
            AdminOrderRead(
                id=o.id,
                createdAt=o.created_at,
                status=o.status,
                userId=o.user_id,
                customerName=customer_name,
                customerEmail=customer_email,
                subtotal=o.subtotal,
                shipping=o.shipping,
                tax=o.tax,
                total=o.total,
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
        )
    return result


@router.get("/orders/{order_id}", response_model=AdminOrderRead)
def get_order(
    order_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    o = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    user = db.query(models.User).filter(models.User.id == o.user_id).first()
    customer_name = (user.full_name or user.username) if user else "Customer"
    customer_email = user.email if user else ""
    return AdminOrderRead(
        id=o.id,
        createdAt=o.created_at,
        status=o.status,
        userId=o.user_id,
        customerName=customer_name,
        customerEmail=customer_email,
        subtotal=o.subtotal,
        shipping=o.shipping,
        tax=o.tax,
        total=o.total,
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


@router.put("/orders/{order_id}/status", response_model=AdminOrderRead)
def update_order_status(
    order_id: UUID,
    payload: AdminOrderStatusUpdate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("admin")),
):
    o = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    prev_status = o.status
    o.status = payload.status
    db.add(o)
    db.commit()
    db.refresh(o)
    user = db.query(models.User).filter(models.User.id == o.user_id).first()
    customer_name = (user.full_name or user.username) if user else "Customer"
    customer_email = user.email if user else ""

    if user:
        db.add(
            models.Notification(
                user_id=user.id,
                title="Order update",
                body=f"Your order {str(o.id)} status changed from {prev_status} to {o.status}.",
                is_read=False,
            )
        )
        db.commit()

    return AdminOrderRead(
        id=o.id,
        createdAt=o.created_at,
        status=o.status,
        userId=o.user_id,
        customerName=customer_name,
        customerEmail=customer_email,
        subtotal=o.subtotal,
        shipping=o.shipping,
        tax=o.tax,
        total=o.total,
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
