"use client";

/**
 * One of the two stock lists.
 *
 * Both columns are the same shape, and were written twice — identical markup
 * apart from the heading, the badge and the button's wording.
 */

import { Button, LoaderBlock } from "../../../components/ui";
import type { Book } from "../../../api";

type StockColumnProps = {
  heading: string;
  books: Book[];
  loading: boolean;
  error: unknown;
  /** What to say when the column is empty — which is the good outcome here. */
  emptyText: string;
  actionLabel: string;
  onRestock: (bookId: string) => void;
  /** Out-of-stock rows get the quieter outline button. */
  quiet?: boolean;
};

const StockColumn = ({
  heading,
  books,
  loading,
  error,
  emptyText,
  actionLabel,
  onRestock,
  quiet = false,
}: StockColumnProps) => (
  <div className="overflow-hidden rounded-xl border">
    <div className="bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
      {heading}
    </div>
    <div className="divide-y bg-white">
      {loading ? (
        <LoaderBlock size="md" height="panel" caption="Loading inventory…" />
      ) : error ? (
        <div className="px-4 py-6 text-sm text-rose-700">
          {(error as { message?: string } | undefined)?.message || "Failed to load inventory"}
        </div>
      ) : books.length === 0 ? (
        <div className="px-4 py-6 text-sm text-bookvuk-muted">{emptyText}</div>
      ) : (
        books.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-bookvuk-navy">{b.title}</div>
              <div className="mt-1 text-xs text-bookvuk-muted">by {b.author || "Unknown"}</div>
            </div>
            <div className="flex items-center gap-3">
              {b.stock > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  {b.stock} left
                </span>
              ) : null}
              {quiet ? (
                <button
                  type="button"
                  onClick={() => onRestock(String(b.id))}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-bookvuk-navy"
                >
                  {actionLabel}
                </button>
              ) : (
                <Button
                  type="button"
                  onClick={() => onRestock(String(b.id))}
                  variant="primary-flat"
                  size="xs"
                >
                  {actionLabel}
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default StockColumn;
