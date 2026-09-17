"use client";

/**
 * How the price is worked out.
 *
 * The rates, stated plainly. A seller who can see the arithmetic can check the
 * offer themselves, which is the difference between a price and a haggle.
 */

import type { ConditionInfo } from "../../api/buyback";

type PriceExplainerProps = { conditions: ConditionInfo[] };

const PriceExplainer = ({ conditions }: PriceExplainerProps) => {
  if (conditions.length === 0) return null;

  return (
    <section className="mt-10 rounded-3xl border border-bookvuk-border/80 bg-white p-6 sm:p-7">
      <h2 className="text-base font-bold text-bookvuk-navy">How the price is worked out</h2>
      <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted">
        A share of the price printed on the book, by condition. We resell it below the price of a
        new copy, which is why students buy from us.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {conditions.map((c) => (
          <li key={c.value} className="rounded-2xl bg-bookvuk-cream p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-bookvuk-navy">{c.label}</span>
              <span className="text-sm font-extrabold text-bookvuk-purple">
                {c.buybackPercent}%
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">{c.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PriceExplainer;
