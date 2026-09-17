import useFetch from "../hooks/useFetch";
import { fetchRelatedBooks, type Book } from "../api/index";
import BookCard from "./BookCard";
import BookCardSkeleton from "./BookCardSkeleton";

/**
 * "More like this" on a product page.
 *
 * Without it the page is a dead end: a visitor either buys this exact book or
 * leaves. Books are the category where onward suggestions matter most — someone
 * who finished one Premchand novel wants the next one, and nothing here offered it.
 *
 * Ordering (same author first, then the category) is decided server-side so the
 * rule lives in one place; see `get_related_books`.
 */
type RelatedBooksProps = {
  bookId: string;
  /** Rendered inside the modal variant too, where the heading level differs. */
  headingLevel?: "h2" | "h3";
};

const RelatedBooks = ({ bookId, headingLevel = "h2" }: RelatedBooksProps) => {
  const { data, loading } = useFetch<Book[]>(() => fetchRelatedBooks(bookId, 6), [bookId], {
    cacheKey: `related:${bookId}`,
    ttlMs: 5 * 60_000,
  });

  const books = data ?? [];

  // Nothing to suggest is a normal outcome for a small or one-off category, and an
  // empty "More books like this" heading looks broken. Loading is different: this
  // sits at the bottom of a long page, and returning null meant the strip appeared
  // out of nowhere and shoved the footer down as the reader was reaching it.
  if (!loading && books.length === 0) return null;

  const Heading = headingLevel;

  return (
    <section className="mt-12" aria-labelledby="related-books-heading">
      <Heading
        id="related-books-heading"
        className="text-lg font-bold tracking-tight text-bookvuk-navy sm:text-xl"
      >
        More books like this
      </Heading>
      <p className="mt-1 text-sm text-bookvuk-muted">
        Others by the same author, and more from the same shelf.
      </p>

      <div
        className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6"
        aria-busy={loading}
      >
        {loading ? (
          <BookCardSkeleton count={6} />
        ) : (
          books.map((book) => <BookCard key={book.id} book={book} variant="trending" />)
        )}
      </div>
    </section>
  );
};

export default RelatedBooks;
