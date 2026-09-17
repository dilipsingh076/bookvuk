"use client";

/**
 * Search, and a date range.
 *
 * The range is here because "what went out today" is the question this screen is
 * opened with and no amount of scrolling answers it.
 */

import { Input } from "../../../components/ui";
import type { UseAdminOrders } from "./useAdminOrders";

type OrderSearchProps = Pick<
  UseAdminOrders,
  "q" | "setQ" | "dateFrom" | "setDateFrom" | "dateTo" | "setDateTo"
>;

const OrderSearch = ({
  q,
  setQ,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}: OrderSearchProps) => (
  <div className="mt-5 grid gap-3 rounded-xl border bg-bookvuk-lilac p-4 sm:grid-cols-[1fr_auto_auto]">
    <Input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search by order id, customer, email, status, consignment number"
      className="rounded-lg border-gray-200 px-3 py-2"
    />
    <label className="flex items-center gap-2 text-xs font-semibold text-bookvuk-muted">
      <span className="whitespace-nowrap">From</span>
      <input
        type="date"
        value={dateFrom}
        max={dateTo || undefined}
        onChange={(e) => setDateFrom(e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-bookvuk-navy"
      />
    </label>
    <label className="flex items-center gap-2 text-xs font-semibold text-bookvuk-muted">
      <span className="whitespace-nowrap">To</span>
      <input
        type="date"
        value={dateTo}
        min={dateFrom || undefined}
        onChange={(e) => setDateTo(e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-bookvuk-navy"
      />
    </label>
  </div>
);

export default OrderSearch;
