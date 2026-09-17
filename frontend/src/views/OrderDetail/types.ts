/** Types local to one order's page. */

export type OrderItem = {
  /** `order_items.id`, not the book id: a return is against one line of one
   *  order, so the line is what has to be nameable. */
  id: string;
  book_id: string;
  title_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  paymentStatus: string;
  paidAt: string | null;
  refundedAt: string | null;
  refundAmount: number | null;
  /* Which parcel it went in. "Shipped" on its own is the least useful thing this
     page can say: it tells the customer something left and gives them nothing to
     do with that, so the next step was always a support message. `trackingUrl`
     is null when the courier has no per-consignment page — the number alone is
     still worth showing. */
  trackingCarrierLabel: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

/** One stop on the order's journey. */
export type Step = {
  key: "placed" | "packed" | "shipped" | "delivered" | "cancelled";
  label: string;
  at: string | null;
  done: boolean;
};

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const lineTotal = (line: OrderItem) => line.unit_price_snapshot * line.quantity;

export const grandTotal = (o: Order) => o.items.reduce((sum, i) => sum + lineTotal(i), 0);
