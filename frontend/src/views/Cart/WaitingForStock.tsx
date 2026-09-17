"use client";

/**
 * Lines that cannot be bought yet.
 *
 * Kept visibly apart and out of the total: these are not part of this order. The
 * checkout leaves them here, still waiting for their restock notice, so nothing
 * is lost by buying the rest.
 */

import { bookCoverSrc } from "../../api/index";
import { formatPrice } from "../../utils/formatPrice";
import Img from "../../components/ui/Img";
import { TrashIcon } from "./icons";
import type { LineItem } from "./types";

type WaitingForStockProps = {
  lines: LineItem[];
  onRemove: (bookId: string) => void;
};

const WaitingForStock = ({ lines, onRemove }: WaitingForStockProps) => {
  if (lines.length === 0) return null;

  return (
    <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
      <h2 className="text-sm font-bold text-bookvuk-navy">Waiting for stock ({lines.length})</h2>
      <p className="mt-1 text-xs leading-relaxed text-bookvuk-muted">
        Not part of this order, and not in the total. We will email you the moment these arrive —
        they stay in your cart until then.
      </p>
      <ul className="mt-4 divide-y divide-amber-200/70">
        {lines.map((it) => (
          <li key={it.bookId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-bookvuk-lilac opacity-60">
              <Img
                src={bookCoverSrc(it.book)}
                alt={`Cover of ${it.book.title}`}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-bookvuk-navy">
                {it.book.title}
              </div>
              <div className="mt-0.5 text-xs text-bookvuk-muted">
                {Number(it.book.stock ?? 0) <= 0
                  ? "Out of stock"
                  : `Only ${it.book.stock} left, you want ${it.qty}`}
              </div>
            </div>
            <div className="shrink-0 text-sm font-semibold tabular-nums text-bookvuk-muted">
              {formatPrice(it.book.price * it.qty)}
            </div>
            <button
              type="button"
              onClick={() => onRemove(it.bookId)}
              aria-label={`Remove ${it.book.title}`}
              className="shrink-0 rounded-lg p-2 text-bookvuk-muted transition hover:bg-white hover:text-rose-700"
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WaitingForStock;
