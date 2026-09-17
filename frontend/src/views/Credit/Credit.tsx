"use client";

/**
 * What the shop owes you, and where it came from.
 *
 * Store credit appeared inside the checkout, the sell form and the sell-request
 * list, and nowhere said what the balance actually was, how it got there, or what
 * could be done with it. The shop holds this money on the customer's behalf and
 * the customer had no page to look at it on.
 *
 * It is also the strongest retention loop the business has — sellers paid in
 * credit come back and spend it — and that loop was invisible to the person it is
 * meant to work on.
 */

import Link from "next/link";
import { Alert, ButtonLink, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatPrice } from "../../utils/formatPrice";
import CreditLedger from "./CreditLedger";
import { useCredit } from "./useCredit";

const Credit = () => {
  const c = useCredit();

  return (
    <div className="py-10">
      <PageHeader
        eyebrow="Your account"
        title="Store credit"
        description="Money we are holding for you. It comes off your next order automatically."
      />

      {c.error ? (
        <Alert tone="error" className="mt-6">
          {c.error}
        </Alert>
      ) : null}

      {c.loading ? (
        <Skeleton className="mt-6 h-32 w-full rounded-3xl" />
      ) : (
        <>
          <section className="mt-6 rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card sm:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-bookvuk-muted">
              Balance
            </div>
            <div className="mt-1 text-4xl font-extrabold tabular-nums text-bookvuk-navy">
              {formatPrice(c.balance)}
            </div>

            {c.balance > 0 ? (
              <>
                {/* The cap is a real constraint on the next order, so saying it
                    here stops the checkout from being where somebody discovers
                    their credit only covers half the bill. */}
                <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">
                  Up to <strong>{c.maxRedemptionPercent}%</strong> of an order can be paid with
                  credit — the rest goes on your usual payment method.
                </p>
                <div className="mt-4">
                  <ButtonLink href="/browse" variant="primary" radius="xl">
                    Spend it
                  </ButtonLink>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-relaxed text-bookvuk-muted">
                  Nothing here yet. Credit arrives when you sell us a book, or when we refund an
                  order.
                </p>
                <div className="mt-4">
                  <ButtonLink href="/sell" variant="primary" radius="xl">
                    Sell a book
                  </ButtonLink>
                </div>
              </>
            )}
          </section>

          <CreditLedger entries={c.entries} />

          <p className="mt-6 text-xs leading-relaxed text-bookvuk-muted">
            Credit does not expire. See{" "}
            <Link
              href="/sell/requests"
              className="font-semibold text-bookvuk-purple hover:underline"
            >
              your sell requests
            </Link>{" "}
            for books still on their way to us.
          </p>
        </>
      )}
    </div>
  );
};

export default Credit;
