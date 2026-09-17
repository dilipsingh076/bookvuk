/** Types local to the order history. */

export type OrderItem = {
  book_id: string;
  title_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
};

export type Order = {
  id: string;
  // snake_case to match the API, because this page uses the response objects
  // directly. Declaring it as `orderNumber` is what made the reference render as
  // "undefined" on every card even after the API started sending it.
  order_number: string;
  status: string;
  created_at: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  discount?: number;
  coupon_code?: string | null;
  payment_status?: string;
  paid_at?: string | null;
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
