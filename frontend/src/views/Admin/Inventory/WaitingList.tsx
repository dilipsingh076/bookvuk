"use client";

/**
 * People are waiting for these.
 *
 * First on the page: this is the list that decides what to order, and every name
 * on it is a customer already subscribed to the back-in-stock notice.
 */

import { Button } from "../../../components/ui";
import type { DemandRow } from "../../../api/admin";

type WaitingListProps = {
  rows: DemandRow[];
  totalWaiting: number;
  onRestock: (bookId: string) => void;
};

const WaitingList = ({ rows, totalWaiting, onRestock }: WaitingListProps) => {
  if (rows.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-bookvuk-navy">People are waiting for these</h2>
          <p className="mt-1 text-sm leading-relaxed text-bookvuk-muted">
            Out of stock, and saved by someone who wanted to buy it. Restock the top of this list
            first — everyone here is emailed automatically the moment it arrives.
          </p>
        </div>
        <div className="shrink-0 rounded-xl bg-white px-4 py-2 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-bookvuk-muted">
            Waiting
          </div>
          <div className="text-lg font-extrabold tabular-nums text-bookvuk-navy">
            {totalWaiting}
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3.5"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-bookvuk-navy">{row.title}</div>
              <div className="mt-0.5 truncate text-xs text-bookvuk-muted">{row.author}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                {row.waiting} waiting
              </span>
              <Button
                type="button"
                onClick={() => onRestock(row.id)}
                variant="primary-fade"
                size="sm"
              >
                Restock
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default WaitingList;
