"use client";

/**
 * One book, as its own page or as a quick-look dialog over the catalogue.
 *
 * Which one is decided by the intercepting route at `@modal/(.)books/[bookId]`,
 * not here: a client navigation gets the dialog, a fresh load or a shared link
 * gets the page. The body is the same either way; the page adds everything
 * below the fold — reviews, related titles, and what they were looking at last
 * visit — which the dialog deliberately leaves out to stay compact.
 */

import BookReviews from "../../components/BookReviews";
import RecentlyViewed from "../../components/RecentlyViewed";
import RelatedBooks from "../../components/RelatedBooks";
import Modal from "../../components/ui/Modal";
import BookDetailsBody from "./BookDetailsBody";
import { useBookDetails } from "./useBookDetails";
import type { BookDetailsProps } from "./types";

const BookDetails = ({ isModal = false, initialBook = null }: BookDetailsProps) => {
  const details = useBookDetails({ initialBook });
  const { book } = details;
  const body = <BookDetailsBody details={details} isModal={isModal} />;

  if (isModal) {
    return (
      <Modal isOpen={true} onClose={details.close} panelClassName="max-w-4xl">
        <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
          <div className="text-sm font-semibold text-bookvuk-navy">Book Details</div>
          <button
            type="button"
            onClick={details.close}
            className="rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
          >
            Close
          </button>
        </div>
        {body}
      </Modal>
    );
  }

  return (
    <div className="py-10">
      <div className="mb-6">
        <button
          type="button"
          onClick={details.close}
          className="rounded-lg border border-bookvuk-border px-4 py-2 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
        >
          Back
        </button>
      </div>
      <div className="rounded-2xl border border-bookvuk-border bg-white shadow-bookvuk-card">
        {body}
      </div>
      {/* Reviews live on the full page only — the quick-look modal stays compact. */}
      {book ? <BookReviews bookId={String(book.id)} /> : null}

      {/* After the reviews: someone who read them is either buying this book or
          looking for a different one, and this is where that decision happens. */}
      {book ? <RelatedBooks bookId={String(book.id)} /> : null}
      {/* The four titles they shortlisted last visit. Browsing a bookshop is not
          one decision, and every visit used to start from an empty catalogue. */}
      {book ? <RecentlyViewed excludeId={String(book.id)} /> : null}
    </div>
  );
};

export default BookDetails;
