"use client";

/**
 * Three shortcuts that work from any page.
 *
 * Here rather than in a help article because the things worth knowing about this
 * shop are all one tap away, and nobody opens help to find out that the heart
 * saves a book.
 */

const HomeTips = () => (
  <section className="mt-8 rounded-[24px] bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06] sm:p-8">
    <h2 className="text-lg font-bold tracking-tight text-bookvuk-navy sm:text-xl">
      Make the most of BookVuk
    </h2>
    <p className="mt-1 text-sm text-bookvuk-muted">
      Shortcuts that work from any page—no need to hunt for the same button twice.
    </p>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl bg-bookvuk-lilac/60 p-5 ring-1 ring-bookvuk-navy/[0.06]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-bookvuk-purple shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-bold text-bookvuk-navy">Search the catalogue</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">
          On Browse, use the search box to filter by title, author, category, or keyword—results
          update as you type.
        </p>
      </div>
      <div className="rounded-2xl bg-bookvuk-cream/80 p-5 ring-1 ring-bookvuk-navy/[0.06]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-bookvuk-purple shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21s-7-4.4-9.5-9A5.7 5.7 0 0 1 12 6a5.7 5.7 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-bold text-bookvuk-navy">Heart what you like</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">
          Save books to your wishlist while you decide—pick them up later from the heart icon.
        </p>
      </div>
      <div className="rounded-2xl bg-bookvuk-lilac/40 p-5 ring-1 ring-bookvuk-navy/[0.06]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-bookvuk-purple shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5 3H2"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-bold text-bookvuk-navy">Cart when ready</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">
          Add from any card, review in Cart, then checkout—your counts show in the tiles above.
        </p>
      </div>
    </div>
  </section>
);

export default HomeTips;
