"use client";

/**
 * The buyback queue.
 *
 * Shaped like the orders screen, because the shop's question is the same one:
 * not "show me everything" but "what is waiting on me". This queue has more
 * stages than orders, which makes the lenses matter more, not less — a request
 * sitting in `approved` is waiting on a parcel, and one in `received` is waiting
 * on money, and those are different jobs on different days.
 */

import Modal from "../../../components/ui/Modal";
import StatusBadge from "../../../components/admin/StatusBadge";
import { Button, LoaderBlock } from "../../../components/ui";
import { CONDITION_LABELS, needsCatalogueParent } from "../../../api/admin";
import BuybackDetail from "./BuybackDetail";
import { useBuyback } from "./useBuyback";
import { EMPTY_TEXT, LENS_LABELS, STATUS_TONE, formatMoney } from "./types";

const Buyback = () => {
  const q = useBuyback();

  return (
    <>
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Buyback</div>
              <div className="mt-1 text-sm text-bookvuk-muted">
                Books customers have offered to sell the shop.
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
            {LENS_LABELS.map(([key, label]) => (
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
                  {q.counts?.[key] ?? "—"}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-5">Book</div>
              <div className="col-span-3">Seller</div>
              <div className="col-span-2">Quote</div>
              <div className="col-span-2">State</div>
            </div>
            <div className="divide-y bg-white">
              {q.loading ? (
                <LoaderBlock size="md" height="panel" caption="Loading buyback queue…" />
              ) : q.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(q.error as { message?: string } | undefined)?.message ||
                    "Failed to load the buyback queue"}
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
                      <div className="truncate font-semibold text-bookvuk-navy">{r.title}</div>
                      <div className="mt-1 truncate text-xs text-bookvuk-muted">
                        {r.author || "unknown author"} · {CONDITION_LABELS[r.condition]} ·{" "}
                        {r.quantity > 1 ? `${r.quantity} copies` : "1 copy"}
                      </div>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <div className="truncate text-bookvuk-navy">{r.seller_name || "Seller"}</div>
                      <div className="mt-1 truncate text-xs text-bookvuk-muted">
                        {r.seller_email}
                      </div>
                    </div>
                    <div className="col-span-2 font-semibold tabular-nums text-bookvuk-navy">
                      {formatMoney(r.final_amount ?? r.quoted_amount)}
                      {r.final_amount != null &&
                      Number(r.final_amount) !== Number(r.quoted_amount) ? (
                        <div className="text-xs font-normal text-bookvuk-muted line-through">
                          {formatMoney(r.quoted_amount)}
                        </div>
                      ) : null}
                    </div>
                    <div className="col-span-2 flex flex-wrap items-start gap-1.5">
                      <StatusBadge tone={STATUS_TONE[r.status] ?? "bg-zinc-100 text-zinc-700"}>
                        {r.status}
                      </StatusBadge>
                      {needsCatalogueParent(r) && r.status === "received" ? (
                        /* The payout endpoint refuses without a parent, so flag
                           it in the list rather than at the point of failure. */
                        <StatusBadge tone="bg-amber-50 text-amber-700 ring-1 ring-amber-300">
                          needs title
                        </StatusBadge>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {q.meta && q.meta.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <div className="tabular-nums text-bookvuk-muted">
                Page {q.meta.page} of {q.meta.pages} · {q.meta.total} requests
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  radius="lg"
                  disabled={q.meta.page <= 1 || q.loading}
                  onClick={q.prevPage}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  radius="lg"
                  disabled={q.meta.page >= q.meta.pages || q.loading}
                  onClick={q.nextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal isOpen={!!q.detail} onClose={q.close} panelClassName="max-w-3xl">
        {q.detail ? (
          <>
            <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-bookvuk-navy">
                  {q.detail.title}
                </div>
                <div className="mt-0.5 text-xs text-bookvuk-muted">{q.detail.id}</div>
              </div>
              <button
                type="button"
                onClick={q.close}
                className="shrink-0 rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
              >
                Close
              </button>
            </div>

            <BuybackDetail detail={q.detail} queue={q} />
          </>
        ) : null}
      </Modal>
    </>
  );
};

export default Buyback;
