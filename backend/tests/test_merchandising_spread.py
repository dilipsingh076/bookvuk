"""The shopfront shelf's category spread.

Pure logic over a list, so these run without a database — which matters, because
the shelf is the first thing a visitor sees and this is the part of it that is
easy to get subtly wrong.
"""

from dataclasses import dataclass

from app.core.merchandising import spread_by_category


@dataclass
class FakeBook:
    title: str
    category_id: str


def titles(books):
    return [b.title for b in books]


def categories(books):
    return [b.category_id for b in books]


def test_one_dominant_category_does_not_take_every_slot():
    """The bug this exists for.

    Hindi Literature holds half the catalogue and all of it is rated 5.0, so
    ordering by rating alone gave it seven of eight slots — a shop that stocks
    seven categories looked like it stocked one.
    """
    books = [FakeBook(f"hindi-{i}", "hindi") for i in range(20)]
    books += [FakeBook("fiction-1", "fiction"), FakeBook("business-1", "business")]

    shelf = spread_by_category(books, 8)

    assert len(shelf) == 8
    assert categories(shelf).count("hindi") < 8
    assert "fiction" in categories(shelf)
    assert "business" in categories(shelf)


def test_it_takes_the_best_from_each_category_in_turn():
    books = [
        FakeBook("a1", "a"), FakeBook("a2", "a"),
        FakeBook("b1", "b"), FakeBook("b2", "b"),
        FakeBook("c1", "c"),
    ]
    # Input order is the caller's ranking, so within a category the first is best.
    assert titles(spread_by_category(books, 3)) == ["a1", "b1", "c1"]


def test_the_caller_s_order_survives_within_a_category():
    """Only the interleave is new — "best" still means whatever was sorted by."""
    books = [FakeBook("a1", "a"), FakeBook("a2", "a"), FakeBook("a3", "a")]
    assert titles(spread_by_category(books, 3)) == ["a1", "a2", "a3"]


def test_a_thin_catalogue_still_fills_the_shelf():
    """A category running out must not leave a gap: eight slots, eight books."""
    books = [FakeBook(f"a{i}", "a") for i in range(6)] + [FakeBook("b1", "b")]
    shelf = spread_by_category(books, 8)
    assert len(shelf) == 7  # every book available, none repeated
    assert len(set(titles(shelf))) == 7


def test_the_biggest_category_leads():
    """The shelf should lean towards what the shop actually stocks."""
    books = [FakeBook("small-1", "small")]
    books += [FakeBook(f"big-{i}", "big") for i in range(5)]
    assert spread_by_category(books, 2)[0].category_id == "big"


def test_asking_for_more_than_exists_returns_everything_once():
    books = [FakeBook("a1", "a"), FakeBook("b1", "b")]
    shelf = spread_by_category(books, 50)
    assert sorted(titles(shelf)) == ["a1", "b1"]


def test_an_empty_catalogue_is_an_empty_shelf():
    assert spread_by_category([], 8) == []


def test_books_with_no_category_are_still_shown():
    """A book filed under nothing is still a book the shop can sell."""
    books = [FakeBook("uncategorised", None), FakeBook("a1", "a")]
    shelf = spread_by_category(books, 2)
    assert len(shelf) == 2
