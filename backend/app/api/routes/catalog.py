import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session
from app.core.merchandising import (
    annotate_badges,
    bestseller_ids,
    spread_by_category,
    trending_book_ids,
)
from app.core.search import apply_search
from app.core.transliterate import author_slug
from app.database import models, db
from app.schema.book import BookResponse
from app.schema.pagination import PaginatedBooks, PageMeta
from app.schema.category import CategoryResponse

logger = logging.getLogger("bookvuk.catalog")

router = APIRouter(
    prefix="/api/catalog",
    tags=["Catalog"]
)


# `GET /books` (the whole catalogue, unpaginated) was removed. It returned every
# row with no limit — 97 KB against 3.8 KB for a page of eight, growing forever —
# and nothing called it any more: the pages that used to download the catalogue to
# render a cart or a wishlist were moved onto `/books/paged` and the embedded book
# summaries. Leaving it in place only invited that pattern back.
#
# Use `/books/paged` for lists, `/books/{id}` for one book, `/facets` for counts.


@router.get("/categories", response_model=List[CategoryResponse])
def get_public_categories(response: Response, db: Session = Depends(db.get_db)):
    """The seven category names, identical for every visitor.

    Cached hard, and it was the one public catalogue endpoint that was not:
    authors, trending and facets all send this header and this was missed. It is
    seven rows that change when somebody edits the catalogue — perhaps twice a
    year — and it was costing a database round trip on every visitor because
    nothing in front of the app was allowed to keep it.
    """
    response.headers["Cache-Control"] = "public, max-age=3600"
    return db.query(models.Category).order_by(models.Category.name.asc()).all()


@router.get("/authors")
def list_public_authors(
    response: Response,
    limit: int = 200,
    db: Session = Depends(db.get_db),
):
    """Every author the shop stocks, with how many titles each has.

    A bookshop is browsed by author as much as by category, and the footer already
    promised this page. Built from `books.author` rather than the `authors` table
    because that column is what the catalogue actually files a book under — an
    author row with no books would be a link to an empty shelf.

    Used copies are excluded from the counts: they are variants of a title already
    counted, not another book by that author.
    """
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 1000")

    rows = (
        db.query(
            models.Book.author,
            func.count(models.Book.id).label("books"),
            func.max(models.Book.rating).label("top_rating"),
        )
        .filter(
            models.Book.author.isnot(None),
            models.Book.author != "",
            models.Book.parent_book_id.is_(None),
        )
        .group_by(models.Book.author)
        .order_by(func.count(models.Book.id).desc(), models.Book.author.asc())
        .limit(limit)
        .all()
    )

    # Identical for every visitor, so a proxy can serve it.
    response.headers["Cache-Control"] = "public, max-age=600"

    return {
        "authors": [
            {
                "name": r.author,
                "slug": author_slug(r.author),
                "books": int(r.books),
                "top_rating": float(r.top_rating or 0),
            }
            for r in rows
        ],
        "total": len(rows),
    }


