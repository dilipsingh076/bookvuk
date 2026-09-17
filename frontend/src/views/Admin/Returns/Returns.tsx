"use client";

/**
 * Claims that a book arrived wrong.
 *
 * Before this, "it arrived torn" was an e-mail: a refund decided with no record
 * of what was claimed, what was seen, or what was paid back. On second-hand
 * stock that happens often enough to matter, and it is exactly the stock where a
 * buyer most needs to believe the shop will put it right.
 */

import Modal from "../../../components/ui/Modal";
import { LoaderBlock } from "../../../components/ui";
import { RETURN_REASON_LABELS, type ReturnReason } from "../../../api/returns";
import StatusBadge from "../../../components/admin/StatusBadge";
import ReturnDetail from "./ReturnDetail";
import { useReturns } from "./useReturns";
import { EMPTY_TEXT, STATUS_TONE, formatMoney, type ReturnLens } from "./types";

const LENSES: Array<[ReturnLens, string]> = [
  ["todo", "To decide"],
  ["topay", "To refund"],
  ["all", "All returns"],
];

const Returns = () => {
  const q = useReturns();

  return (
    <>
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Returns</div>
              <div className="mt-1 text-sm text-bookvuk-muted">
                Books that arrived wrong, and what was done about them.
              </div>
            </div>
            <button
              type="button"
              onClick={q.refresh}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {LENSES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => q.setLens(key)}
                aria-pressed={q.lens === key}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  q.lens === key
                    ? "bg-bookvuk-purple text-white shadow-sm"
                    : "bg-bookvuk-lilac text-bookvuk-navy hover:bg-bookvuk-lilac/70"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    q.lens === key ? "bg-white/20" : "bg-white text-bookvuk-muted"
                  }`}
                >
                  {q.lenses[key].length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-5">Book &amp; reason</div>
              <div className="col-span-3">Customer</div>
              <div className="col-span-2">Line</div>
              <div className="col-span-2">State</div>
            </div>
            <div className="divide-y bg-white">
              {q.loading ? (
                <LoaderBlock size="md" height="panel" caption="Loading returns…" />
              ) : q.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(q.error as Error)?.message || "Failed to load returns"}
                </div>
              ) : q.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">{EMPTY_TEXT[q.lens]}</div>
              ) : (
                q.rows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => q.open(r)}
                    className="grid w-full grid-cols-12 gap-2 px-4 py-4 text-left text-sm hover:bg-bookvuk-lilac/40"
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="truncate font-semibold text-bookvuk-navy">
                        {r.book_title || "Item"}
                      </div>
                      <div className="mt-1 truncate text-xs text-bookvuk-muted">
                        {RETURN_REASON_LABELS[r.reason as ReturnReason] ?? r.reason}
                        {r.photos.length > 0
                          ? ` · ${r.photos.length} photo${r.photos.length > 1 ? "s" : ""}`
                          : " · no photo"}
                      </div>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <div className="truncate text-bookvuk-navy">
                        {r.customer_name || "Customer"}
                      </div>
                      <div className="mt-1 truncate text-xs text-bookvuk-muted">
                        {r.customer_email}
                      </div>
                    </div>
                    <div className="col-span-2 font-semibold tabular-nums text-bookvuk-navy">
                      {formatMoney(r.line_total)}
                    </div>
                    <div className="col-span-2 flex flex-wrap items-start gap-1.5">
                      <StatusBadge tone={STATUS_TONE[r.status] ?? "bg-zinc-100 text-zinc-700"}>
                        {r.status}
                      </StatusBadge>
                      {r.order_payment_status && r.order_payment_status !== "paid" ? (
                        <StatusBadge tone="bg-rose-100 text-rose-700">unpaid order</StatusBadge>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={!!q.detail} onClose={q.close} panelClassName="max-w-2xl">
        {q.detail ? (
          <>
            <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-bookvuk-navy">
                  {q.detail.book_title}
                </div>
                <div className="mt-0.5 text-xs text-bookvuk-muted">
                  {q.detail.customer_name} · {q.detail.customer_email}
                </div>
              </div>
              <button
                type="button"
                onClick={q.close}
                className="shrink-0 rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
              >
                Close
              </button>
            </div>

            <ReturnDetail detail={q.detail} q={q} />
          </>
        ) : null}
      </Modal>
    </>
  );
};

export default Returns;
