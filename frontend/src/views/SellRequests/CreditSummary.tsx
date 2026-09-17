"use client";

/**
 * The credit balance and where it came from.
 *
 * First on the page: it is the reason most people are on it. The ledger below
 * the number is what makes the number believable — a balance with no entries
 * behind it is a figure the seller has to take on trust.
 */

import { WALLET_KIND_LABELS, type Wallet } from "../../api/buyback";
import { formatPrice } from "../../utils/formatPrice";
import { Skeleton } from "../../components/ui/Skeleton";
import { fmtDate } from "./types";

type CreditSummaryProps = {
  wallet: Wallet | null;
  loading: boolean;
};

const CreditSummary = ({ wallet, loading }: CreditSummaryProps) => (
  <section className="mt-8 rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-bookvuk-muted">
          Your BookVuk credit
        </h2>
        <div className="mt-2 text-3xl font-extrabold tabular-nums text-bookvuk-navy">
          {loading ? <Skeleton className="h-9 w-28" /> : formatPrice(wallet?.balance ?? 0)}
        </div>
      </div>
      {wallet && wallet.balance > 0 ? (
        <p className="max-w-xs text-xs leading-relaxed text-bookvuk-muted">
          Spend it at checkout — up to {wallet.maxRedemptionPercent}% of any order.
        </p>
      ) : null}
    </div>

    {wallet && wallet.entries.length > 0 ? (
      <ul className="mt-6 divide-y divide-bookvuk-border/70 border-t border-bookvuk-border/70">
        {wallet.entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-bookvuk-navy">
                {WALLET_KIND_LABELS[e.kind] ?? e.kind}
              </div>
              <div className="mt-0.5 truncate text-xs text-bookvuk-muted">
                {e.note} · {fmtDate(e.createdAt)}
              </div>
            </div>
            <div
              className={`shrink-0 text-sm font-bold tabular-nums ${
                e.amount >= 0 ? "text-emerald-700" : "text-bookvuk-navy"
              }`}
            >
              {e.amount >= 0 ? "+" : "−"}
              {formatPrice(Math.abs(e.amount))}
            </div>
          </li>
        ))}
      </ul>
    ) : null}
  </section>
);

export default CreditSummary;
