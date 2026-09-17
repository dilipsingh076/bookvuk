"use client";

/**
 * The catalogue page.
 *
 * Sidebar of filters, then the results. No full-page spinner: it used to
 * replace the entire page — sidebar, search box, heading and all — so on a slow
 * connection the visitor could not even start typing a search until the first
 * page of books had arrived. Only the grid waits now.
 */

import BookCard from "../../components/BookCard";
import BookCardSkeleton from "../../components/BookCardSkeleton";
import BrowseEmpty from "./BrowseEmpty";
import BrowseFilters from "./BrowseFilters";
import BrowseToolbar from "./BrowseToolbar";
import { useBrowse } from "./useBrowse";
import { formatCount, type BrowseProps } from "./types";

const Browse = (props: BrowseProps) => {
  const b = useBrowse(props);

  return (
    <div className="pb-16 pt-6">
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(260px,280px)_1fr] lg:gap-8 lg:items-start">
        <BrowseFilters
          rows={b.categoryRows}
          active={b.category}
          onCategory={b.setCategory}
          countFor={b.countFor}
          minRating={b.minRating}
          onMinRating={b.setMinRating}
        />

        <main>
          <section
            className="rounded-[24px] bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06] sm:p-7"
            aria-label="Book catalogue"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-bookvuk-navy sm:text-xl">
                  Explore the complete catalogue
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-bookvuk-muted">
                  Discover every title in the store. Search below, filter by category, and sort the
                  way you like.
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-bookvuk-border bg-bookvuk-cream/80 px-4 py-2 text-center sm:text-left">
                <div className="text-xs font-semibold uppercase tracking-wide text-bookvuk-muted">
                  Results
                </div>
                {/* An explicit word, not just the dimming: "Updating…" is what a
                    screen reader announces and what tells a visitor on a slow
                    connection that their filter click was received. The old count
                    is not shown while it is being replaced — it would be wrong. */}
                <div className="text-sm font-bold tabular-nums text-bookvuk-navy" aria-live="polite">
                  {b.loading ? "Updating…" : `${formatCount(b.totalItems)} books`}
                </div>
              </div>
            </div>

            <BrowseToolbar
              search={b.search}
              onSearch={b.setSearch}
              sort={b.sort}
              onSort={b.setSort}
              searching={b.searching}
              condition={b.condition}
              onCondition={b.setCondition}
              usedCount={b.usedCount}
            />

            {b.noResults ? (
              <BrowseEmpty
                searchTrimmed={b.searchTrimmed}
                category={b.category}
                onClearSearch={() => b.setSearch("")}
                onAllCategories={() => b.setCategory("all")}
              />
            ) : (
              /* Three states, because they mean different things to the visitor:
                 nothing yet (placeholders), results that are about to be replaced
                 (dimmed, so a filter click visibly does something), and settled
                 results. Changing a filter used to leave the previous books sitting
                 there with no feedback at all — measured at two full seconds of
                 looking like the click was ignored. */
              <div
                className={`mt-8 grid grid-cols-2 gap-5 transition-opacity duration-200 md:grid-cols-4 md:gap-6 ${
                  b.isRefreshing ? "pointer-events-none opacity-40" : "opacity-100"
                }`}
                aria-busy={b.loading}
              >
                {b.isInitialLoad ? (
                  <BookCardSkeleton count={b.pageSize} />
                ) : (
                  b.pagedRows.map((book, i) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      variant="dashboard"
                      onOpen={b.openDetails}
                      /* The first row is on screen before any scrolling. */
                      priority={i < 4}
                    />
                  ))
                )}
              </div>
            )}

            {b.showPagination && !b.noResults ? (
              <div className="mt-10 flex items-center justify-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => b.setPage(Math.max(1, b.safePage - 1))}
                  disabled={b.safePage <= 1}
                  className="rounded-xl border border-bookvuk-border bg-white px-3.5 py-2 font-semibold text-bookvuk-muted transition-colors hover:bg-zinc-50 disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="min-w-[2.5rem] rounded-xl bg-bookvuk-purple px-3 py-2 text-center text-sm font-bold text-white">
                  {b.safePage}
                </span>
                <span className="px-1 text-sm font-medium text-bookvuk-muted">
                  of {b.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => b.setPage(Math.min(b.totalPages, b.safePage + 1))}
                  disabled={b.safePage >= b.totalPages}
                  className="rounded-xl border border-bookvuk-border bg-white px-3.5 py-2 font-semibold text-bookvuk-muted transition-colors hover:bg-zinc-50 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Browse;
