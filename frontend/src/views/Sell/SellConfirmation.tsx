"use client";

/**
 * The screen after a book has been offered.
 *
 * Its own component because it is a different page with a different job: the
 * form is about deciding, this is about what happens next — add photos, add
 * another book, and what the sitting has come to so far. Inside `Sell.tsx` it
 * was an 80-line early return that the form's markup had to be scrolled past.
 */

import Link from "next/link";
import { formatPrice } from "../../utils/formatPrice";
import { Button } from "../../components/ui";
import type { BasketEntry, SubmittedRequest } from "./types";

type SellConfirmationProps = {
  done: SubmittedRequest;
  /** Everything offered in this sitting, including `done`. */
  basket: BasketEntry[];
  /** Clear the form for the next book, keeping the basket. */
  onSellAnother: () => void;
};

const SellConfirmation = ({ done, basket, onSellAnother }: SellConfirmationProps) => {
  return (
  <div className="py-16 text-center">
    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700">
      ✓
    </div>
    <h1 className="mt-5 text-2xl font-bold tracking-tight text-bookvuk-navy sm:text-3xl">
      We would like to buy it
    </h1>
    <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted sm:text-[15px]">
      Offer for <span className="font-semibold text-bookvuk-navy">{done.title}</span>:{" "}
      <span className="font-bold text-bookvuk-navy">{formatPrice(done.amount)}</span>.
    </p>

    {/* The photographs. Asked for here because this is the one moment the
        book is still in their hands — and because without them we grade on a
        description, re-grade on arrival, and the amount they were promised
        changes. */}
    <p className="mx-auto mt-4 max-w-md rounded-2xl bg-bookvuk-lilac px-4 py-3 text-sm leading-relaxed text-bookvuk-navy">
      <span className="font-semibold">Add a photo or two</span> — cover, spine, and
      anything worn. It lets us confirm the grade before you post it, so the
      amount does not change later.
    </p>

    {/* What this sitting has come to. A shelf-clearer is on book four of
        twelve and the flow used to forget the first three. */}
    {basket.length > 1 ? (
      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-bookvuk-border/80 bg-white p-4 text-left">
        <div className="text-xs font-bold uppercase tracking-wide text-bookvuk-muted">
          Offered today
        </div>
        <ul className="mt-2 space-y-1">
          {basket.map((b) => (
            <li key={b.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-bookvuk-navy">{b.title}</span>
              <span className="shrink-0 tabular-nums text-bookvuk-muted">
                {formatPrice(b.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-bookvuk-border pt-2 text-sm font-bold text-bookvuk-navy">
          <span>{basket.length} books</span>
          <span className="tabular-nums">
            {formatPrice(basket.reduce((sum, b) => sum + b.amount, 0))}
          </span>
        </div>
      </div>
    ) : null}

    <p className="mt-4 text-sm leading-relaxed text-bookvuk-muted">
      We will confirm the condition when the {basket.length > 1 ? "books reach" : "book reaches"} us,
      and pay you then.
    </p>

    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Link
        href="/sell/requests"
        className="rounded-xl bg-bookvuk-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Add photos &amp; track
      </Link>
      <Button
        type="button"
        onClick={onSellAnother}
        variant="secondary" size="lg" radius="xl"
      >
        {basket.length > 1 ? "Add one more" : "Sell another book"}
      </Button>
    </div>
  </div>
  );
};

export default SellConfirmation;
