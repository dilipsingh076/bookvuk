"use client";

/**
 * "You own this. We will buy it back for ₹X."
 *
 * The supply side of the used-book business was entirely opt-in: a seller had to
 * think of it, find `/sell`, and type the book in. That is why 2 of 200 titles
 * have a second-hand copy — not because nobody would sell, but because nobody
 * was ever asked.
 *
 * `order_items` already records exactly what every customer owns and what it was
 * worth. So the shop can ask, on the page where they are looking at the book
 * they finished reading, with the price already worked out.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchSellBackOffers, type SellBackOffer } from "../api/discovery";
import { useAuth } from "../context/AuthContext";
import { formatPrice } from "../utils/formatPrice";

type SellBackOffersProps = {
  /** Show only these books — the order page passes the lines on that order. */
  onlyBookIds?: string[];
  /** Most pages want a couple; the orders list wants a few more. */
  limit?: number;
};

const SellBackOffers = ({ onlyBookIds, limit = 3 }: SellBackOffersProps) => {
  const { isAuthenticated, getToken } = useAuth();
  const [rows, setRows] = useState<SellBackOffer[]>([]);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setRows(await fetchSellBackOffers(getToken()));
    } catch {
      // An offer that cannot load must not take the orders page with it.
      setRows([]);
    }
  }, [isAuthenticated, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = rows
    .filter((r) => !r.alreadyOffered)
    .filter((r) => !onlyBookIds || onlyBookIds.includes(r.bookId))
    .slice(0, limit);

  if (shown.length === 0) return null;

  const total = shown.reduce((sum, r) => sum + r.offer, 0);

  return (
    <section className="mt-6 rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-bookvuk-navy">Finished with these?</h2>
        {shown.length > 1 ? (
          <span className="rounded-full bg-bookvuk-lilac px-2.5 py-1 text-xs font-bold text-bookvuk-purple">
            UP TO {formatPrice(total)} BACK
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-bookvuk-muted">
        We buy books back as store credit. These are the ones you have bought from
        us — the price below assumes a copy in good condition.
      </p>

      <ul className="mt-4 space-y-2.5">
        {shown.map((r) => (
          <li
            key={r.bookId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bookvuk-lilac/50 p-3.5"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-bookvuk-navy">{r.title}</div>
              <div className="mt-0.5 text-xs text-bookvuk-muted">
                you paid {formatPrice(r.paid)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-extrabold tabular-nums text-bookvuk-navy">
                  {formatPrice(r.offer)}
                </div>
                <div className="text-[11px] text-bookvuk-muted">as credit</div>
              </div>
              {/* Straight into the sell flow with the book already chosen: the
                  step that loses people is typing the title and the price. */}
              <Link
                href={`/sell?book=${encodeURIComponent(r.bookId)}`}
                className="rounded-lg bg-bookvuk-purple px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              >
                Sell it back
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-bookvuk-muted">
        We confirm the condition when it reaches us. Grading it honestly keeps the
        amount the same.
      </p>
    </section>
  );
};

export default SellBackOffers;
