"""Catalogue search.

There were no tests for `q` at all, on the endpoint the storefront leans on
hardest. What is checked here is the behaviour a shopper depends on: that a match
is found at all, that the best match comes first, and that a misspelling still
finds the book.
"""

import pytest


def _search(client, term, **params):
    query = {"q": term, "page_size": 50, **params}
    res = client.get("/api/catalog/books/paged", params=query)
    assert res.status_code == 200, res.text
    return res.json()


def _titles(body):
    return [item["title"] for item in body["items"]]


@pytest.fixture
def catalogue(make_book):
    """A small catalogue with deliberate overlaps between fields."""
    return {
        "gatsby": make_book(title="The Great Gatsby", price="399.00"),
        "mockingbird": make_book(title="To Kill a Mockingbird", price="299.00"),
        "potter": make_book(title="Harry Potter and the Goblet of Fire", price="599.00"),
        "dune": make_book(title="Dune", price="499.00"),
    }


# ----- finding things -----

def test_a_title_word_is_found(client, catalogue):
    assert "The Great Gatsby" in _titles(_search(client, "gatsby"))


def test_search_is_case_insensitive(client, catalogue):
    assert _titles(_search(client, "GATSBY")) == _titles(_search(client, "gatsby"))


def test_a_multi_word_query_matches(client, catalogue):
    assert "Harry Potter and the Goblet of Fire" in _titles(_search(client, "harry potter"))


def test_a_word_only_in_the_description_is_found(client, make_book):
    """The description is indexed too, just weighted below the title."""
    make_book(title="An Unrelated Title")
    body = _search(client, "used by the tests")  # make_book's description text
    assert "An Unrelated Title" in _titles(body)


def test_the_author_is_searchable(client, make_book):
    make_book(title="Some Book")
    assert "Some Book" in _titles(_search(client, "Test Author"))


def test_stemming_matches_a_different_word_form(client, make_book):
    """Full text search stems, so a singular query finds a plural title."""
    make_book(title="The Book of Dragons")
    assert "The Book of Dragons" in _titles(_search(client, "dragon"))


def test_a_term_matching_nothing_returns_an_empty_page(client, catalogue):
    body = _search(client, "zzzznotathing")
    assert body["items"] == []
    assert body["meta"]["total"] == 0


# ----- ranking, which did not exist before -----

def test_a_title_match_outranks_a_description_match(client, make_book):
    """The old ILIKE had no ranking at all, so a passing mention could win.

    The blurb-only book is created second, so newest-first would put it on top —
    which is what the old behaviour did.
    """
    target = make_book(title="Gatsby")
    make_book(title="An Unrelated Novel", description="A homage to Gatsby, loosely.")

    ranked = _titles(_search(client, "gatsby"))
    assert ranked[0] == target.title, f"expected the title match first, got {ranked}"


def test_an_author_match_outranks_a_description_match(client, make_book):
    make_book(title="Something Else", description="Mentions Tolkien in the foreword.")
    make_book(title="A Later Book", author="J R R Tolkien")

    assert _titles(_search(client, "tolkien"))[0] == "A Later Book"


def test_relevance_is_the_default_order_for_a_search(client, make_book):
    """No `sort` given, so the stronger match must win.

    The weak match is created last, so the old default of newest-first would put
    it on top — which is exactly what it used to do.
    """
    make_book(title="Gatsby")  # strong: title match
    make_book(title="Unrelated Later Book", description="Briefly mentions Gatsby.")

    assert _titles(_search(client, "gatsby"))[0] == "Gatsby"


def test_an_explicit_sort_still_wins_over_relevance(client, catalogue):
    body = _search(client, "the", sort="price_asc")
    prices = [float(item["price"]) for item in body["items"]]
    assert prices == sorted(prices)


def test_relevance_without_a_search_term_is_rejected(client):
    """Rather than silently substituting another order, which is the bug this
    replaced: the UI offered a relevance sort the backend quietly ignored."""
    res = client.get("/api/catalog/books/paged", params={"sort": "relevance"})
    assert res.status_code == 400
    assert "relevance" in res.json()["detail"].lower()


def test_popular_sorts_by_how_many_rated_not_how_highly(client, make_book, db_session):
    """The "Popular" and "Top rated" chips both sent `rating_desc`, so one did
    nothing. Popularity is the count; the rating is the score."""
    niche = make_book(title="Niche Masterpiece")
    niche.rating, niche.rating_count = 5.0, 3
    crowd = make_book(title="Crowd Favourite")
    crowd.rating, crowd.rating_count = 4.0, 900
    db_session.commit()

    by_popular = client.get("/api/catalog/books/paged", params={"sort": "popular"}).json()
    by_rating = client.get("/api/catalog/books/paged", params={"sort": "rating_desc"}).json()

    assert _titles(by_popular)[0] == "Crowd Favourite"
    assert _titles(by_rating)[0] == "Niche Masterpiece"


def test_browsing_without_a_term_is_still_newest_first(client, make_book):
    make_book(title="Older")
    make_book(title="Newer")
    body = client.get("/api/catalog/books/paged", params={"page_size": 50}).json()
    assert _titles(body)[:2] == ["Newer", "Older"]


