"use client";

/** One customer's whole history: their figures, their orders, their credit. */

import { LoaderBlock } from "../../../components/ui";
import type { AdminCustomerDetail } from "../../../api/admin";
import { STATUS_TONE, formatDate, formatMoney } from "./types";

type CustomerDetailProps = {
  detail: AdminCustomerDetail | null;
  error: string | null;
};

const CustomerDetail = ({ detail, error }: CustomerDetailProps) => {
  if (error) return <div className="p-6 text-sm text-rose-700">{error}</div>;
  if (!detail) return <LoaderBlock size="md" height="panel" caption="Loading…" />;

  const figures: Array<[string, string]> = [
    ["Orders", String(detail.ordersCount)],
    ["Paid", String(detail.paidOrdersCount)],
    ["Spent", formatMoney(detail.totalSpent)],
    ["Credit held", formatMoney(detail.walletBalance)],
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-bookvuk-lilac p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-bookvuk-muted">
              {label}
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-bookvuk-navy">{value}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-bookvuk-muted">
        {detail.email} · joined {formatDate(detail.createdAt)}
        {detail.buybackCount > 0 ? <> · {detail.buybackCount} buyback requests</> : null}
        {!detail.isActive ? (
          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
            account disabled
          </span>
        ) : null}
      </div>

      <div>
        <div className="text-sm font-semibold text-bookvuk-navy">Orders</div>
        {detail.orders.length === 0 ? (
          <div className="mt-2 text-sm text-bookvuk-muted">This customer has not ordered yet.</div>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border">
            <div className="divide-y bg-white">
              {detail.orders.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-bookvuk-navy">{o.id}</div>
                    <div className="mt-0.5 text-xs text-bookvuk-muted">
                      {formatDate(o.createdAt)}
                      {o.trackingNumber ? (
                        <>
                          {" · "}
                          {o.trackingCarrierLabel} {o.trackingNumber}
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      STATUS_TONE[o.status] ?? "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {o.status}
                  </span>
                  <div className="w-24 text-right font-semibold tabular-nums text-bookvuk-navy">
                    {formatMoney(o.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {detail.walletEntries.length > 0 ? (
        <div>
          <div className="text-sm font-semibold text-bookvuk-navy">Store credit</div>
          <div className="mt-2 overflow-hidden rounded-xl border">
            <div className="divide-y bg-white">
              {detail.walletEntries.map((w) => (
                <div key={w.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="text-bookvuk-navy">{w.note || w.kind}</div>
                    <div className="text-xs text-bookvuk-muted">{formatDate(w.createdAt)}</div>
                  </div>
                  {/* Signed, because a ledger where a redemption and a credit
                      look the same cannot be read at all. */}
                  <div
                    className={`tabular-nums font-semibold ${
                      Number(w.amount) < 0 ? "text-bookvuk-muted" : "text-emerald-700"
                    }`}
                  >
                    {Number(w.amount) < 0 ? "−" : "+"}
                    {formatMoney(Math.abs(Number(w.amount)))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CustomerDetail;
