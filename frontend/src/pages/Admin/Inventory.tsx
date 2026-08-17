import { useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import Modal from "../../components/ui/Modal";
import useFetch from "../../hooks/useFetch";
import { listAdminBooksPaged, restockAdminBook } from "../../api/admin";
import type { Book } from "../../api";

const lowStockThreshold = 10;

const Inventory = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(10);

  const { data, loading, error } = useFetch<{ items: Book[] }>(
    () => listAdminBooksPaged({ page: 1, page_size: 50 }),
    [refreshKey],
  );
  const books = data?.items ?? [];

  const lowStock = useMemo(
    () => books.filter((b) => b.stock > 0 && b.stock <= lowStockThreshold),
    [books],
  );
  const outOfStock = useMemo(() => books.filter((b) => b.stock === 0), [books]);

  const openRestock = (bookId: string) => {
    setRestockId(bookId);
    setRestockQty(10);
    setRestockOpen(true);
  };

  const applyRestock = () => {
    if (!restockId) return;
    restockAdminBook(restockId, restockQty)
      .then(() => {
        setRestockOpen(false);
        setRestockId(null);
        setRefreshKey((k) => k + 1);
      })
      .catch(() => {});
  };

  return (
    <AdminLayout active="inventory">
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-booknest-navy">Inventory</div>
              <div className="mt-1 text-sm text-booknest-muted">
                Monitor low stock and restock titles.
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

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border">
              <div className="bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
                Low stock (≤ {lowStockThreshold})
              </div>
              <div className="divide-y bg-white">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-booknest-muted">Loading...</div>
                ) : error ? (
                  <div className="px-4 py-6 text-sm text-rose-700">
                    {(error as any)?.message || "Failed to load inventory"}
                  </div>
                ) : lowStock.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-booknest-muted">No low-stock items.</div>
                ) : (
                  lowStock.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-4 px-4 py-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-booknest-navy">
                          {b.title}
                        </div>
                        <div className="mt-1 text-xs text-booknest-muted">
                          by {b.author || "Unknown"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          {b.stock} left
                        </span>
                        <button
                          type="button"
                          onClick={() => openRestock(b.id)}
                          className="rounded-lg bg-booknest-purple px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <div className="bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
                Out of stock
              </div>
              <div className="divide-y bg-white">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-booknest-muted">Loading...</div>
                ) : error ? (
                  <div className="px-4 py-6 text-sm text-rose-700">
                    {(error as any)?.message || "Failed to load inventory"}
                  </div>
                ) : outOfStock.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-booknest-muted">No out-of-stock items.</div>
                ) : (
                  outOfStock.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-4 px-4 py-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-booknest-navy">
                          {b.title}
                        </div>
                        <div className="mt-1 text-xs text-booknest-muted">
                          by {b.author || "Unknown"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRestock(b.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-booknest-navy"
                      >
                        Add stock
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={restockOpen} onClose={() => setRestockOpen(false)}>
        <div className="border-b border-booknest-border px-6 py-4">
          <div className="text-sm font-semibold text-booknest-navy">Restock book</div>
        </div>
        <div className="space-y-4 p-6">
          <label className="block">
            <div className="text-xs font-semibold text-booknest-muted">Quantity to add</div>
            <input
              type="number"
              min={0}
              value={restockQty}
              onChange={(e) => setRestockQty(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRestockOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-booknest-navy"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyRestock}
              className="rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};

export default Inventory;

