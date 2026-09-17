"use client";

/**
 * Search, the page's counts, and the stock tick-boxes.
 *
 * "Total" and "Showing" are separate numbers on purpose: the search is a query
 * and the tick-boxes are a view of the page it returned.
 */

import { Input } from "../../../components/ui";
import { LOW_STOCK } from "./types";
import type { UseManageBooks } from "./useManageBooks";

type BookFiltersProps = { books: UseManageBooks };

const BookFilters = ({ books: b }: BookFiltersProps) => (
  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
    <div className="rounded-xl border bg-bookvuk-lilac p-4">
      <Input
        value={b.q}
        onChange={(e) => b.setQ(e.target.value)}
        placeholder="Search by title, author or category"
        className="rounded-lg border-gray-200 px-3 py-2"
      />
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-white px-3 py-2 text-bookvuk-navy">
          Total: {b.totalCount}
        </span>
        <span className="rounded-full bg-white px-3 py-2 text-bookvuk-navy">
          Showing: {b.shownCount}
        </span>
        <span className="rounded-full bg-white px-3 py-2 text-bookvuk-navy">
          Page: {b.currentPage}/{b.pageCount}
        </span>
      </div>
    </div>
    <div className="rounded-xl border bg-bookvuk-lilac p-4">
      <div className="text-sm font-bold text-bookvuk-navy">Stock</div>
      <div className="mt-2 space-y-2 text-sm text-bookvuk-navy">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={b.onlyInStock}
            onChange={(e) => b.setOnlyInStock(e.target.checked)}
            className="h-4 w-4"
          />
          In stock
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={b.onlyLowStock}
            onChange={(e) => b.setOnlyLowStock(e.target.checked)}
            className="h-4 w-4"
          />
          Low stock (≤ {LOW_STOCK})
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={b.onlyOutOfStock}
            onChange={(e) => b.setOnlyOutOfStock(e.target.checked)}
            className="h-4 w-4"
          />
          Out of stock
        </label>
      </div>
    </div>
  </div>
);

export default BookFilters;
