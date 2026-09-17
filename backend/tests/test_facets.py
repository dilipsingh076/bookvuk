"""The catalogue's headline counts.

These numbers are what the landing page and the browse sidebar tell a shopper the
shop contains, so they have to describe the same catalogue the listing returns.
They stopped doing that when the buyback feature started adding second-hand
copies as their own book rows.
"""

from app.database import models


def _facets(client):
    res = client.get("/api/catalog/facets")
    assert res.status_code == 200, res.text
    return res.json()


def _paged_total(client):
    res = client.get("/api/catalog/books/paged?page=1&page_size=1")
    assert res.status_code == 200, res.text
    return res.json()["meta"]["total"]


def _used_copy_of(db_session, parent, **kwargs):
    """A second-hand copy: a real book row hanging off its parent's listing."""
    copy = models.Book(
        title=parent.title,
        author=parent.author,
        description=parent.description,
        price=parent.price,
        stock=1,
        # Carried from the parent because that is what `admin.receive_buyback`
        # does. Leaving them out made the helper build a row production never
        # builds — and `books.format` is NOT NULL, so the insert failed and these
        # three tests could not run at all.
        format=parent.format,
        cover_image=parent.cover_image,
        rating=parent.rating,
        rating_count=parent.rating_count,
        category_id=parent.category_id,
        condition="good",
        parent_book_id=parent.id,
        **kwargs,
    )
    db_session.add(copy)
    db_session.commit()
    return copy


def test_the_total_matches_what_browsing_returns(client, make_book):
    """The bug in one line: a shopper is told one number and shown another."""
    for i in range(3):
        make_book(title=f"Listed {i}")

    assert _facets(client)["total"] == _paged_total(client) == 3


def test_a_used_copy_does_not_inflate_the_total(client, make_book, db_session):
    """Buying a book back must not make the shop look bigger than it is.

    The copy is a real row, but it is reached through its parent's page rather
    than by browsing — counting it advertises a title that is not on the shelf.
    """
    parent = make_book(title="Course Text")
    _used_copy_of(db_session, parent)

    assert _facets(client)["total"] == 1
    assert _facets(client)["total"] == _paged_total(client)


def test_category_counts_exclude_used_copies_too(client, make_book, db_session):
    """Otherwise the sidebar's per-category numbers overstate each shelf."""
    parent = make_book(title="Course Text")
    _used_copy_of(db_session, parent)

    counts = _facets(client)["categories"]
    assert counts[str(parent.category_id)] == 1


def test_the_category_counts_add_up_to_the_total(client, make_book, db_session):
    """A sidebar whose parts exceed its whole is the same bug, one level down."""
    history = models.Category(name="History")
    db_session.add(history)
    db_session.flush()

    make_book(title="One")
    make_book(title="Two")
    third = make_book(title="Three")
    third.category_id = history.id
    db_session.commit()

    body = _facets(client)
    assert sum(body["categories"].values()) == body["total"] == 3
    assert len(body["categories"]) == 2


def test_many_used_copies_still_do_not_move_the_number(client, make_book, db_session):
    """The gap grows with the buyback feature, which is what makes it worth a test."""
    parent = make_book(title="Popular Text")
    for _ in range(5):
        _used_copy_of(db_session, parent)

    assert _facets(client)["total"] == 1


def test_an_empty_shop_reports_zero(client):
    body = _facets(client)
    assert body["total"] == 0
    assert body["categories"] == {}
