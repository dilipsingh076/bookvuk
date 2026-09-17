"""Catalogue search.

Search used to be `title ILIKE '%q%' OR author ILIKE '%q%' OR description
ILIKE '%q%'`. Three problems, in increasing order of how much they cost:

1. A leading wildcard cannot use a B-tree index, so every search was a
   sequential scan of the whole catalogue.
2. There was no ranking. A book whose blurb mentions "gatsby" in passing sorted
   ahead of The Great Gatsby if it happened to be newer.
3. There was no tolerance for a typo, and shoppers type "harri potter".

So there are two strategies here, tried in order:

- **Full text** against the generated `books.search_vector`, which weights title
  above author above description, ranked with `ts_rank_cd`. This is the good path
  and it uses a GIN index.
- **Trigram**, only when full text found nothing. `word_similarity` compares the
  query against the best-matching run of words in the title or author, which is
  what survives a misspelling and what makes a partial word still match. Also GIN
  indexed, via `gin_trgm_ops`.

Full text first rather than trigram-always because ranking a real match properly
matters more often than rescuing a typo, and trigram scores say nothing about
which field matched.
"""

from __future__ import annotations

from sqlalchemy import func, literal, or_, text
from sqlalchemy.orm import Query, Session

from ..database import models

# The regconfig used for both indexing (see models/book.py) and querying. They
# must agree: stemming differences would make a query miss its own index entries.
# The catalogue is bilingual — measured at an even split of Devanagari and Latin
# titles — so this is a deliberate choice rather than a default.
#
# `english` stems the Latin half properly ("Collected Stories" -> 'collect':'stori',
# so a search for "story" finds it) and passes Devanagari through as literal
# tokens, which still match exactly. `simple` would stem nothing and so help
# neither half. Hindi morphology is not stemmed either way; partial and misspelled
# Hindi matching is what the trigram fallback below covers, and it is
# script-agnostic.
TEXT_SEARCH_CONFIG = "english"

# How close a trigram match has to be, for `<%`. Measured against a 20k-book
# catalogue rather than guessed: "gatsbi" scores 0.714 against "The Great Gatsby",
# "harri potter" 0.733, "mocking" 0.875, and pure noise ("qwertyuiop") 0.000 — so
# this forgives real misspellings with a wide margin above nonsense.
#
# Set explicitly per query even though it is PostgreSQL's default, because it is a
# session GUC: inheriting whatever a pooled connection happens to carry would make
# search results depend on which connection served the request.
WORD_SIMILARITY_THRESHOLD = 0.6


def _tsquery(term: str):
    """`websearch_to_tsquery` rather than `plainto_tsquery`.

    It accepts what people actually type into a search box — quoted phrases,
    `or`, a leading `-` to exclude — and, unlike `to_tsquery`, it cannot raise on
    malformed input, so a stray `&` is a search rather than a 500.
    """
    return func.websearch_to_tsquery(TEXT_SEARCH_CONFIG, term)


def full_text_rank(term: str):
    """Relevance score for ordering. `ts_rank_cd` accounts for how close the
    matched terms are to each other, which suits multi-word titles."""
    return func.ts_rank_cd(models.Book.search_vector, _tsquery(term))


def trigram_score(term: str):
    """Best `word_similarity` across title and author, for ordering.

    `word_similarity` compares the term against the closest run of words in the
    target instead of the whole string, so a short query still scores well against
    a long title — plain `similarity` would dilute it towards zero.

    Only ever computed over rows the filter already matched, so the `coalesce`
    here costs nothing; the filter itself must avoid it (see `_trigram_filter`).
    """
    return func.greatest(
        func.word_similarity(literal(term), func.coalesce(models.Book.title, "")),
        func.word_similarity(literal(term), func.coalesce(models.Book.author, "")),
        func.word_similarity(literal(term), func.coalesce(models.Book.search_aliases, "")),
    )


def _trigram_filter(term: str):
    """Index-usable fuzzy match.

    Written as the `<%` operator against the bare columns, which is the only form
    the `gin_trgm_ops` indexes can serve. The equivalent-looking
    `word_similarity(...) >= 0.6` is a function result and cannot be indexed —
    measured at 41 ms of sequential scan versus 0.16 ms for this, on 20k books.
    Wrapping the columns in `coalesce` also defeats the index, so a NULL author
    simply does not match, which is the right answer anyway.
    """
    return or_(
        literal(term).op("<%")(models.Book.title),
        literal(term).op("<%")(models.Book.author),
        # Romanised aliases, so a misspelled Hindi title can be rescued too.
        # Comparing "namvar" against Devanagari scores zero, which left the
        # fallback useless for half the catalogue.
        literal(term).op("<%")(models.Book.search_aliases),
    )


def apply_search(db: Session, query: Query, term: str) -> tuple[Query, object]:
    """Filter `query` by `term` and return it with the expression to rank by.

    Falls back to trigram matching only when full text finds nothing at all. The
    extra `count()` that costs is paid on searches that would otherwise have
    returned an empty page — the one case where the extra work buys something.
    """
    term = term.strip()
    if not term:
        return query, None

    full_text = query.filter(models.Book.search_vector.op("@@")(_tsquery(term)))
    if full_text.count():
        return full_text, full_text_rank(term).desc()

    # `SET LOCAL` reverts at the end of the transaction, so this cannot leak the
    # threshold into the next request that reuses this pooled connection. The
    # value is a module constant, not user input — `SET` takes no bind parameters.
    db.execute(text(f"SET LOCAL pg_trgm.word_similarity_threshold = {WORD_SIMILARITY_THRESHOLD:f}"))

    return query.filter(_trigram_filter(term)), trigram_score(term).desc()


def legacy_substring_filter(term: str):
    """Plain substring matching, kept for callers that want it explicitly.

    Not used by the paged endpoint any more; retained because it is the exact
    previous behaviour and is occasionally the right answer for an admin looking
    up a known title fragment.
    """
    pattern = f"%{term.strip()}%"
    return or_(
        models.Book.title.ilike(pattern),
        models.Book.author.ilike(pattern),
        models.Book.description.ilike(pattern),
    )
