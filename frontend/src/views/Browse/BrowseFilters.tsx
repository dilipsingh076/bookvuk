"use client";

/**
 * The filter sidebar: categories with counts, then rating.
 *
 * The category list is keyboard-navigable as a group — arrows move between
 * rows, Home/End jump to the ends — because it is a list of related choices,
 * not eight unrelated buttons to Tab through.
 */

import { useRef } from "react";
import {
  RATING_FILTERS,
  formatCount,
  type BrowseCategoryKey,
  type CategoryRow,
} from "./types";

type BrowseFiltersProps = {
  rows: CategoryRow[];
  active: BrowseCategoryKey;
  onCategory: (key: BrowseCategoryKey) => void;
  /** `null` while the counts are still unknown, so nothing renders a bare "0". */
  countFor: (key: BrowseCategoryKey) => number | null;
  minRating: number | null;
  onMinRating: (value: number | null) => void;
};

const BrowseFilters = ({
  rows,
  active,
  onCategory,
  countFor,
  minRating,
  onMinRating,
}: BrowseFiltersProps) => {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    /* The filters stay put while the results scroll.
     *
     * Three details make this work, and leaving any of them out looks like
     * "sticky is broken":
     *
     * `lg:items-start` on the parent grid (and `self-start` here) — a grid item
     * stretches to the row's full height by default, so the sidebar was as tall
     * as the results column and had no room to move. Nothing to stick.
     *
     * `top-24` clears the sticky navbar above it. Tuck it to `top-0` and the
     * filters slide under a translucent header.
     *
     * The panel gets its own max height and scroll, because eight categories
     * plus four rating filters is taller than a 720px laptop viewport — and a
     * sticky column taller than the screen has a bottom you can never reach.
     *
     * Only from `lg`: below that the grid is one column and the sidebar sits
     * above the results, where sticking it would cover them. */
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-[24px] bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06] lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <div
          className="text-[15px] font-bold tracking-tight text-bookvuk-navy"
          id="browse-category-heading"
        >
          Browse by category
        </div>
        <div className="mt-4 space-y-1.5" role="group" aria-labelledby="browse-category-heading">
          {rows.map((c, i) => {
            const isActive = active === c.key;
            const last = rows.length - 1;
            const count = countFor(c.key);
            return (
              <button
                key={c.label}
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                type="button"
                onClick={() => onCategory(c.key)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                    e.preventDefault();
                    btnRefs.current[Math.min(i + 1, last)]?.focus();
                  }
                  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    btnRefs.current[Math.max(i - 1, 0)]?.focus();
                  }
                  if (e.key === "Home") {
                    e.preventDefault();
                    btnRefs.current[0]?.focus();
                  }
                  if (e.key === "End") {
                    e.preventDefault();
                    btnRefs.current[last]?.focus();
                  }
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-bookvuk-lilac text-bookvuk-purple"
                    : "text-bookvuk-navy hover:bg-zinc-50"
                }`}
              >
                <span>{c.label}</span>
                <span
                  className={`text-xs tabular-nums ${isActive ? "text-bookvuk-purple/80" : "text-bookvuk-muted"}`}
                >
                  {count === null ? "" : formatCount(count)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 border-t border-bookvuk-navy/10 pt-6">
          <div className="text-[15px] font-bold tracking-tight text-bookvuk-navy">Rating</div>
          <div className="mt-4 space-y-1">
            {RATING_FILTERS.map(({ label, v }) => {
              const isActive = minRating === v;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onMinRating(isActive ? null : v)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-bookvuk-lilac text-bookvuk-purple"
                      : "text-bookvuk-navy hover:bg-zinc-50"
                  }`}
                >
                  <span>{label}</span>
                  {isActive ? <span className="text-xs font-semibold">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default BrowseFilters;
