"use client";

/**
 * Steps two and three: the grade, and how to be paid.
 *
 * All three grades are shown together on purpose. Seeing that admitting to
 * highlighting costs a known amount is what makes people grade honestly, rather
 * than guessing high and having the offer cut when the book arrives.
 */

import { formatPrice } from "../../utils/formatPrice";
import { Alert, Input, SectionHeading, Textarea } from "../../components/ui";
import { Skeleton } from "../../components/ui/Skeleton";
import type { UseSellFlow } from "./useSellFlow";

type QuotePanelProps = { flow: UseSellFlow };

const PAYOUTS: Array<["wallet" | "bank", string]> = [
  ["wallet", "Store credit"],
  ["bank", "UPI / bank"],
];

const QuotePanel = ({ flow: f }: QuotePanelProps) => (
  <section className="rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card sm:p-7">
    <SectionHeading title="2. What shape is it in?" />

    {f.priceBasis === null ? (
      <p className="mt-4 text-sm leading-relaxed text-bookvuk-muted">
        Pick a book on the left and we will show you what each condition is worth.
      </p>
    ) : f.quoting ? (
      <div className="mt-5 space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    ) : f.quote && !f.quote.canSell ? (
      <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
        {f.quote.message ?? "We cannot buy this one."}
      </p>
    ) : f.quote ? (
      <>
        <div className="mt-5 space-y-3">
          {f.quote.options.map((o) => {
            const active = f.condition === o.condition;
            const unavailable = o.offer <= 0;
            return (
              <button
                key={o.condition}
                type="button"
                disabled={unavailable}
                onClick={() => f.setCondition(o.condition)}
                aria-pressed={active}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-bookvuk-purple bg-bookvuk-lilac/40 ring-1 ring-bookvuk-purple/20"
                    : "border-bookvuk-border bg-white hover:border-bookvuk-purple/30"
                } ${unavailable ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-bookvuk-navy">{o.label}</span>
                  <span className="shrink-0 text-base font-extrabold tabular-nums text-bookvuk-navy">
                    {unavailable ? "—" : formatPrice(o.offer)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-bookvuk-muted">
                  {o.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-7 border-t border-bookvuk-border/70 pt-5">
          <h3 className="text-sm font-bold text-bookvuk-navy">3. How should we pay you?</h3>
          <div className="mt-3 flex gap-2">
            {PAYOUTS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => f.setPayoutMethod(value)}
                aria-pressed={f.payoutMethod === value}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  f.payoutMethod === value
                    ? "bg-bookvuk-lilac text-bookvuk-navy"
                    : "bg-zinc-100 text-bookvuk-muted hover:bg-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {f.payoutMethod === "bank" ? (
            <Input
              value={f.payoutUpi}
              onChange={(e) => f.setPayoutUpi(e.target.value)}
              placeholder="yourname@upi"
              aria-label="UPI id"
              className="mt-3"
            />
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-bookvuk-muted">
              Added to your BookVuk credit, which you can spend on any order.
              {/* The balance was only ever shown on /sell/requests — a page away
                  from the one place the choice is actually made. Saying what is
                  already there, and what it stacks to, is the whole argument for
                  taking credit over cash. */}
              {f.wallet && f.chosenOffer && f.wallet.balance > 0 ? (
                <>
                  {" "}
                  You have{" "}
                  <span className="font-semibold text-bookvuk-navy">
                    {formatPrice(f.wallet.balance)}
                  </span>{" "}
                  already — this would make it{" "}
                  <span className="font-semibold text-bookvuk-navy">
                    {formatPrice(f.wallet.balance + f.chosenOffer.offer)}
                  </span>
                  , spendable on up to {f.wallet.maxRedemptionPercent}% of an order.
                </>
              ) : f.wallet && f.chosenOffer ? (
                /* A first-time seller has nothing to stack, and "you have ₹0
                   already" is a worse sentence than not mentioning it. The
                   redemption cap still matters — it is the one condition on the
                   credit — so that part stays. */
                <> Spendable on up to {f.wallet.maxRedemptionPercent}% of any order.</>
              ) : null}
            </p>
          )}

          <Textarea
            value={f.sellerNote}
            onChange={(e) => f.setSellerNote(e.target.value)}
            rows={2}
            placeholder="Anything we should know? (optional)"
            aria-label="Note for us"
            className="mt-3"
          />
        </div>

        {f.error ? (
          <Alert tone="error" className="mt-4">
            {f.error}
          </Alert>
        ) : null}

        <div className="mt-6 rounded-2xl bg-bookvuk-cream p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-bookvuk-navy">You get</span>
            <span className="text-2xl font-extrabold tabular-nums text-bookvuk-navy">
              {f.chosenOffer ? formatPrice(f.chosenOffer.offer) : "—"}
            </span>
          </div>
          {f.quantity > 1 && f.chosenOffer ? (
            <p className="mt-1 text-xs text-bookvuk-muted">
              {f.quantity} copies × {formatPrice(f.chosenOffer.offer / f.quantity)}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={f.submit}
          disabled={!f.ready || f.submitting || f.atCap}
          title={f.atCap ? `We are holding ${f.openCount} of your books already` : undefined}
          className="mt-4 w-full rounded-xl bg-bookvuk-purple py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {f.submitting
            ? "Sending…"
            : f.atCap
              ? "Waiting on your other books"
              : f.condition
                ? "Sell it to BookVuk"
                : "Pick a condition first"}
        </button>
        <p className="mt-2.5 text-center text-xs leading-relaxed text-bookvuk-muted">
          We confirm the condition when the book arrives. If it grades lower, we tell you the new
          amount before paying.
        </p>
      </>
    ) : f.error ? (
      /* A quote the server refused.
       *
       * The Alert above lives inside the `quote` branch, so it only ever showed
       * errors raised *after* a price had been fetched. When the quote itself
       * fails there is no quote, that whole branch renders `null`, and this panel
       * simply went blank — measured: typing an MRP of 9999999 gets a 400 back
       * saying "That printed price looks wrong. The most we can accept is
       * ₹20,000", and the seller was shown nothing at all.
       *
       * The message is already the server's own sentence — `fetchQuote` unwraps
       * `detail` — so it only had to be given somewhere to go. */
      <Alert tone="error" className="mt-4">
        {f.error}
      </Alert>
    ) : null}
  </section>
);

export default QuotePanel;
