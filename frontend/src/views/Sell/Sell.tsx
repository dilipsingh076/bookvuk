"use client";

/**
 * Sell a used book to the shop.
 *
 * The quote comes first and needs no account. A student deciding whether to sell
 * last year's course book wants one number, immediately — asking them to register
 * before telling them what it is worth loses most of them at the first step.
 *
 * What the page *does* lives in `useSellFlow`; this is only its shape.
 */

import Link from "next/link";
import { Alert } from "../../components/ui";
import BookPicker from "./BookPicker";
import PriceExplainer from "./PriceExplainer";
import QuotePanel from "./QuotePanel";
import SellConfirmation from "./SellConfirmation";
import { useSellFlow } from "./useSellFlow";

const Sell = () => {
  const f = useSellFlow();

  if (f.done) {
    return <SellConfirmation done={f.done} basket={f.basket} onSellAnother={f.startAnother} />;
  }

  return (
    <div className="pb-20 pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-bookvuk-navy sm:text-4xl">
            Sell your used books
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted sm:text-[15px]">
            Same courses come round every year, so last year&rsquo;s textbook is this year&rsquo;s
            set text. Tell us what you have and see the price straight away — no account needed to
            look.
          </p>
        </div>
        {f.isAuthenticated ? (
          <Link
            href="/sell/requests"
            className="shrink-0 text-sm font-semibold text-bookvuk-purple hover:underline"
          >
            My sell requests →
          </Link>
        ) : null}
      </div>

      {/* Said here, above the form, because this is the only place it can save
          anybody anything. At the cap it is a stop sign; one or two short of it,
          it is a heads-up that the next book may be the last for now. */}
      {f.atCap ? (
        <Alert tone="warning" className="mt-6">
          <span className="font-semibold">
            We already have {f.openCount} of your books in progress.
          </span>{" "}
          That is as many as we can hold at once. As soon as we have graded and paid for some of
          them you can send more —{" "}
          <Link href="/sell/requests" className="font-semibold underline">
            see where they are
          </Link>
          .
        </Alert>
      ) : f.slotsLeft !== null && f.slotsLeft <= 2 ? (
        <Alert tone="info" className="mt-6">
          Room for {f.slotsLeft} more {f.slotsLeft === 1 ? "book" : "books"} before we pause — you
          have {f.openCount} with us already.
        </Alert>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-9">
        <BookPicker flow={f} />
        <QuotePanel flow={f} />
      </div>

      <PriceExplainer conditions={f.conditions} />
    </div>
  );
};

export default Sell;
