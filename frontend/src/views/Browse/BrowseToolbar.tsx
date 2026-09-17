"use client";

/**
 * Search, the sort shortcuts, and the sort dropdown.
 *
 * The chips and the dropdown drive the *same* value. They used to hold separate
 * state, so the page could highlight "Popular" while the dropdown read "Sort by
 * relevance" — two controls disagreeing about one list.
 */

import { Select } from "../../components/ui";
import { SORT_CHIPS, SORT_OPTIONS } from "./types";
import type { ServerSort } from "../../api/index";

type BrowseToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  sort: ServerSort;
  onSort: (value: ServerSort) => void;
  /** Whether there is a query for relevance to be relevant *to*. */
  searching: boolean;
  condition: "used" | null;
  onCondition: (value: "used" | null) => void;
  usedCount: number;
};

const BrowseToolbar = ({
  search,
  onSearch,
  sort,
  onSort,
  searching,
  condition,
  onCondition,
  usedCount,
}: BrowseToolbarProps) => (
  <>
    <div className="relative mt-5" role="search">
      <span
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bookvuk-muted"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by title, author, category, or keyword…"
        aria-label="Search catalogue"
        className={`w-full rounded-xl border border-bookvuk-border bg-white py-3 pl-11 text-sm text-bookvuk-navy shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-bookvuk-purple/40 focus:ring-2 focus:ring-bookvuk-purple/15 ${
          search.trim() ? "pr-16" : "pr-3.5"
        }`}
      />
      {search.trim() ? (
        <button
          type="button"
          onClick={() => onSearch("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-bookvuk-muted transition hover:bg-zinc-100 hover:text-bookvuk-navy"
          aria-label="Clear search"
        >
          Clear
        </button>
      ) : null}
    </div>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {/* Second-hand stock, which was unreachable: the endpoint has supported
            `condition=used` all along and nothing called it, so a used copy
            could only be found by first finding the new edition. Hidden when
            there is none — a chip reading "Used 0" is a promise of an empty
            shelf. */}
        {usedCount > 0 ? (
          <button
            type="button"
            onClick={() => onCondition(condition ? null : "used")}
            aria-pressed={condition === "used"}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-[13px] ${
              condition === "used"
                ? "bg-bookvuk-purple text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Used &amp; cheaper
            <span className="ml-1.5 tabular-nums opacity-70">{usedCount}</span>
          </button>
        ) : null}
        {SORT_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onSort(chip.value)}
            aria-pressed={sort === chip.value}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-[13px] ${
              sort === chip.value
                ? "bg-bookvuk-lilac text-bookvuk-navy"
                : "bg-zinc-100 text-bookvuk-muted hover:bg-zinc-200"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <Select
        aria-label="Sort books"
        value={sort}
        onChange={(e) => onSort(e.target.value as ServerSort)}
        className="min-w-[12rem] font-semibold text-bookvuk-navy shadow-sm transition hover:border-bookvuk-purple/30 sm:w-auto"
      >
        {/* Relevance is offered only while there is something to be relevant
            to; the API rejects it without a query. */}
        {searching ? <option value="relevance">Sort by relevance</option> : null}
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  </>
);

export default BrowseToolbar;
