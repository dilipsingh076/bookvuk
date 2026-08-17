import { useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import Modal from "../../components/ui/Modal";
import useFetch from "../../hooks/useFetch";
import {
  getAdminOrderById,
  listAdminOrders,
  updateAdminOrderStatus,
  type AdminOrder,
} from "../../api/admin";

const formatMoney = (n: unknown) => {
  const num = Number(n);
  return `₹${(Number.isFinite(num) ? num : 0).toFixed(2)}`;
};

const Orders = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<AdminOrder | null>(null);

  const { data: orders, loading, error } = useFetch<AdminOrder[]>(
    () => listAdminOrders({ q }),
    [refreshKey, q],
  );
  const rows = orders ?? [];

  const filtered = useMemo(() => rows, [rows]);

  const updateStatus = (orderId: string, status: AdminOrder["status"]) => {
    updateAdminOrderStatus(orderId, status)
      .then((updated) => {
        setDetail(updated);
        setRefreshKey((k) => k + 1);
      })
      .catch(() => {});
  };

  return (
    <AdminLayout active="orders">
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-booknest-navy">Orders</div>
              <div className="mt-1 text-sm text-booknest-muted">
                Search, view, and update order statuses.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-booknest-navy"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 rounded-xl border bg-booknest-lilac p-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by order id, customer, email, status"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
              <div className="col-span-4">Order</div>
              <div className="col-span-4">Customer</div>
              <div className="col-span-2">Total</div>
              <div className="col-span-2">Status</div>
            </div>
            <div className="divide-y bg-white">
              {loading ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">Loading...</div>
              ) : error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(error as any)?.message || "Failed to load orders"}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">No orders found.</div>
              ) : (
                filtered
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        getAdminOrderById(o.id)
                          .then((full) => setDetail(full))
                          .catch(() => setDetail(o));
                      }}
                      className="grid w-full grid-cols-12 gap-2 px-4 py-4 text-left text-sm hover:bg-booknest-lilac/40"
                    >
                      <div className="col-span-4">
                        <div className="font-semibold text-booknest-navy">{o.id}</div>
                        <div className="mt-1 text-xs text-booknest-muted">
                          {new Date(o.createdAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </div>
                      <div className="col-span-4">
                        <div className="font-semibold text-booknest-navy">{o.customerName}</div>
                        <div className="mt-1 text-xs text-booknest-muted">{o.customerEmail}</div>
                      </div>
                      <div className="col-span-2 font-semibold text-booknest-navy">
                        {formatMoney(Number(o.total ?? 0))}
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                            o.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : o.status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : o.status === "packed" || o.status === "shipped"
                              ? "bg-sky-100 text-sky-800"
                              : o.status === "delivered"
                              ? "bg-booknest-lilac text-booknest-navy"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} panelClassName="max-w-3xl">
        {detail ? (
          <>
            <div className="flex items-center justify-between border-b border-booknest-border px-6 py-4">
              <div className="text-sm font-semibold text-booknest-navy">Order {detail.id}</div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg border border-booknest-border px-3 py-1 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
              >
                Close
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="rounded-xl bg-booknest-lilac p-4">
                <div className="text-sm font-semibold text-booknest-navy">Customer</div>
                <div className="mt-1 text-sm text-booknest-navy">{detail.customerName}</div>
                <div className="mt-1 text-xs text-booknest-muted">{detail.customerEmail}</div>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-12 bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2">Subtotal</div>
                </div>
                <div className="divide-y bg-white">
                  {detail.items.map((it) => (
                    <div key={`${detail.id}_${it.bookId}`} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                      <div className="col-span-6 font-semibold text-booknest-navy">{it.title}</div>
                      <div className="col-span-2 text-booknest-navy">{it.qty}</div>
                      <div className="col-span-2 text-booknest-navy">{formatMoney(it.price)}</div>
                      <div className="col-span-2 font-semibold text-booknest-navy">
                        {formatMoney(Number(it.qty) * Number(it.price))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-booknest-navy">
                  Total: {formatMoney(Number(detail.total ?? 0))}
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-booknest-navy">
                  <span>Status</span>
                  <div className="inline-flex items-center rounded-full bg-booknest-purple px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                    <select
                      value={detail.status}
                      onChange={(e) =>
                        updateStatus(detail.id, e.target.value as AdminOrder["status"])
                      }
                      className="cursor-pointer bg-transparent text-xs font-semibold text-white outline-none"
                    >
                      <option value="processing">processing</option>
                      <option value="pending">pending</option>
                      <option value="paid">paid</option>
                      <option value="packed">packed</option>
                      <option value="shipped">shipped</option>
                      <option value="delivered">delivered</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                </label>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </AdminLayout>
  );
};

export default Orders;