@router.get("/authors/{slug}")
def get_author_by_slug(
    slug: str,
    response: Response,
    db: Session = Depends(db.get_db),
):
    """One author and everything the shop stocks by them.

    `/authors` was a list whose every entry pointed at `/browse?q=<name>` — a
    search results page with no title, description or identity of its own. "Books
    by Premchand" is a real search with real intent, and there was no page for it
    to land on. This is that page.

    Resolved by slug rather than by name because the names are half Devanagari:
    `/authors/munshi-premachand` is shareable and typeable, where the URL-encoded
    Devanagari is neither.

    The slug is computed rather than stored, so this scans the distinct authors to
    find the match. At 97 authors that is trivial; if the catalogue grows into the
    thousands it wants a `slug` column with an index, and this comment is the
    warning.
    """
    wanted = (slug or "").strip().lower()
    if not wanted:
        raise HTTPException(status_code=404, detail="Author not found")

    names = (
        db.query(models.Book.author)
        .filter(
            models.Book.author.isnot(None),
            models.Book.author != "",
            models.Book.parent_book_id.is_(None),
        )
        .distinct()
        .all()
    )
    match = next((n.author for n in names if author_slug(n.author) == wanted), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Author not found")

    books = (
        db.query(models.Book)
        .filter(
            models.Book.author == match,
            models.Book.parent_book_id.is_(None),
        )
        .order_by(models.Book.rating.desc(), models.Book.created_at.desc())
        .all()
    )
    annotate_badges(books, bestseller_ids(db))

    # Identical for every visitor and changes only when the catalogue does.
    response.headers["Cache-Control"] = "public, max-age=600"

    return {
        "name": match,
        "slug": wanted,
        "total": len(books),
        "items": [BookResponse.model_validate(b).model_dump(by_alias=True) for b in books],
    }


#: Longer than this is a paste, not a search, and it would not fit the column.
_MAX_MISS_TERM = 120


def record_search_miss(db_session: Session, term: str) -> None:
    """Count a search that returned nothing. Never fails the request.

    Best effort on purpose: this is telemetry hanging off a customer-facing read,
    and a write that cannot complete must not turn an empty result page into an
    error page.
    """
    cleaned = " ".join((term or "").split()).lower()[:_MAX_MISS_TERM]
    if not cleaned:
        return
    try:
        row = (
            db_session.query(models.SearchMiss)
            .filter(models.SearchMiss.term == cleaned)
            .first()
        )
        if row is None:
            db_session.add(models.SearchMiss(term=cleaned, hits=1))
        else:
            row.hits = int(row.hits or 0) + 1
            row.last_seen = datetime.now(timezone.utc)
            # It is being asked for again, so it is a live want once more.
            row.resolved_at = None
        db_session.commit()
    except Exception:
        db_session.rollback()
        logger.debug("could not record a search miss", exc_info=True)



@router.get("/books/paged", response_model=PaginatedBooks)
def get_books_paged(
    page: int = 1,
    page_size: int = 8,
    q: Optional[str] = None,
    category_id: Optional[UUID] = None,
    min_rating: Optional[float] = None,
    sort: Optional[str] = None,
    # "new" (the default) lists the catalogue; "used" lists only second-hand stock.
    condition: Optional[str] = None,
    db: Session = Depends(db.get_db),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 50:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 50")
    if min_rating is not None and not (0 <= min_rating <= 5):
        raise HTTPException(status_code=400, detail="min_rating must be between 0 and 5")

    # A blank or whitespace-only q is not a search. Normalising it here means the
    # sort default and the search branch below both see the same thing, rather
    # than one of them treating "   " as a term with nothing to rank by.
    q = q.strip() if q else None
    if not q:
        q = None

    # A search with no stated order wants the best match first; browsing with no
    # search wants the newest. An explicit `sort` always wins.
    if sort is None:
        sort = "relevance" if q else "newest"

    if sort == "relevance" and not q:
        # There is nothing to be relevant to, and silently substituting another
        # order is how the frontend ended up offering a relevance sort that did
        # not exist.
        raise HTTPException(status_code=400, detail="sort=relevance needs a search term (q)")

    query = db.query(models.Book)

    # Used copies are variants of a listed title, not listings of their own, so they
    # are kept out of the catalogue: without this a search for "2 States" returned
    # the same book twice at two prices. They are surfaced on the parent's product
    # page instead (`/books/{id}/used`), which is where a buyer is choosing between
    # a new copy and a cheaper used one.
    #
    # `condition="used"` opts into the other view: only used stock, for a
    # bargain-hunting page.
    if condition == "used":
        # Buyable copies only, matching `/books/{id}/used` and the facet count.
        # Without the stock filter this shelf disagreed with the chip that leads
        # to it the moment a copy sold — and used stock is usually a single copy,
        # so selling out is the normal case here rather than an edge one.
        query = query.filter(models.Book.parent_book_id.isnot(None), models.Book.stock > 0)
    elif condition in (None, "new"):
        query = query.filter(models.Book.parent_book_id.is_(None))
    else:
        raise HTTPException(status_code=400, detail="condition must be 'new' or 'used'")

    if category_id is not None:
        query = query.filter(models.Book.category_id == category_id)

    if min_rating is not None:
        query = query.filter(models.Book.rating >= min_rating)

    relevance = None
    if q:
        query, relevance = apply_search(db, query, q)

    if sort == "relevance":
        # Equally relevant books are ordered by rating then recency, both of which
        # mean something to a shopper. `id` is last only to make the ordering
        # total: without it, equal rows can swap between pages and a book shows
        # twice or not at all.
        query = query.order_by(
            relevance,
            models.Book.rating.desc(),
            models.Book.created_at.desc(),
            models.Book.id.asc(),
        )
    elif sort == "newest":
        query = query.order_by(models.Book.created_at.desc())
    elif sort == "price_asc":
        query = query.order_by(models.Book.price.asc())
    elif sort == "price_desc":
        query = query.order_by(models.Book.price.desc())
    elif sort == "rating_desc":
        query = query.order_by(models.Book.rating.desc(), models.Book.rating_count.desc())
    elif sort == "popular":
        # How many people rated it, not how highly. The "Popular" and "Top rated"
        # chips both used to send `rating_desc`, so one of them did nothing.
        query = query.order_by(models.Book.rating_count.desc(), models.Book.rating.desc())
    elif sort == "title_asc":
        query = query.order_by(models.Book.title.asc())
    else:
        raise HTTPException(status_code=400, detail="Invalid sort")

    total = query.count()
    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()

    annotate_badges(rows, bestseller_ids(db))

    # A search that found nothing is the clearest thing a customer can say about
    # what to stock — they came looking for it — and every one of them used to be
    # thrown away. Recorded only on a real search, and only on the first page, so
    # paging through an empty result does not count the same miss twice.
    if q and total == 0 and page == 1:
        record_search_miss(db, q)

    return PaginatedBooks(
        items=rows,
        meta=PageMeta.from_total(page=page, page_size=page_size, total=total),
    )


@router.get("/trending")
def get_trending(
    response: Response,
    days: int = 7,
    limit: int = 4,
    db: Session = Depends(db.get_db),
):
    """The shelf for the home page's "Trending this week".

    It used to be `sort=rating_desc` — the all-time highest rated books, with no
    time window at all — under a heading that claimed otherwise.

    `basis` tells the client what it is actually looking at, so it can title the
    shelf truthfully: "sales" when enough has genuinely sold in the window,
    "rating" when it has not and this is the top-rated fallback. A new shop has no
    sales, and an empty shelf is worse than a labelled substitute.
    """
    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="days must be between 1 and 90")
    if limit < 1 or limit > 24:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 24")

    ids = trending_book_ids(db, days=days, limit=limit)
    basis = "sales" if len(ids) >= limit else "rating"

    if basis == "sales":
        rows = db.query(models.Book).filter(models.Book.id.in_(ids)).all()
        # Preserve the units-sold ordering the ids came in; SQL `IN` does not.
        order = {book_id: i for i, book_id in enumerate(ids)}
        rows.sort(key=lambda b: order.get(b.id, len(order)))
    else:
        # A wider pool than `limit`, because the shelf is then interleaved across
        # categories: taking only the top `limit` by rating gave every slot to the
        # one category that holds half the catalogue.
        candidates = (
            db.query(models.Book)
            .filter(
                models.Book.stock > 0,
                # Used copies inherit their parent's rating, so without this a
                # shelf of "highest rated" shows the same title twice.
                models.Book.parent_book_id.is_(None),
            )
            .order_by(models.Book.rating.desc(), models.Book.rating_count.desc())
            .limit(limit * 8)
            .all()
        )
        rows = spread_by_category(candidates, limit)

    annotate_badges(rows, bestseller_ids(db))

    # Identical for every visitor and cheap to serve stale, so a proxy can absorb
    # the traffic the home page sends here.
    response.headers["Cache-Control"] = "public, max-age=300"

    return {
        "basis": basis,
        "window_days": days,
        "items": [BookResponse.model_validate(b).model_dump(by_alias=True) for b in rows],
    }


@router.get("/books/{book_id}", response_model=BookResponse)
def get_book_by_Id(book_id: UUID, db: Session = Depends(db.get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with id: {book_id} was not found!",
        )

    annotate_badges([book], bestseller_ids(db))
    return book


@router.get("/books/{book_id}/used", response_model=List[BookResponse])
def get_used_copies(book_id: UUID, db: Session = Depends(db.get_db)):
    """Second-hand copies of this title, cheapest first.

    The product page is where the choice between a new copy and a cheaper used one
    actually gets made, so the alternatives have to be on it. Out-of-stock rows are
    excluded — an unbuyable option is worse than no option, because it looks like a
    price the shop refuses to honour.
    """
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    # Asking a used copy for its used copies means the parent title.
    parent_id = book.parent_book_id or book.id

    rows = (
        db.query(models.Book)
        .filter(
            models.Book.parent_book_id == parent_id,
            models.Book.stock > 0,
        )
        .order_by(models.Book.price.asc())
        .all()
    )
    annotate_badges(rows, bestseller_ids(db))
    return rows


@router.get("/books/{book_id}/related", response_model=List[BookResponse])
def get_related_books(
    book_id: UUID,
    response: Response,
    limit: int = 6,
    db: Session = Depends(db.get_db),
):
    """Other books a reader of this one is likely to want.

    A product page with no way onward is a dead end: the visitor either buys this
    book or leaves. Nothing here cross-sold anything.

    Ordered by the same author first, then the rest of the category, because "more
    by this author" is the strongest signal a bookshop has without a
    recommendation engine. Out-of-stock titles are excluded — suggesting something
    unbuyable wastes the slot.

    Cached for the same five minutes as `/trending`, and for the same reason: a
    stale answer here costs a wasted suggestion slot, not a wrong price. The
    pages that *are* decided on — the paged catalogue and the product page — stay
    uncached deliberately, because their staleness would be a stock number the
    shopper acts on.
    """
    response.headers["Cache-Control"] = "public, max-age=300"
    if limit < 1 or limit > 24:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 24")

    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    same_author = case((models.Book.author == book.author, 0), else_=1)

    rows = (
        db.query(models.Book)
        .filter(
            models.Book.id != book.id,
            models.Book.stock > 0,
            # Catalogue titles only: a used copy of a neighbouring book is not a
            # different book, and suggesting both is suggesting the same thing twice.
            models.Book.parent_book_id.is_(None),
            or_(
                models.Book.category_id == book.category_id,
                models.Book.author == book.author,
            ),
        )
        .order_by(
            same_author,
            models.Book.rating.desc(),
            models.Book.rating_count.desc(),
            models.Book.id.asc(),
        )
        .limit(limit)
        .all()
    )

    annotate_badges(rows, bestseller_ids(db))
    return rows

@router.get("/facets")
def catalog_facets(response: Response, db: Session = Depends(db.get_db)):
    """Total book count plus a count per category.

    The browse sidebar needs these numbers, and it must not have to download the
    whole catalogue to compute them — that is exactly what server-side paging is
    meant to avoid.
    """
    # Same for every visitor and only changes when the catalogue does.
    response.headers["Cache-Control"] = "public, max-age=300"

    # Second-hand copies are excluded, exactly as the paged listing excludes them
    # (`parent_book_id.is_(None)`). Without this the counts described a different
    # catalogue than the one you can browse: the landing page advertised "202
    # titles" while browsing them returned 200. The gap was the two used copies,
    # and it would have grown with every book bought back — a headline number
    # climbing while the shelf a shopper can actually reach stays put.
    listed = models.Book.parent_book_id.is_(None)

    total = db.query(func.count(models.Book.id)).filter(listed).scalar() or 0

    rows = (
        db.query(models.Book.category_id, func.count(models.Book.id))
        .filter(listed)
        .group_by(models.Book.category_id)
        .all()
    )

    # How much second-hand stock there is, so the browse page can offer a "used"
    # chip carrying a number like the category chips do — and, more importantly,
    # can hide it when the shop has none rather than sending shoppers to an empty
    # shelf. `condition=used` has worked on the listing endpoint all along and
    # nothing in the frontend called it, so used copies were reachable only by
    # first finding the new edition.
    used = (
        db.query(func.count(models.Book.id))
        .filter(models.Book.parent_book_id.isnot(None), models.Book.stock > 0)
        .scalar()
        or 0
    )

    return {
        "total": int(total),
        "categories": {str(category_id): int(count) for category_id, count in rows if category_id},
        "conditions": {"new": int(total), "used": int(used)},
    }
