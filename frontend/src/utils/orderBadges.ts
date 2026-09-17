/** Badge text and colours for an order's fulfilment status and its payment.
 *
 * Shared by Orders and OrderDetail deliberately: they used to each carry their
 * own mapping, and both had fallen behind the backend's status list — `pending`,
 * `paid` and `packed` all rendered as "Processing", so an order the shop had
 * already packed still told the customer nothing had happened.
 *
 * The status keys here must stay in step with `backend/app/core/order_status.py`.
 */

type OrderBadge = { text: string; className: string };

const STATUS_BADGES: Record<string, OrderBadge> = {
  pending: { text: "Awaiting payment", className: "bg-amber-50 text-amber-900 ring-amber-200/80" },
  processing: { text: "Processing", className: "bg-amber-50 text-amber-900 ring-amber-200/80" },
  paid: { text: "Paid", className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80" },
  packed: { text: "Packed", className: "bg-sky-50 text-sky-800 ring-sky-200/80" },
  shipped: { text: "Shipped", className: "bg-bookvuk-lilac text-bookvuk-purple ring-bookvuk-purple/20" },
  delivered: { text: "Delivered", className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80" },
  cancelled: { text: "Cancelled", className: "bg-rose-50 text-rose-700 ring-rose-200/80" },
};

/** An unknown status shows its own name rather than being silently relabelled. */
export const statusBadge = (status: string): OrderBadge =>
  STATUS_BADGES[status] ?? {
    text: status || "Unknown",
    className: "bg-slate-100 text-slate-700 ring-slate-200/80",
  };

const PAYMENT_BADGES: Record<string, OrderBadge> = {
  paid: { text: "Paid", className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80" },
  failed: { text: "Payment failed", className: "bg-rose-50 text-rose-700 ring-rose-200/80" },
  refunded: { text: "Refunded", className: "bg-slate-100 text-slate-700 ring-slate-200/80" },
  refund_pending: { text: "Refund on the way", className: "bg-amber-50 text-amber-900 ring-amber-200/80" },
};

/** Returns null for "pending", where the fulfilment badge already says enough. */
export const paymentBadge = (paymentStatus?: string | null): OrderBadge | null =>
  paymentStatus ? PAYMENT_BADGES[paymentStatus] ?? null : null;

/** Cancelling is only offered while nothing has shipped and no refund is mid-flight. */
export const canCancelOrder = (order: {
  status: string;
  payment_status?: string | null;
}): boolean =>
  order.status === "processing" &&
  order.payment_status !== "refund_pending" &&
  order.payment_status !== "refunded";
