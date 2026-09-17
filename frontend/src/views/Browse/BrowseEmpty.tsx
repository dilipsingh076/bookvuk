"use client";

/**
 * Nothing matched.
 *
 * The message names what was searched and where, because "No books found" alone
 * does not say whether the term, the category, or the shop is the problem — and
 * the way out differs for each. The buttons offered are exactly the filters that
 * are actually set.
 */

import { colors, illustration } from "../../theme/tokens";

type BrowseEmptyProps = {
  /** The search term as typed, already trimmed; `""` when not searching. */
  searchTrimmed: string;
  /** The active category, or `"all"`. */
  category: string;
  onClearSearch: () => void;
  onAllCategories: () => void;
};

/** Inline art: search + open book (brand lilac / purple). */
const BrowseEmptyIllustration = () => (
  <svg
    viewBox="0 0 280 180"
    className="mx-auto h-36 w-full max-w-[280px] sm:h-40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <ellipse cx="140" cy="168" rx="90" ry="8" fill={colors.lilac} />
    <circle
      cx="88"
      cy="72"
      r="36"
      stroke={illustration.violet300}
      strokeWidth="1.5"
      strokeDasharray="4 4"
      opacity="0.9"
    />
    <path
      d="M88 52v40M72 72h32"
      stroke={colors.purple}
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.35"
    />
    <path
      d="M118 48h84a6 6 0 016 6v72a6 6 0 01-6 6h-84a6 6 0 01-6-6V54a6 6 0 016-6z"
      fill={illustration.paper}
      stroke={colors.purple}
      strokeWidth="1.4"
      strokeOpacity="0.25"
    />
    <path
      d="M130 64h56M130 78h40"
      stroke={illustration.violet400}
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity="0.5"
    />
    <path
      d="M168 100l12 12 20-20"
      stroke={colors.purple}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.4"
    />
  </svg>
);

const BrowseEmpty = ({
  searchTrimmed,
  category,
  onClearSearch,
  onAllCategories,
}: BrowseEmptyProps) => {
  const filtered = category !== "all";

  return (
    <div
      className="relative mt-10 overflow-hidden rounded-2xl border border-bookvuk-border/70 bg-gradient-to-b from-bookvuk-lilac/35 via-white to-bookvuk-cream/40 px-5 py-12 text-center ring-1 ring-bookvuk-purple/[0.06] sm:px-8 sm:py-14"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-bookvuk-purple/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-rose-100/40 blur-3xl"
        aria-hidden
      />
      <div className="relative">
        <BrowseEmptyIllustration />
        <h2 className="mt-4 text-xl font-bold tracking-tight text-bookvuk-navy sm:text-2xl">
          No books found
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted sm:text-[15px]">
          {searchTrimmed && filtered ? (
            <>
              Nothing matches{" "}
              <span className="font-semibold text-bookvuk-navy">“{searchTrimmed}”</span> in{" "}
              <span className="font-semibold text-bookvuk-navy">{category}</span>. Try another
              keyword or category.
            </>
          ) : searchTrimmed ? (
            <>
              We couldn’t find anything for{" "}
              <span className="font-semibold text-bookvuk-navy">“{searchTrimmed}”</span>. Check
              spelling or try a shorter term.
            </>
          ) : filtered ? (
            <>
              There are no books in{" "}
              <span className="font-semibold text-bookvuk-navy">{category}</span> right now. Pick
              another category or search the full catalogue.
            </>
          ) : (
            <>The catalogue has no books to show yet.</>
          )}
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
          {searchTrimmed ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="inline-flex items-center justify-center rounded-2xl bg-bookvuk-purple px-6 py-3 text-sm font-semibold text-white shadow-md shadow-bookvuk-purple/20 transition hover:bg-bookvuk-purple-hover active:scale-[0.99]"
            >
              Clear search
            </button>
          ) : null}
          {filtered ? (
            <button
              type="button"
              onClick={onAllCategories}
              className={`inline-flex items-center justify-center rounded-2xl border border-bookvuk-border bg-white px-6 py-3 text-sm font-semibold text-bookvuk-navy transition hover:border-bookvuk-purple/30 hover:bg-bookvuk-lilac/50 ${
                !searchTrimmed ? "sm:mx-auto" : ""
              }`}
            >
              Show all categories
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BrowseEmpty;
