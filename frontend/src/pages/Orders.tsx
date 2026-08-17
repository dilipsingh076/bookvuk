import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatPrice } from "../utils/formatPrice";
import { getBaseUrl } from "../api";
import Modal from "../components/ui/Modal";

type OrderItem = {
  book_id: string;
  title_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  created_at: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

const statusLabel = (order: Order) => {
  if (order.status === "cancelled") return { text: "Cancelled", className: "bg-rose-50 text-rose-700 ring-rose-200/80" };
  if (order.status === "delivered") return { text: "Delivered", className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80" };
  if (order.status === "shipped") return { text: "Shipped", className: "bg-booknest-lilac text-booknest-purple ring-booknest-purple/20" };
  return { text: "Processing", className: "bg-amber-50 text-amber-900 ring-amber-200/80" };
};

const Orders = () => {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);

  const readError = async (res: Response, fallback: string) => {
    const err = await res.json().catch(() => null);
    if (err && typeof err === "object" && "detail" in err) {
      return String((err as { detail?: unknown }).detail || fallback);
    }
    return fallback;
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`${getBaseUrl()}/api/customer/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(await readError(res, "Failed to fetch orders"));
      }

      const data: Order[] = await res.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [getToken]);

  const cancelOrder = async (orderId: string) => {
    const token = getToken();
    if (!token) {
      setError("User not authenticated");
      return;
    }

    setCancellingOrderId(orderId);
    setError(null);
    try {
      const res = await fetch(`${getBaseUrl()}/api/customer/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to cancel order"));
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: "cancelled" } : o
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to cancel order");
    } finally {
      setCancellingOrderId(null);
      setConfirmOrderId(null);
    }
  };

  return (
    <div className="relative pb-20 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b from-booknest-lilac/80 via-booknest-cream/40 to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-booknest-navy sm:text-4xl">Your orders</h1>
        <p className="mt-2 text-sm text-booknest-muted sm:text-[15px]">
          Mock orders for demo—tap an order to see the status timeline.
        </p>
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="mt-10 rounded-2xl border border-booknest-border/80 bg-white p-6 text-sm text-booknest-muted">
            Loading orders...
          </div>
        ) : null}

        <ul className="mt-10 space-y-4">
          {orders.map((order) => {
            const st = statusLabel(order);
            return (
              <li key={order.id}>
                <div className="flex flex-col gap-3 rounded-3xl border border-booknest-border/80 bg-white p-5 shadow-booknest-card ring-1 ring-booknest-navy/[0.04] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6">
                  <Link
                    to={`/orders/${order.id}`}
                    className="min-w-0 transition hover:opacity-90"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-booknest-navy">{order.orderNumber}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${st.className}`}>
                        {st.text}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-booknest-muted">
                      Placed {fmtDate(order.created_at)} · {order.items.length} item
                      {order.items.length === 1 ? "" : "s"}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-lg font-extrabold tabular-nums text-booknest-navy">
                      {formatPrice((order.total))}
                    </div>
                    {order.status === "processing" ? (
                      <button
                        type="button"
                        onClick={() => setConfirmOrderId(order.id)}
                        disabled={cancellingOrderId === order.id}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingOrderId === order.id ? "Cancelling..." : "Cancel order"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {!loading && orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-booknest-border/80 bg-white p-6 text-sm text-booknest-muted">
            No orders found yet.
          </div>
        ) : null}
      </div>
      <Modal isOpen={!!confirmOrderId} onClose={() => setConfirmOrderId(null)}>
        <div className="p-6 sm:p-7">
          <h2 className="text-xl font-bold text-booknest-navy">Cancel this order?</h2>
          <p className="mt-2 text-sm leading-relaxed text-booknest-muted">
            This action cannot be undone. The order will be marked as cancelled.
          </p>
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmOrderId(null)}
              disabled={!!cancellingOrderId}
              className="rounded-xl border border-booknest-border bg-white px-4 py-2 text-sm font-semibold text-booknest-navy transition hover:bg-zinc-50 disabled:opacity-60"
            >
              Keep order
            </button>
            <button
              type="button"
              onClick={() => confirmOrderId && cancelOrder(confirmOrderId)}
              disabled={!confirmOrderId || !!cancellingOrderId}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {cancellingOrderId ? "Cancelling..." : "Yes, cancel"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Orders;
