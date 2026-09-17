"use client";

import useFetch from "../hooks/useFetch";
import { fetchUsedCopies, type BookCondition } from "../api/buyback";
import { type Book } from "../api/index";
/* From `lib/conditions`, shared with the sell flow: a seller grading their book
   and a buyer reading that grade must be shown the same sentence. */
import { CONDITION_BLURBS, CONDITION_LABELS, USED_GUARANTEE } from "../lib/conditions";
import UsedCopyAlert from "./UsedCopyAlert";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../utils/formatPrice";
import { Skeleton } from "../components/ui/Skeleton";
import { Button } from "../components/ui";
import Link from "next/link";

/**
 * Second-hand copies of the book being viewed.
 *
 * This is where the choice between a new copy and a cheaper used one actually gets
 * made, so the alternatives belong on the product page rather than on a separate
 * "used books" section nobody visits. The saving is stated in rupees and percent
 * because that is the whole argument for buying one.
 */
type UsedCopiesProps = {
  /** The catalogue title being viewed. */
  bookId: string;
  /** Its new price, to work the saving out against. */
  newPrice: number;
  /** Shown in the "no copy yet" state, which names the book. */
  title: string;
};

/* From `lib/conditions`, shared with the sell flow. A seller grading their book
   and a buyer reading that grade have to be shown the same sentence, or every
   re-grade becomes an argument neither side can settle. */

const UsedCopies = ({ bookId, newPrice, title }: UsedCopiesProps) => {
  const { addToCart } = useCart();
  const { data, loading } = useFetch<Book[]>(() => fetchUsedCopies(bookId), [bookId], {
    cacheKey: `used:${bookId}`,
    ttlMs: 60_000,
  });

  const copies = (data ?? []).filter((c) => (c.condition ?? "new") !== "new");

  if (loading) {
    return (
      <section className="mt-6 rounded-2xl border border-bookvuk-border/80 bg-white p-5" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </section>
    );
  }

  /* No used stock is the normal case — 2 of 200 titles have a copy — and this
     is where the page used to simply end. An empty "Save with a used copy"
     heading would be worse than nothing, but so is silence: the person reading
     this wanted a cheaper copy, and they are exactly who the shop needs to hear
     from. */
  if (copies.length === 0) {
    return <UsedCopyAlert bookId={bookId} title={title} newPrice={newPrice} />;
  }

  const cheapest = Math.min(...copies.map((c) => c.price));
  const saving = newPrice > 0 ? Math.round((1 - cheapest / newPrice) * 100) : 0;

  return (
    <section
      className="mt-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5"
      aria-labelledby="used-copies-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="used-copies-heading" className="text-sm font-bold text-bookvuk-navy">
          Save with a used copy
        </h2>
        {saving > 0 ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
            up to {saving}% off
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">
        Bought back from readers and checked by us before it goes on the shelf.
      </p>

      <ul className="mt-4 space-y-2.5">
        {copies.map((copy) => {
          const condition = (copy.condition ?? "good") as BookCondition;
          const off = newPrice > 0 ? Math.round((1 - copy.price / newPrice) * 100) : 0;
          return (
            <li
              key={copy.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bookvuk-border/80 bg-white p-3.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-bookvuk-navy">
                    {CONDITION_LABELS[condition] ?? condition}
                  </span>
                  {off > 0 ? (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {off}% off
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-bookvuk-muted">
                  {CONDITION_BLURBS[condition]}
                </p>
                {/* Used stock is genuinely scarce — usually one copy — so saying so
                    is information rather than a pressure tactic. */}
                {copy.stock <= 2 ? (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">
                    only {copy.stock} left
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="text-base font-extrabold tabular-nums text-bookvuk-navy">
                    {formatPrice(copy.price)}
                  </div>
                  {off > 0 ? (
                    <div className="text-[11px] text-bookvuk-muted line-through">
                      {formatPrice(newPrice)}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  onClick={() => addToCart(copy)}
                  variant="primary-fade" size="sm"
                >
                  Add used
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* What every grade guarantees, whatever the adjective says. "Good" is a
          judgement and judgements differ; "nothing missing, nothing unreadable"
          is a promise — and it is what makes a used book buyable sight-unseen. */}
      <p className="mt-4 rounded-xl bg-emerald-50/70 px-3 py-2.5 text-xs leading-relaxed text-emerald-900">
        {USED_GUARANTEE}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-bookvuk-muted">
        Got a copy you have finished with?{" "}
        <Link href="/sell" className="font-semibold text-bookvuk-purple hover:underline">
          Sell it to us
        </Link>
        .
      </p>
    </section>
  );
};

export default UsedCopies;
