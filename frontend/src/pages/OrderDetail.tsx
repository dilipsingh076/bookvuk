// OrderDetail.tsx
import { Link, Navigate, useParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { formatPrice } from "../utils/formatPrice";
import { getBaseUrl } from "../api/index";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/ui/Modal";

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

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
  placedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
};

type Step = { key: "placed" | "shipped" | "delivered"; label: string; at: string | null; done: boolean };

const OrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { getToken } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const readError = async (res: Response, fallback: string) => {
    const payload = await res.json().catch(() => null);
    if (payload && typeof payload === "object" && "detail" in payload) {
      return String((payload as { detail?: unknown }).detail || fallback);
    }
    return fallback;
  };

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      setLoading(true);
      setFetchError(null);
      const token = getToken();
      if (!token) {
        setFetchError("Not authenticated");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${getBaseUrl()}/api/customer/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch order");
        const data = await res.json();
        setOrder({
          id: data.id,
          orderNumber: data.order_number,
          status: data.status,
          placedAt: data.created_at || null,
          shippedAt: data.shipped_at || null,
          deliveredAt: data.delivered_at || null,
          items: data.items.map((i: any) => ({
            book_id: i.book_id,
            title_snapshot: i.title_snapshot,
            unit_price_snapshot: Number(i.unit_price_snapshot),
            quantity: Number(i.quantity),
          })),
          subtotal: Number(data.subtotal),
          shipping: Number(data.shipping),
          tax: Number(data.tax),
          total: Number(data.total),
        });
      } catch (e: any) {
        setFetchError(e.message || "Error fetching order");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, getToken]);

  const steps: Step[] = useMemo(() => {
    if (!order) return [];
    const placed = Boolean(order.placedAt);
    const shipped = Boolean(order.shippedAt);
    const delivered = Boolean(order.deliveredAt);
    return [
      { key: "placed", label: "Order placed", at: order.placedAt, done: placed },
      { key: "shipped", label: "Shipped", at: order.shippedAt, done: shipped },
      { key: "delivered", label: "Delivered", at: order.deliveredAt, done: delivered },
    ];
  }, [order]);

  const orderLineTotal = (line: OrderItem) => line.unit_price_snapshot * line.quantity;
  const orderGrandTotal = (o: Order) => o.items.reduce((sum, i) => sum + orderLineTotal(i), 0);
  const canCancel = order?.status === "processing";

  const cancelOrder = async () => {
    if (!order) return;
    const token = getToken();
    if (!token) {
      setActionError("Not authenticated");
      return;
    }

    setCancelling(true);
    setActionError(null);
    try {
      const res = await fetch(`${getBaseUrl()}/api/customer/orders/${order.id}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to cancel order"));
      const data = await res.json();
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: data.status ?? "cancelled",
            }
          : prev
      );
    } catch (e: any) {
      setActionError(e.message || "Failed to cancel order");
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  if (loading) return <p>Loading order...</p>;
  if (fetchError || !order) return <Navigate to="/orders" replace />;

  return (
    <div className="relative pb-20 pt-6 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-booknest-lilac/70 via-transparent to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        {actionError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm font-semibold text-booknest-purple hover:underline"
        >
          ← All orders
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-extrabold uppercase tracking-[0.2em] text-booknest-muted">Order</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-booknest-navy">{order.orderNumber}</h1>
            <div className="mt-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${
                  order.status === "cancelled"
                    ? "bg-rose-50 text-rose-700 ring-rose-200/80"
                    : order.status === "delivered"
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                      : order.status === "shipped"
                        ? "bg-booknest-lilac text-booknest-purple ring-booknest-purple/20"
                        : "bg-amber-50 text-amber-900 ring-amber-200/80"
                }`}
              >
                {order.status}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-lg font-extrabold tabular-nums text-booknest-navy">{formatPrice(orderGrandTotal(order))}</p>
            {canCancel ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={cancelling}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Cancel order"}
              </button>
            ) : null}
          </div>
        </div>

        <section
          className="mt-10 rounded-3xl border border-booknest-border/80 bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.04] sm:p-8"
          aria-labelledby="timeline-heading"
        >
          <h2 id="timeline-heading" className="text-lg font-bold text-booknest-navy">
            Status
          </h2>
          <ol className="relative mt-8 space-y-0">
            {steps.map((step, idx) => (
              <li key={step.key} className="relative flex gap-4 pb-10 last:pb-0">
                {idx < steps.length - 1 ? (
                  <div
                    className={`absolute left-[15px] top-8 h-[calc(100%-0.5rem)] w-0.5 ${
                      step.done ? "bg-booknest-purple/40" : "bg-booknest-border"
                    }`}
                    aria-hidden
                  />
                ) : null}
                <div className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white text-xs font-bold tabular-nums shadow-sm ring-2 ring-white">
                  {step.done ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-booknest-purple text-white">
                      ✓
                    </span>
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-booknest-border bg-booknest-cream text-booknest-muted">
                      {idx + 1}
                    </span>
                  )}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className={`font-semibold ${step.done ? "text-booknest-navy" : "text-booknest-muted"}`}>
                    {step.label}
                  </p>
                  <p className="mt-1 text-sm text-booknest-muted">{fmtDate(step.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 rounded-3xl border border-booknest-border/80 bg-white p-6 shadow-booknest-card ring-1 ring-booknest-navy/[0.04] sm:p-8">
          <h2 className="text-lg font-bold text-booknest-navy">Items</h2>
          <ul className="mt-4 divide-y divide-booknest-border">
            {order.items.map((line, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold text-booknest-navy">{line.title_snapshot}</p>
                  <p className="mt-0.5 text-sm text-booknest-muted">
                    Qty {line.quantity} × {formatPrice(line.unit_price_snapshot)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-booknest-navy">
                  {formatPrice(orderLineTotal(line))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="p-6 sm:p-7">
          <h2 className="text-xl font-bold text-booknest-navy">Cancel this order?</h2>
          <p className="mt-2 text-sm leading-relaxed text-booknest-muted">
            This action cannot be undone. The order will be marked as cancelled.
          </p>
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={cancelling}
              className="rounded-xl border border-booknest-border bg-white px-4 py-2 text-sm font-semibold text-booknest-navy transition hover:bg-zinc-50 disabled:opacity-60"
            >
              Keep order
            </button>
            <button
              type="button"
              onClick={cancelOrder}
              disabled={cancelling}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {cancelling ? "Cancelling..." : "Yes, cancel"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrderDetail;