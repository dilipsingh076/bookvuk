"use client";

/** Where the balance came from, most recent first. */

import { WALLET_KIND_LABELS, type WalletEntry } from "../../api/buyback";
import { formatPrice } from "../../utils/formatPrice";
import { fmtDate } from "./types";

type CreditLedgerProps = { entries: WalletEntry[] };

const CreditLedger = ({ entries }: CreditLedgerProps) => (
  <section className="mt-6">
    <h2 className="text-lg font-bold text-bookvuk-navy">Where it came from</h2>
    {entries.length === 0 ? (
      <p className="mt-2 text-sm text-bookvuk-muted">No credit has moved in or out yet.</p>
    ) : (
      <ul className="mt-3 divide-y divide-bookvuk-border/70 overflow-hidden rounded-3xl border border-bookvuk-border/80 bg-white">
        {entries.map((e) => {
          const out = e.amount < 0;
          return (
            <li key={e.id} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-bookvuk-navy">
                  {e.note || WALLET_KIND_LABELS[e.kind] || e.kind}
                </div>
                <div className="mt-0.5 text-xs text-bookvuk-muted">{fmtDate(e.createdAt)}</div>
              </div>
              {/* Signed. A ledger where a credit and a redemption look the same
                  cannot be read at all. */}
              <div
                className={`shrink-0 text-sm font-bold tabular-nums ${
                  out ? "text-bookvuk-muted" : "text-emerald-700"
                }`}
              >
                {out ? "−" : "+"}
                {formatPrice(Math.abs(e.amount))}
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

export default CreditLedger;