# ----- typo tolerance, via the trigram fallback -----

def test_a_misspelled_title_still_finds_the_book(client, catalogue):
    """"harri potter" is what people type. Full text finds nothing, so the
    trigram fallback has to carry it."""
    assert "Harry Potter and the Goblet of Fire" in _titles(_search(client, "harri potter"))


def test_a_misspelled_single_word_is_found(client, catalogue):
    assert "The Great Gatsby" in _titles(_search(client, "gatsbi"))


def test_a_partial_word_is_found(client, catalogue):
    """The old behaviour was substring matching, so this must not regress."""
    assert "To Kill a Mockingbird" in _titles(_search(client, "mocking"))


def test_the_fallback_does_not_return_the_whole_catalogue(client, catalogue):
    """A loose threshold would make every failed search look like a match."""
    body = _search(client, "qwertyuiop")
    assert len(body["items"]) < len(catalogue)


# ----- combining with the other filters -----

def test_search_combines_with_a_category_filter(client, make_book, db_session):
    from app.database.models.category import Category

    other = Category(name="OtherCat")
    db_session.add(other)
    db_session.commit()

    inside = make_book(title="Gatsby Anthology")
    outside = make_book(title="Gatsby Companion")
    outside.category_id = other.id
    db_session.commit()

    body = _search(client, "gatsby", category_id=str(inside.category_id))
    assert _titles(body) == ["Gatsby Anthology"]


def test_search_combines_with_a_minimum_rating(client, make_book, db_session):
    low = make_book(title="Gatsby Low")
    low.rating = 1.0
    db_session.commit()
    make_book(title="Gatsby High")  # make_book defaults to 4.5

    body = _search(client, "gatsby", min_rating=4.0)
    assert _titles(body) == ["Gatsby High"]


def test_pagination_meta_reflects_the_search_not_the_catalogue(client, catalogue):
    body = _search(client, "gatsby", page_size=1)
    assert body["meta"]["total"] == 1, "total must count matches, not all books"


# ----- input that must not break it -----

@pytest.mark.parametrize("term", ["&", "|", "!", ":*", "'", '"', "a & | b", "\\", "()"])
def test_search_operators_are_treated_as_text_not_syntax(client, catalogue, term):
    """`to_tsquery` raises on these; `websearch_to_tsquery` does not. A stray
    ampersand must be a search, not a 500."""
    res = client.get("/api/catalog/books/paged", params={"q": term})
    assert res.status_code == 200, res.text


def test_a_whitespace_only_term_is_harmless(client, catalogue):
    res = client.get("/api/catalog/books/paged", params={"q": "   "})
    assert res.status_code == 200


# ----- the catalogue is only served in pages -----

def test_there_is_no_unpaginated_catalogue_endpoint(client, catalogue):
    """`GET /api/catalog/books` returned every row with no limit — 97 KB against
    3.8 KB for a page of eight, growing with the catalogue forever. Pinned so it
    cannot come back by habit."""
    assert client.get("/api/catalog/books").status_code == 404


def test_a_page_is_bounded_however_large_the_catalogue(client, make_book):
    for i in range(60):
        make_book(title=f"Bulk {i}")

    body = client.get("/api/catalog/books/paged?page_size=50").json()
    assert len(body["items"]) == 50
    assert body["meta"]["total"] >= 60

    # And the ceiling is enforced rather than trusted.
    assert client.get("/api/catalog/books/paged?page_size=500").status_code == 400


# ----- the queries must stay index-usable -----

def _plan(db_session, statement):
    """The plan with sequential scans priced out, so an index that *can* be used
    will be. A `Seq Scan` surviving this means the predicate is not indexable."""
    from sqlalchemy import text

    db_session.execute(text("SET LOCAL enable_seqscan = off"))
    rows = db_session.execute(text("EXPLAIN " + statement)).fetchall()
    return "\n".join(r[0] for r in rows)


def test_full_text_search_uses_its_index(db_session, catalogue):
    plan = _plan(
        db_session,
        "SELECT id FROM books WHERE search_vector @@ websearch_to_tsquery('english', 'gatsby')",
    )
    assert "ix_books_search_vector" in plan, plan


def test_the_trigram_fallback_uses_its_index(db_session, catalogue):
    """`word_similarity(...) >= 0.6` reads the same but cannot be indexed; only
    the `<%` operator against a bare column can. Measured at 41 ms versus 0.16 ms
    on a 20k catalogue, so this is worth pinning."""
    plan = _plan(
        db_session,
        "SELECT id FROM books WHERE 'gatsbi' <% title OR 'gatsbi' <% author",
    )
    assert "ix_books_title_trgm" in plan, plan
    assert "ix_books_author_trgm" in plan, plan
    assert "Seq Scan" not in plan, plan


def test_the_non_indexable_form_is_what_we_avoided(db_session, catalogue):
    """Proves the point of the test above: the readable-looking version really is
    a sequential scan even with seq scans priced out."""
    plan = _plan(
        db_session,
        "SELECT id FROM books WHERE word_similarity('gatsbi', title) >= 0.6",
    )
    assert "Seq Scan" in plan, plan
