"use client";

/**
 * One order, in full.
 *
 * Ordered by what the shop needs in order to act: where it goes, what is owed,
 * what parcel it went in, what was in it, and only then the history.
 */

import { ORDER_STATUSES, awaitingCashCollection, isTerminalOrder, type AdminOrder } from "../../../api/admin";
import { Button } from "../../../components/ui";
import StatusBadge from "../../../components/admin/StatusBadge";
import { formatMoney, formatWhen, paymentLabel, paymentTone } from "./types";
import type { UseAdminOrders } from "./useAdminOrders";

type OrderDetailPanelProps = {
  detail: AdminOrder;
  orders: UseAdminOrders;
};

const OrderDetailPanel = ({ detail, orders: o }: OrderDetailPanelProps) => {
  const timeline: Array<[string, string | null]> = [
    ["Placed", detail.createdAt],
    ["Paid", detail.paidAt],
    ["Packed", detail.packedAt],
    ["Shipped", detail.shippedAt],
    ["Delivered", detail.deliveredAt],
    ["Cancelled", detail.cancelledAt],
  ];

  return (
    <div className="space-y-5 p-6">
      {o.actionError ? (
        <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {o.actionError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Ship to, which the admin screen simply did not have: the address
            lived only on the customer's own order page, so this screen could
            show an order it could not fulfil. */}
        <div className="rounded-xl bg-bookvuk-lilac p-4">
          <div className="text-sm font-semibold text-bookvuk-navy">Ship to</div>
          <div className="mt-2 text-sm text-bookvuk-navy">
            {detail.shipFullName || detail.customerName}
          </div>
          {detail.shipLine1 ? (
            <address className="mt-1 not-italic text-sm text-bookvuk-muted">
              {detail.shipLine1}
              {detail.shipLine2 ? <>, {detail.shipLine2}</> : null}
              <br />
              {[detail.shipCity, detail.shipState, detail.shipPostalCode]
                .filter(Boolean)
                .join(", ")}
              {detail.shipCountry ? <> · {detail.shipCountry}</> : null}
            </address>
          ) : (
            <div className="mt-1 text-sm text-bookvuk-muted">No address recorded.</div>
          )}
          <div className="mt-2 text-xs text-bookvuk-muted">
            {detail.shipPhone || "no phone"} · {detail.customerEmail}
          </div>
        </div>

        <div className="rounded-xl bg-bookvuk-lilac p-4">
          <div className="text-sm font-semibold text-bookvuk-navy">Payment</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge tone={paymentTone(detail)}>{paymentLabel(detail)}</StatusBadge>
            <StatusBadge tone="bg-white text-bookvuk-navy">
              {detail.paymentMethod === "cod" ? "cash on delivery" : "online"}
            </StatusBadge>
            {detail.paymentMode === "test" ? (
              <StatusBadge tone="bg-amber-50 text-amber-700 ring-1 ring-amber-300">test mode</StatusBadge>
            ) : null}
          </div>
          {formatWhen(detail.paidAt) ? (
            <div className="mt-2 text-xs text-bookvuk-muted">
              Received {formatWhen(detail.paidAt)}
            </div>
          ) : null}

          {awaitingCashCollection(detail) ? (
            <div className="mt-3">
              {/* Its own action, not a side effect of marking delivered: a
                  courier can deliver and fail to collect, and the two events
                  have to be recordable apart. */}
              <Button
                variant="primary"
                size="sm"
                radius="lg"
                disabled={o.busy}
                onClick={() => o.collectCash(detail.id)}
              >
                {o.busy ? "Recording…" : `Mark ${formatMoney(detail.total)} cash collected`}
              </Button>
              <div className="mt-1.5 text-xs text-bookvuk-muted">
                Until this is recorded the order counts as unpaid.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* The parcel. Its own panel rather than a line in the timeline, because it
          is the thing support is asked about and the only part of the order the
          admin may need to correct afterwards. */}
      {detail.trackingNumber || detail.shippedAt ? (
        <div className="rounded-xl border border-bookvuk-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-bookvuk-navy">Shipment</div>
            <Button
              variant="secondary"
              size="sm"
              radius="lg"
              disabled={o.busy}
              onClick={() => o.editShipment(detail)}
            >
              {detail.trackingNumber ? "Edit" : "Add tracking"}
            </Button>
          </div>
          {detail.trackingNumber ? (
            <div className="mt-2 text-sm text-bookvuk-navy">
              <span className="font-semibold">{detail.trackingCarrierLabel}</span>{" "}
              <span className="tabular-nums">{detail.trackingNumber}</span>
              {detail.trackingUrl ? (
                <>
                  {" · "}
                  <a
                    href={detail.trackingUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-bookvuk-purple underline"
                  >
                    Track on the courier&apos;s site
                  </a>
                </>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-sm text-bookvuk-muted">
              Marked shipped with no consignment number recorded — the customer has nothing to
              follow.
            </div>
          )}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-12 bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
          <div className="col-span-6">Item</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-2">Price</div>
          <div className="col-span-2">Subtotal</div>
        </div>
        <div className="divide-y bg-white">
          {detail.items.map((it) => (
            <div
              key={`${detail.id}_${it.bookId}`}
              className="grid grid-cols-12 gap-2 px-4 py-4 text-sm"
            >
              <div className="col-span-6 font-semibold text-bookvuk-navy">{it.title}</div>
              <div className="col-span-2 text-bookvuk-navy">{it.qty}</div>
              <div className="col-span-2 text-bookvuk-navy">{formatMoney(it.price)}</div>
              <div className="col-span-2 font-semibold text-bookvuk-navy">
                {formatMoney(Number(it.qty) * Number(it.price))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-bookvuk-border p-4">
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <div className="text-bookvuk-muted">Subtotal</div>
          <div className="text-right tabular-nums text-bookvuk-navy">
            {formatMoney(detail.subtotal)}
          </div>
          {Number(detail.discount) > 0 ? (
            <>
              <div className="text-bookvuk-muted">
                Discount{detail.couponCode ? ` (${detail.couponCode})` : ""}
              </div>
              <div className="text-right tabular-nums text-emerald-700">
                −{formatMoney(detail.discount)}
              </div>
            </>
          ) : null}
          <div className="text-bookvuk-muted">Shipping</div>
          <div className="text-right tabular-nums text-bookvuk-navy">
            {formatMoney(detail.shipping)}
          </div>
          <div className="text-bookvuk-muted">Tax</div>
          <div className="text-right tabular-nums text-bookvuk-navy">
            {formatMoney(detail.tax)}
          </div>
          {Number(detail.walletCreditUsed) > 0 ? (
            <>
              {/* Credit is a tender, not a discount — the goods are still worth
                  `total`, the gateway was just charged less. */}
              <div className="text-bookvuk-muted">Store credit used</div>
              <div className="text-right tabular-nums text-bookvuk-navy">
                −{formatMoney(detail.walletCreditUsed)}
              </div>
            </>
          ) : null}
          <div className="mt-1 border-t border-bookvuk-border pt-2 font-semibold text-bookvuk-navy">
            Order total
          </div>
          <div className="mt-1 border-t border-bookvuk-border pt-2 text-right font-semibold tabular-nums text-bookvuk-navy">
            {formatMoney(detail.total)}
          </div>
        </div>
      </div>

      {/* The stages that have actually happened, with when. The admin saw only
          the current status before, so "has this shipped yet" meant reading the
          customer's page. */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-bookvuk-muted">
        {timeline
          .filter(([, when]) => Boolean(when))
          .map(([label, when]) => (
            <span key={label}>
              <span className="font-semibold text-bookvuk-navy">{label}</span> {formatWhen(when)}
            </span>
          ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-bookvuk-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        {isTerminalOrder(detail.status) ? (
          /* Delivered and cancelled are terminal on the server — offering the
             moves anyway just produced a 409 the admin had to guess the meaning
             of. */
          <div className="text-sm text-bookvuk-muted">
            This order is <span className="font-semibold">{detail.status}</span> and can no longer
            be changed.
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm font-semibold text-bookvuk-navy">
            <span>Move to</span>
            <select
              value={detail.status}
              disabled={o.busy}
              onChange={(e) => o.updateStatus(detail.id, e.target.value as AdminOrder["status"])}
              className="cursor-pointer rounded-full bg-bookvuk-purple px-3 py-1.5 text-xs font-semibold text-white outline-none disabled:opacity-60"
            >
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
};

export default OrderDetailPanel;
