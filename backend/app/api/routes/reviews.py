"""Book reviews.

Reading is public: reviews are a big part of why a shopper decides to buy, and
hiding them behind sign-in wastes them. Writing requires an account.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import db, models
from app.database.dep import require_role
from app.schema.commerce import ReviewCreate, ReviewRead, ReviewSummary

router = APIRouter(prefix="/api/catalog/books", tags=["Reviews"])


def recompute_book_rating(db_session: Session, book_id: UUID) -> None:
    """Refresh the denormalised rating on `books` from the review rows.

    The catalogue sorts and filters on books.rating, so it has to stay in step
    with the reviews it summarises.
    """
    aggregate = (
        db_session.query(func.avg(models.Review.rating), func.count(models.Review.id))
        .filter(models.Review.book_id == book_id)
        .one()
    )
    average, count = aggregate[0], aggregate[1] or 0

    book = db_session.query(models.Book).filter(models.Book.id == book_id).first()
    if book is None:
        return

    book.rating = round(float(average), 2) if count else 0.0
    book.rating_count = int(count)


def _verified_buyer_ids(db_session: Session, book_id: UUID, reviewer_ids: set) -> set:
    """Which of these reviewers actually received this book from the shop.

    One query for the whole page rather than one per review — a product page can
    carry dozens, and a lookup each would make the badge more expensive than the
    reviews it labels.

    `delivered` and not merely paid: a review written while the parcel is still in
    transit is a review of a book the person has not read. The used copy counts
    too — `parent_book_id` — because somebody who bought the second-hand edition
    read the same book, and that is what a review is about.
    """
    if not reviewer_ids:
        return set()

    editions = (
        db_session.query(models.Book.id)
        .filter((models.Book.id == book_id) | (models.Book.parent_book_id == book_id))
        .subquery()
    )

    rows = (
        db_session.query(models.Order.user_id)
        .join(models.OrderItem, models.OrderItem.order_id == models.Order.id)
        .filter(
            models.Order.user_id.in_(reviewer_ids),
            models.Order.status == "delivered",
            models.OrderItem.book_id.in_(select(editions.c.id)),
        )
        .distinct()
        .all()
    )
    return {row.user_id for row in rows}


def _to_read(
    review: models.Review,
    *,
    current_user_id: Optional[UUID],
    verified_ids: Optional[set] = None,
) -> ReviewRead:
    user = review.user
    # Show a first name only: a full name plus a purchase history is more than a
    # reviewer expects to publish.
    display = "Reader"
    if user is not None:
        display = (user.full_name or user.username or "Reader").split(" ")[0]

    return ReviewRead(
        id=review.id,
        rating=review.rating,
        title=review.title,
        body=review.body,
        author_name=display,
        is_mine=current_user_id is not None and review.user_id == current_user_id,
        verified_purchase=bool(verified_ids and review.user_id in verified_ids),
        created_at=review.created_at,
    )


@router.get("/{book_id}/reviews", response_model=ReviewSummary)
def list_reviews(book_id: UUID, db: Session = Depends(db.get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    reviews = (
        db.query(models.Review)
        .filter(models.Review.book_id == book_id)
        .order_by(models.Review.created_at.desc())
        .all()
    )

    breakdown = {str(star): 0 for star in range(1, 6)}
    for review in reviews:
        breakdown[str(review.rating)] += 1

    average = sum(r.rating for r in reviews) / len(reviews) if reviews else 0.0

    verified = _verified_buyer_ids(db, book_id, {r.user_id for r in reviews})

    return ReviewSummary(
        average=round(average, 2),
        count=len(reviews),
        breakdown=breakdown,
        items=[_to_read(r, current_user_id=None, verified_ids=verified) for r in reviews],
    )


@router.put("/{book_id}/reviews", response_model=ReviewRead)
def upsert_review(
    book_id: UUID,
    payload: ReviewCreate,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    """Create or update the caller's review for this book.

    One review per customer per book, so posting again edits rather than stacking
    — which also stops a single account inflating a book's rating.
    """
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    review = (
        db.query(models.Review)
        .filter(models.Review.book_id == book_id, models.Review.user_id == current_user.id)
        .first()
    )

    if review is None:
        review = models.Review(book_id=book_id, user_id=current_user.id)
        db.add(review)

    review.rating = payload.rating
    review.title = payload.title
    review.body = payload.body

    db.flush()
    recompute_book_rating(db, book_id)
    db.commit()
    db.refresh(review)

    # The writer's own copy of their review carries the badge too, so somebody
    # who did buy the book can see that the shop knows it.
    return _to_read(
        review,
        current_user_id=current_user.id,
        verified_ids=_verified_buyer_ids(db, book_id, {current_user.id}),
    )


@router.delete("/{book_id}/reviews", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    book_id: UUID,
    db: Session = Depends(db.get_db),
    current_user=Depends(require_role("customer")),
):
    review = (
        db.query(models.Review)
        .filter(models.Review.book_id == book_id, models.Review.user_id == current_user.id)
        .first()
    )
    if review is None:
        raise HTTPException(status_code=404, detail="You have not reviewed this book")

    db.delete(review)
    db.flush()
    recompute_book_rating(db, book_id)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
