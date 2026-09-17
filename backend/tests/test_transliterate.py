"""Romanised search for the Devanagari half of the catalogue.

Shoppers type Hindi titles on a Latin keyboard. Before this, "godaan" for गोदान
returned nothing at all, and "nirmala" only worked by accident because that
romanisation happened to appear in the book's description.

The transliteration is a search aid, not a standard, so what is asserted here is
whether a plausible spelling reaches the right book.
"""

import pytest

from app.core.transliterate import has_devanagari, romanise, search_aliases


# ----- the transliteration itself -----

def test_latin_text_produces_nothing():
    """Storing aliases for an English title would duplicate it in the index."""
    assert romanise("The Great Gatsby") == ""
    assert romanise("") == ""


def test_devanagari_is_detected():
    assert has_devanagari("गोदान")
    assert has_devanagari("Godaan गोदान")
    assert not has_devanagari("The Great Gatsby")
    assert not has_devanagari("")


@pytest.mark.parametrize(
    "devanagari,expected",
    [
        ("गोदान", "godaan"),
        ("गोदान", "godan"),
        ("निर्मला", "nirmala"),
        ("प्रेमचंद", "premchand"),      # the spelling everyone actually uses
        ("प्रेमचंद", "premachand"),     # and the literal one
        ("कर्मभूमि", "karmabhumi"),
        ("गबन", "gaban"),
        ("मानसरोवर", "manasarovar"),
    ],
)
def test_expected_spellings_are_produced(devanagari, expected):
    assert expected in romanise(devanagari).split()


def test_long_and_short_vowel_spellings_are_both_offered():
    """People write both "godaan" and "godan"; full-text matching is exact."""
    tokens = romanise("गोदान").split()
    assert "godaan" in tokens and "godan" in tokens


def test_a_word_final_inherent_vowel_is_dropped():
    """Hindi drops it: राम is "ram", never "rama"."""
    tokens = romanise("राम").split()
    assert any(t in ("ram", "raam") for t in tokens)
    assert "rama" not in tokens and "raama" not in tokens


def test_a_vowel_before_a_nasal_survives():
    """चं is "chan", not "chn" — dropping it would break "premchand"."""
    assert "premchand" in romanise("प्रेमचंद").split()


def test_unpronounceable_spellings_are_not_indexed():
    """Dropping every internal vowel turns बच्चन into "bchchn", which nobody types
    and which can only ever cause a spurious match."""
    tokens = romanise("हरिवंश राय बच्चन").split()
    assert "bchchn" not in tokens
    assert "bachchan" in tokens


def test_multiple_words_are_all_romanised():
    tokens = romanise("मुंशी प्रेमचंद").split()
    assert any(t.startswith("munsh") for t in tokens)
    assert "premchand" in tokens


def test_digits_are_converted():
    assert "1984" in romanise("१९८४").split()


def test_search_aliases_combines_the_fields():
    aliases = search_aliases("गोदान", "मुंशी प्रेमचंद")
    assert "godaan" in aliases and "premchand" in aliases


def test_search_aliases_ignores_latin_fields():
    assert search_aliases("The Great Gatsby", "F Scott Fitzgerald") == ""


def test_no_duplicate_tokens():
    """A repeated lexeme in the vector gains nothing."""
    tokens = romanise("गबन").split()
    assert len(tokens) == len(set(tokens))


# ----- end to end through the catalogue -----

def _search(client, term):
    res = client.get("/api/catalog/books/paged", params={"q": term, "page_size": 20})
    assert res.status_code == 200, res.text
    return [i["title"] for i in res.json()["items"]]


def test_the_aliases_are_stored_automatically(client, make_book, db_session):
    """Written by a mapper event, so no write path can forget them."""
    book = make_book(title="गोदान", author="मुंशी प्रेमचंद")
    db_session.refresh(book)
    assert book.search_aliases
    assert "godaan" in book.search_aliases


def test_a_latin_book_stores_no_aliases(client, make_book, db_session):
    book = make_book(title="The Great Gatsby", author="F Scott Fitzgerald")
    db_session.refresh(book)
    assert book.search_aliases is None


def test_aliases_are_refreshed_when_the_title_changes(client, make_book, db_session):
    book = make_book(title="The Placeholder", author="Someone")
    assert book.search_aliases is None

    book.title = "निर्मला"
    db_session.commit()
    db_session.refresh(book)
    assert book.search_aliases and "nirmala" in book.search_aliases


def test_a_romanised_query_finds_a_hindi_title(client, make_book):
    """The headline case: this returned nothing before."""
    make_book(title="गोदान", author="मुंशी प्रेमचंद")
    assert "गोदान" in _search(client, "godaan")


def test_the_short_spelling_works_too(client, make_book):
    make_book(title="गोदान", author="मुंशी प्रेमचंद")
    assert "गोदान" in _search(client, "godan")


def test_a_romanised_author_finds_their_books(client, make_book):
    make_book(title="निर्मला", author="मुंशी प्रेमचंद")
    make_book(title="गबन", author="मुंशी प्रेमचंद")
    assert len(_search(client, "premchand")) == 2


def test_devanagari_search_still_works(client, make_book):
    """The aliases are an addition, not a replacement."""
    make_book(title="गोदान", author="मुंशी प्रेमचंद")
    assert "गोदान" in _search(client, "गोदान")


def test_a_misspelled_romanisation_is_rescued_by_the_fallback(client, make_book):
    """Trigram matching now covers the aliases; comparing "nirmalla" against
    Devanagari scored zero, so the fallback did nothing for these books."""
    make_book(title="निर्मला", author="मुंशी प्रेमचंद")
    assert "निर्मला" in _search(client, "nirmalla")


def test_the_aliases_do_not_swamp_a_latin_search(client, make_book):
    """A Hindi book must not start matching unrelated English queries."""
    make_book(title="गोदान", author="मुंशी प्रेमचंद")
    make_book(title="The Great Gatsby", author="F Scott Fitzgerald")
    assert _search(client, "gatsby") == ["The Great Gatsby"]
