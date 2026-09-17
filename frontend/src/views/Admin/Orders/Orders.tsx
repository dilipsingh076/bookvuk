"use client";

/** The order queue: what needs doing now, then everything else. */

import Modal from "../../../components/ui/Modal";
import ShipDialog from "../../../components/admin/ShipDialog";
import { Button, LoaderBlock } from "../../../components/ui";
import StatusBadge from "../../../components/admin/StatusBadge";
import OrderDetailPanel from "./OrderDetailPanel";
import OrderSearch from "./OrderSearch";
import { useAdminOrders } from "./useAdminOrders";
import { LENS_LABELS, STATUS_TONE, formatMoney, paymentLabel, paymentTone } from "./types";

const Orders = () => {
  const o = useAdminOrders();

  return (
    <>
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Orders</div>
              <div className="mt-1 text-sm text-bookvuk-muted">
                Work through what needs doing, then search the rest.
              </div>
            </div>
            <button
              type="button"
              onClick={o.refresh}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
            >
              Refresh
            </button>
          </div>

          <OrderSearch
            q={o.q}
            setQ={o.setQ}
            dateFrom={o.dateFrom}
            setDateFrom={o.setDateFrom}
            dateTo={o.dateTo}
            setDateTo={o.setDateTo}
          />

          {/* Counts, not just filters: a tab reading "Cash to collect 3" is the
              shop's to-do list. Zero is worth showing too — it answers "is
              anything outstanding?" without a search. */}
          <div className="mt-5 flex flex-wrap gap-2">
            {LENS_LABELS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => o.setLens(key)}
                aria-pressed={o.lens === key}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  o.lens === key
                    ? "bg-bookvuk-purple text-white shadow-sm"
                    : "bg-bookvuk-lilac text-bookvuk-navy hover:bg-bookvuk-lilac/70"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    o.lens === key ? "bg-white/20" : "bg-white text-bookvuk-muted"
                  }`}
                >
                  {o.counts ? o.counts[key] : "—"}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
              <div className="col-span-4">Order</div>
              <div className="col-span-3">Customer</div>
              <div className="col-span-2">Total</div>
              <div className="col-span-3">State</div>
            </div>
            <div className="divide-y bg-white">
              {o.loading ? (
                <LoaderBlock size="md" height="panel" caption="Loading orders…" />
              ) : o.error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(o.error as Error)?.message || "Failed to load orders"}
                </div>
              ) : o.rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-bookvuk-muted">No orders found.</div>
              ) : (
                /* Already newest-first from the server, which is also the only
                   order the paging is consistent with — re-sorting a page here
                   would shuffle rows within it and mean nothing across pages. */
                o.rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => o.open(row)}
                    className="grid w-full grid-cols-12 gap-2 px-4 py-4 text-left text-sm hover:bg-bookvuk-lilac/40"
                  >
                    <div className="col-span-4">
                      <div className="font-semibold text-bookvuk-navy">{row.id}</div>
                      <div className="mt-1 text-xs text-bookvuk-muted">
                        {new Date(row.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {row.trackingNumber ? (
                          <>
                            {" · "}
                            {row.trackingCarrierLabel} {row.trackingNumber}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="font-semibold text-bookvuk-navy">{row.customerName}</div>
                      <div className="mt-1 text-xs text-bookvuk-muted">{row.customerEmail}</div>
                    </div>
                    <div className="col-span-2 font-semibold tabular-nums text-bookvuk-navy">
                      {formatMoney(Number(row.total ?? 0))}
                    </div>
                    {/* Two facts, not one. Fulfilment and payment move
                        independently — a shipped order can still be unpaid — and
                        the old single badge could only show one of them. */}
                    <div className="col-span-3 flex flex-wrap items-start gap-1.5">
                      <StatusBadge tone={STATUS_TONE[row.status] ?? "bg-zinc-100 text-zinc-700"}>
                        {row.status}
                      </StatusBadge>
                      <StatusBadge tone={paymentTone(row)}>{paymentLabel(row)}</StatusBadge>
                      {row.paymentMode === "test" ? (
                        /* One database serves both modes, so a rehearsal has to
                           be visibly a rehearsal or it lands in the revenue. */
                        <StatusBadge tone="bg-amber-50 text-amber-700 ring-1 ring-amber-300">test</StatusBadge>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {o.meta && o.meta.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <div className="text-bookvuk-muted tabular-nums">
                Page {o.meta.page} of {o.meta.pages} · {o.meta.total} orders
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  radius="lg"
                  disabled={o.meta.page <= 1 || o.loading}
                  onClick={o.prevPage}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  radius="lg"
                  disabled={o.meta.page >= o.meta.pages || o.loading}
                  onClick={o.nextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal isOpen={!!o.detail} onClose={o.close} panelClassName="max-w-3xl">
        {o.detail ? (
          <>
            <div className="flex items-center justify-between border-b border-bookvuk-border px-6 py-4">
              <div className="text-sm font-semibold text-bookvuk-navy">Order {o.detail.id}</div>
              <button
                type="button"
                onClick={o.close}
                className="rounded-lg border border-bookvuk-border px-3 py-1 text-sm font-semibold text-bookvuk-navy hover:bg-bookvuk-lilac"
              >
                Close
              </button>
            </div>
            <OrderDetailPanel detail={o.detail} orders={o} />
          </>
        ) : null}
      </Modal>

      <ShipDialog
        open={o.shipping !== null}
        mode={o.shipping?.mode ?? "ship"}
        orderLabel={o.shipping ? o.shipping.order.id.slice(0, 8) : ""}
        initialCarrier={o.shipping?.order.trackingCarrier ?? null}
        initialNumber={o.shipping?.order.trackingNumber ?? null}
        busy={o.busy}
        error={o.actionError}
        onCancel={o.cancelShipping}
        onSubmit={o.saveShipment}
        onClear={o.shipping?.mode === "edit" ? o.clearShipment : undefined}
      />
    </>
  );
};

export default Orders;
