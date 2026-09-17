"use client";

/** One order in the history: what it was, what it cost, and how it is going. */

import Link from "next/link";
import { formatPrice } from "../../utils/formatPrice";
import { canCancelOrder, paymentBadge, statusBadge } from "../../utils/orderBadges";
import { Button } from "../../components/ui";
import { fmtDate, type Order } from "./types";

type OrderRowProps = {
  order: Order;
  onAskToCancel: () => void;
  cancelling: boolean;
};

const OrderRow = ({ order, onAskToCancel, cancelling }: OrderRowProps) => {
  const st = statusBadge(order.status);
  const pay = paymentBadge(order.payment_status);

  return (
    <li>
      <div className="flex flex-col gap-3 rounded-3xl border border-bookvuk-border/80 bg-white p-5 shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.04] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6">
        <Link href={`/orders/${order.id}`} className="min-w-0 transition hover:opacity-90">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-bookvuk-navy">{order.order_number}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${st.className}`}
            >
              {st.text}
            </span>
            {pay ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${pay.className}`}
              >
                {pay.text}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-bookvuk-muted">
            Placed {fmtDate(order.created_at)} · {order.items.length} item
            {order.items.length === 1 ? "" : "s"}
          </p>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-lg font-extrabold tabular-nums text-bookvuk-navy">
            {formatPrice(order.total)}
          </div>
          {canCancelOrder(order) ? (
            <Button
              type="button"
              onClick={onAskToCancel}
              disabled={cancelling}
              variant="danger"
              size="xs"
              radius="xl"
              className="py-2"
            >
              {cancelling ? "Cancelling..." : "Cancel order"}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
};

export default OrderRow;
