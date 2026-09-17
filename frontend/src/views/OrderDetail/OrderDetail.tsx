"use client";

/**
 * One order.
 *
 * Ordered by what the customer came for: where it is, what was in it, and then
 * the two things they might want to do next — sell one of these books back, or
 * return one. Both live here rather than on pages of their own, because this is
 * where somebody already is when they decide.
 */

import Link from "next/link";
import { formatPrice } from "../../utils/formatPrice";
import { paymentBadge, statusBadge } from "../../utils/orderBadges";
import { Alert, Button, SectionHeading } from "../../components/ui";
import Modal from "../../components/ui/Modal";
import ReturnPanel from "../../components/ReturnPanel";
import SellBackOffers from "../../components/SellBackOffers";
import OrderDetailSkeleton from "./OrderDetailSkeleton";
import OrderTimeline from "./OrderTimeline";
import { useOrderDetail } from "./useOrderDetail";
import { fmtDate, grandTotal, lineTotal } from "./types";

const OrderDetail = () => {
  const o = useOrderDetail();

  if (o.loading) return <OrderDetailSkeleton />;
  // `<Navigate>` redirected during render; Next has no equivalent, so this
  // renders nothing rather than the empty order shell.
  if (o.fetchError || !o.order) return null;

  const order = o.order;
  const payment = paymentBadge(order.paymentStatus);

  return (
    <div className="relative pb-20 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-bookvuk-lilac/70 via-transparent to-transparent"
        aria-hidden
      />

      <div className="relative px-4 sm:px-6">
        {o.actionError ? (
          <Alert tone="error" className="mb-4">
            {o.actionError}
          </Alert>
        ) : null}
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm font-semibold text-bookvuk-purple hover:underline"
        >
          ← All orders
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-extrabold uppercase tracking-[0.2em] text-bookvuk-muted">
              Order
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-bookvuk-navy">
              {order.orderNumber}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${
                  statusBadge(order.status).className
                }`}
              >
                {statusBadge(order.status).text}
              </span>
              {payment ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${payment.className}`}
                >
                  {payment.text}
                </span>
              ) : null}
            </div>
            {order.refundedAt && order.refundAmount != null ? (
              <p className="mt-2 text-sm text-bookvuk-muted">
                {formatPrice(order.refundAmount)} refunded on {fmtDate(order.refundedAt)}.
              </p>
            ) : null}
            {order.paymentStatus === "refund_pending" ? (
              <p className="mt-2 text-sm text-bookvuk-muted">
                Your refund is being processed and will reach your original payment method.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-lg font-extrabold tabular-nums text-bookvuk-navy">
              {formatPrice(grandTotal(order))}
            </p>
            {o.canCancel ? (
              <Button
                type="button"
                onClick={o.openConfirm}
                disabled={o.cancelling}
                variant="danger"
                size="xs"
                radius="xl"
                className="py-2"
              >
                {o.cancelling ? "Cancelling..." : "Cancel order"}
              </Button>
            ) : null}
          </div>
        </div>

        <OrderTimeline steps={o.steps} order={order} />

        <section className="mt-6 rounded-3xl border border-bookvuk-border/80 bg-white p-6 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.04] sm:p-8">
          <SectionHeading title="Items" />
          <ul className="mt-4 divide-y divide-bookvuk-border">
            {order.items.map((line) => (
              <li
                key={line.id}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold text-bookvuk-navy">{line.title_snapshot}</p>
                  <p className="mt-0.5 text-sm text-bookvuk-muted">
                    Qty {line.quantity} × {formatPrice(line.unit_price_snapshot)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-bookvuk-navy">
                  {formatPrice(lineTotal(line))}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Only the books on this order, and only once it has arrived. Asking
            somebody to sell back a parcel still in the post is asking them to
            sell something they do not have — the endpoint filters to delivered
            orders, and this narrows it to the one they are looking at. */}
        {order.status === "delivered" ? (
          <SellBackOffers onlyBookIds={order.items.map((i) => i.book_id)} limit={3} />
        ) : null}

        {/* Returns live here rather than on a page of their own: this is where
            somebody already is when they discover the problem. */}
        <ReturnPanel
          orderId={order.id}
          delivered={order.status === "delivered"}
          items={order.items.map((i) => ({ id: i.id, title: i.title_snapshot }))}
        />
      </div>

      <Modal isOpen={o.confirmOpen} onClose={o.closeConfirm}>
        <div className="p-6 sm:p-7">
          <h2 className="text-xl font-bold text-bookvuk-navy">Cancel this order?</h2>
          <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted">
            This action cannot be undone. The order will be marked as cancelled.
            {order.paymentStatus === "paid"
              ? ` ${formatPrice(order.total)} will be refunded to the method you paid with.`
              : ""}
          </p>
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              onClick={o.closeConfirm}
              disabled={o.cancelling}
              variant="secondary"
              radius="xl"
            >
              Keep order
            </Button>
            <Button
              type="button"
              onClick={o.cancelOrder}
              disabled={o.cancelling}
              variant="danger"
              radius="xl"
            >
              {o.cancelling ? "Cancelling..." : "Yes, cancel"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetail;
