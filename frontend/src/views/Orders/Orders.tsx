"use client";

/** Every order you have placed. */

import Modal from "../../components/ui/Modal";
import SellBackOffers from "../../components/SellBackOffers";
import { Alert, Button } from "../../components/ui";
import OrderRow from "./OrderRow";
import OrdersSkeleton from "./OrdersSkeleton";
import { useOrders } from "./useOrders";

const Orders = () => {
  const o = useOrders();

  return (
    <div className="relative pb-20 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b from-bookvuk-lilac/80 via-bookvuk-cream/40 to-transparent"
        aria-hidden
      />
      <div className="relative px-4 sm:px-6">
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-bookvuk-navy sm:text-4xl">
          Your orders
        </h1>
        <p className="mt-2 text-sm text-bookvuk-muted sm:text-[15px]">
          Tap an order to see its status timeline.
        </p>
        {o.error ? (
          <Alert tone="error" className="mt-4">
            {o.error}
          </Alert>
        ) : null}

        {o.loading ? <OrdersSkeleton /> : null}

        <ul className="mt-10 space-y-4">
          {o.orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onAskToCancel={() => o.askToCancel(order.id)}
              cancelling={o.cancellingOrderId === order.id}
            />
          ))}
        </ul>
        {!o.loading && o.orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-bookvuk-border/80 bg-white p-6 text-sm text-bookvuk-muted">
            No orders found yet.
          </div>
        ) : null}
      </div>

      <Modal isOpen={!!o.confirmOrderId} onClose={o.dismissConfirm}>
        <div className="p-6 sm:p-7">
          <h2 className="text-xl font-bold text-bookvuk-navy">Cancel this order?</h2>
          <p className="mt-2 text-sm leading-relaxed text-bookvuk-muted">
            This action cannot be undone. The order will be marked as cancelled.
            {o.confirmOrderPaid
              ? " Your payment will be refunded to the method you paid with."
              : ""}
          </p>
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              onClick={o.dismissConfirm}
              disabled={!!o.cancellingOrderId}
              variant="secondary"
              radius="xl"
            >
              Keep order
            </Button>
            <Button
              type="button"
              onClick={() => o.confirmOrderId && o.cancelOrder(o.confirmOrderId)}
              disabled={!o.confirmOrderId || !!o.cancellingOrderId}
              variant="danger"
              radius="xl"
            >
              {o.cancellingOrderId ? "Cancelling..." : "Yes, cancel"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Across every delivered order, not just one. Somebody looking at their
          order history is looking at a shelf of books they have finished — which
          is the moment to ask for them back. */}
      <SellBackOffers limit={4} />
    </div>
  );
};

export default Orders;
