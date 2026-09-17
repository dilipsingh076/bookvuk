"use client";

/**
 * An order priced with what is on screen, so the numbers are not abstract.
 *
 * This is the figure the next customer sees — computed from the draft rather
 * than from what is saved, so a rate can be checked before committing to it.
 */

import { SAMPLE_ORDER } from "./types";
import type { UseStoreSettings } from "./useStoreSettings";

type SamplePricingProps = { preview: UseStoreSettings["preview"] };

const money = (n: number) => `₹${n.toFixed(2)}`;

const SamplePricing = ({ preview }: SamplePricingProps) => (
  <div className="mt-6 rounded-xl bg-bookvuk-lilac p-4">
    <div className="text-sm font-semibold text-bookvuk-navy">
      A ₹{SAMPLE_ORDER} order would come to
    </div>
    <div className="mt-2 grid max-w-xs grid-cols-2 gap-y-1 text-sm">
      <span className="text-bookvuk-muted">Books</span>
      <span className="text-right tabular-nums text-bookvuk-navy">{money(preview.books)}</span>
      <span className="text-bookvuk-muted">Shipping</span>
      <span className="text-right tabular-nums text-bookvuk-navy">{money(preview.shipping)}</span>
      <span className="text-bookvuk-muted">Tax</span>
      <span className="text-right tabular-nums text-bookvuk-navy">{money(preview.tax)}</span>
      <span className="mt-1 border-t border-white/70 pt-1 font-semibold text-bookvuk-navy">
        Total
      </span>
      <span className="mt-1 border-t border-white/70 pt-1 text-right font-semibold tabular-nums text-bookvuk-navy">
        {money(preview.total)}
      </span>
    </div>
  </div>
);

export default SamplePricing;
