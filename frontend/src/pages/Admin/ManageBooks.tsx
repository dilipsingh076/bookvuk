import { useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import Modal from "../../components/ui/Modal";
import useFetch from "../../hooks/useFetch";
import {
  createAdminBook,
  deleteAdminBook,
  listAdminAuthors,
  listAdminBooksPaged,
  listAdminCategories,
  uploadAdminBookCover,
  updateAdminBook,
} from "../../api/admin";
import type { Book } from "../../api";

const toNumber = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ManageBooks = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    authorName: "",
    categoryId: "",
    format: "Paperback",
    description: "",
    price: "0",
    stock: "0",
  });

  const { data: cats } = useFetch(() => listAdminCategories(), [refreshKey]);
  const { data: authors } = useFetch(() => listAdminAuthors(), [refreshKey]);
  const { data: booksPaged, loading, error } = useFetch<{ items: Book[]; meta?: any }>(
    () => listAdminBooksPaged({ q, page, page_size: pageSize }),
    [refreshKey, q, page],
  );
  
  const books = booksPaged?.items ?? [];
  const meta = booksPaged?.meta as
    | { page?: number; pages?: number; page_size?: number; total?: number }
    | undefined;
  
    const categoryById = useMemo(() => {
    const map = new Map<string, string>();
    cats?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [cats]);

  const filtered = useMemo(() => {
    const stockPredicate = (b: Book) => {
      const any = onlyInStock || onlyLowStock || onlyOutOfStock;
      if (!any) return true;
      const inStock = (b.stock ?? 0) > 10;
      const low = (b.stock ?? 0) > 0 && (b.stock ?? 0) <= 10;
      const out = (b.stock ?? 0) === 0;
      return (
        (onlyInStock && inStock) || (onlyLowStock && low) || (onlyOutOfStock && out)
      );
    };
    return books.filter((b) => stockPredicate(b));
  }, [books, onlyInStock, onlyLowStock, onlyOutOfStock]);

  const openAdd = () => {
    setEditingId(null);
    setCoverFile(null);
    setForm({
      title: "",
      authorName: authors?.[0]?.name ?? "",
      categoryId: cats?.[0]?.id ?? "",
      format: "Paperback",
      description: "",
      price: "0",
      stock: "0",
    });
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    const b = books.find((x) => x.id === id);
    if (!b) return;
    setEditingId(id);
    setCoverFile(null);
    setForm({
      title: b.title,
      authorName: b.author ?? "",
      categoryId: String((b as any).category_id ?? ""),
      format: b.format ?? "Paperback",
      description: b.description ?? "",
      price: String(b.price),
      stock: String(b.stock),
    });
    setEditorOpen(true);
  };

  const save = () => {
    const payload = {
      title: form.title.trim() || "Untitled book",
      author: form.authorName.trim() || null,
      description: form.description.trim() || null,
      price: Math.max(0, toNumber(form.price)),
      stock: Math.max(0, Math.floor(toNumber(form.stock))),
      format: form.format.trim() || "Paperback",
      category_id: form.categoryId,
    };

    (async () => {
      if (editingId === null) {
        const created = await createAdminBook(payload);
        if (coverFile) {
          await uploadAdminBookCover(created.id, coverFile);
        }
      } else {
        const updated = await updateAdminBook(editingId, payload);
        if (coverFile) {
          await uploadAdminBookCover(updated.id, coverFile);
        }
      }
      setEditorOpen(false);
      setEditingId(null);
      setCoverFile(null);
      setRefreshKey((k) => k + 1);
    })().catch(() => {});
  };

  const remove = (id: string) => {
    deleteAdminBook(id)
      .then(() => setRefreshKey((k) => k + 1))
      .catch(() => {});
  };

  return (
    <AdminLayout active="books">
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-booknest-navy">Manage Books</div>
              <div className="mt-1 text-sm text-booknest-muted">
                Create, edit, delete, and update inventory.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-booknest-navy"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white"
              >
                Add book
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
            <div className="rounded-xl border bg-booknest-lilac p-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, author or category"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white px-3 py-2 text-booknest-navy">
                  Total: {meta?.total ?? books.length}
                </span>
                <span className="rounded-full bg-white px-3 py-2 text-booknest-navy">
                  Showing: {filtered.length}
                </span>
                <span className="rounded-full bg-white px-3 py-2 text-booknest-navy">
                  Page: {meta?.page ?? page}/{meta?.pages ?? 1}
                </span>
              </div>
            </div>
            <div className="rounded-xl border bg-booknest-lilac p-4">
              <div className="text-sm font-bold text-booknest-navy">Stock</div>
              <div className="mt-2 space-y-2 text-sm text-booknest-navy">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    className="h-4 w-4"
                  />
                  In stock
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyLowStock}
                    onChange={(e) => setOnlyLowStock(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Low stock (≤ 10)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyOutOfStock}
                    onChange={(e) => setOnlyOutOfStock(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Out of stock
                </label>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
              <div className="col-span-5">Book</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-2">Actions</div>
            </div>
            <div className="divide-y bg-white">
              {loading ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">Loading...</div>
              ) : error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(error as any)?.message || "Failed to load books"}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">No books found.</div>
              ) : (
                filtered.map((b) => (
                  <div key={b.id} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                    <div className="col-span-5">
                      <div className="font-semibold text-booknest-navy">{b.title}</div>
                      <div className="mt-1 text-xs text-booknest-muted">by {b.author || "Unknown"}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-booknest-muted">
                        <span>Stock:</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            b.stock === 0
                              ? "bg-rose-100 text-rose-700"
                              : b.stock <= 10
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {b.stock}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-3 text-booknest-navy">
                    <div className="col-span-3 text-booknest-navy">
                      {categoryById.get(b?.category_id ?? "-")}
                    </div>
                    </div>
                    <div className="col-span-2 font-semibold text-booknest-navy">
                      ₹{b.price.toFixed(2)}
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(b.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-booknest-navy"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(b.id)}
                        className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-booknest-muted">
              {meta?.total != null ? (
              <>
                Showing{" "}
                <span className="font-semibold text-booknest-navy">
                  {(meta.page ?? page) * pageSize - pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-booknest-navy">
                  {Math.min((meta.page ?? page) * pageSize, meta.total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-booknest-navy">{meta.total}</span>
              </>
            ) : null}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={(meta?.page ?? page) <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-booknest-navy disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={(meta?.pages ?? 1) <= (meta?.page ?? page)}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={editorOpen} onClose={() => setEditorOpen(false)} panelClassName="max-w-2xl">
        <div className="flex items-center justify-between border-b border-booknest-border px-6 py-4">
          <div className="text-sm font-semibold text-booknest-navy">
            {editingId ? "Edit book" : "Add book"}
          </div>
          <button
            type="button"
            onClick={() => setEditorOpen(false)}
            className="rounded-lg border border-booknest-border px-3 py-1 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
          >
            Close
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <div className="text-xs font-semibold text-booknest-muted">Title</div>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-booknest-muted">Author</div>
              <select
                value={form.authorName}
                onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm font-semibold text-booknest-navy outline-none"
              >
                {(authors ?? []).map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-booknest-muted">Category</div>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm font-semibold text-booknest-navy outline-none"
              >
                {(cats ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-booknest-muted">Format</div>
              <input
                value={form.format}
                onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block sm:col-span-2">
              <div className="text-xs font-semibold text-booknest-muted">Description</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
                rows={3}
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-booknest-muted">Price (₹)</div>
              <input
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold text-booknest-muted">Stock</div>
              <input
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block sm:col-span-2">
              <div className="text-xs font-semibold text-booknest-muted">Cover image</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0] ?? null;
                  setCoverFile(f);
                }}
                className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
              />
              <div className="mt-2 text-xs text-booknest-muted">
                Optional. If provided, it will be uploaded after saving the book.
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-booknest-navy"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
};

export default ManageBooks;
