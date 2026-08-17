import { useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import Modal from "../../components/ui/Modal";
import useFetch from "../../hooks/useFetch";
import { createAdminCategory, listAdminCategories, type AdminCategory } from "../../api/admin";

const Categories = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data, loading, error } = useFetch<AdminCategory[]>(
    () => listAdminCategories(),
    [refreshKey],
  );

  const rows = useMemo(
    () => (data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  return (
    <AdminLayout active="categories">
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-booknest-navy">Categories</div>
              <div className="mt-1 text-sm text-booknest-muted">
                Manage categories used for book organization.
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
                onClick={() => setOpen(true)}
                className="rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white"
              >
                Add category
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
              <div className="col-span-8">Name</div>
              <div className="col-span-4">Id</div>
            </div>
            <div className="divide-y bg-white">
              {loading ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">Loading...</div>
              ) : error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(error as any)?.message || "Failed to load categories"}
                </div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">No categories found.</div>
              ) : (
                rows.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                    <div className="col-span-8 font-semibold text-booknest-navy">{c.name}</div>
                    <div className="col-span-4 truncate text-xs font-semibold text-booknest-muted">
                      {c.id}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <div className="flex items-center justify-between border-b border-booknest-border px-6 py-4">
          <div className="text-sm font-semibold text-booknest-navy">Add category</div>
        </div>
        <div className="space-y-4 p-6">
          <label className="block">
            <div className="text-xs font-semibold text-booknest-muted">Category name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-booknest-navy"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmed = name.trim();
                if (!trimmed) return;
                createAdminCategory(trimmed)
                  .then(() => {
                    setName("");
                    setOpen(false);
                    setRefreshKey((k) => k + 1);
                  })
                  .catch(() => {});
              }}
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

export default Categories;

