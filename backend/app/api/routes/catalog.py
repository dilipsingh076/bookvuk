from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import models, db
from app.schema.book import BookResponse
from app.schema.pagination import PaginatedBooks, PageMeta
from app.schema.category import CategoryResponse

router = APIRouter(
    prefix="/api/catalog",
    tags=["Catalog"]
)


@router.get("/books", response_model=List[BookResponse])
def get_books(
    db: Session = Depends(db.get_db),
):
    books = db.query(models.Book).all()
    return books


@router.get("/categories", response_model=List[CategoryResponse])
def get_public_categories(db: Session = Depends(db.get_db)):
    return db.query(models.Category).order_by(models.Category.name.asc()).all()


@router.get("/books/paged", response_model=PaginatedBooks)
def get_books_paged(
    page: int = 1,
    page_size: int = 8,
    q: Optional[str] = None,
    category_id: Optional[UUID] = None,
    sort: str = "newest",
    db: Session = Depends(db.get_db),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 50:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 50")

    query = db.query(models.Book)

    if category_id is not None:
        query = query.filter(models.Book.category_id == category_id)

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(or_(models.Book.title.ilike(term), models.Book.author.ilike(term)))

    if sort == "newest":
        query = query.order_by(models.Book.created_at.desc())
    elif sort == "price_asc":
        query = query.order_by(models.Book.price.asc())
    elif sort == "price_desc":
        query = query.order_by(models.Book.price.desc())
    elif sort == "rating_desc":
        query = query.order_by(models.Book.rating.desc(), models.Book.rating_count.desc())
    elif sort == "title_asc":
        query = query.order_by(models.Book.title.asc())
    else:
        raise HTTPException(status_code=400, detail="Invalid sort")

    total = query.count()
    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()

    return PaginatedBooks(
        items=rows,
        meta=PageMeta.from_total(page=page, page_size=page_size, total=total),
    )


@router.get("/books/{book_id}", response_model=BookResponse)
def get_book_by_Id(book_id: UUID, db: Session = Depends(db.get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with id: {book_id} was not found!",
        )
    
    return book