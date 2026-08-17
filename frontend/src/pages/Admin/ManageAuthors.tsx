import { useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import Modal from "../../components/ui/Modal";
import {
  createAdminAuthor,
  deleteAdminAuthor,
  listAdminAuthors,
  updateAdminAuthor,
  type AdminAuthor,
} from "../../api/admin";
import useFetch from "../../hooks/useFetch";

const ManageAuthors = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [q, setQ] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [showDraft, setShowDraft] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminAuthor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAuthor | null>(null);
  const [form, setForm] = useState({
    name: "",
    bio: "",
    status: "active" as AdminAuthor["status"],
  });

  const { data: authorsData, loading, error } = useFetch<AdminAuthor[]>(
    () => listAdminAuthors({ q, status: showActive && showDraft ? undefined : showActive ? "active" : "draft" }),
    [refreshKey, q, showActive, showDraft],
  );
  const authors = authorsData ?? [];
  const bookCountByAuthor = useMemo(() => {
    const map = new Map<string, number>();
    authors.forEach((a) => {
      const count = Number((a as any).bookCount ?? (a as any).book_count ?? 0);
      map.set(a.name.toLowerCase(), Number.isFinite(count) ? count : 0);
    });
    return map;
  }, [authors]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return authors.filter((a) => {
      const statusOk = (showActive && a.status === "active") || (showDraft && a.status === "draft");
      if (!statusOk) return false;
      if (!query) return true;
      return `${a.name} ${a.bio} ${a.status}`.toLowerCase().includes(query);
    });
  }, [authors, q, showActive, showDraft]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", bio: "", status: "active" });
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    const a = authors.find((x) => x.id === id);
    if (!a) return;
    setEditingId(id);
    setForm({ name: a.name, bio: a.bio, status: a.status });
    setEditorOpen(true);
  };

  const save = () => {
    const core = {
      name: form.name.trim() || "Unnamed author",
      bio: form.bio.trim(),
      status: form.status,
    };
    (async () => {
      if (editingId === null) {
        await createAdminAuthor(core);
      } else {
        await updateAdminAuthor(editingId, core);
      }
      setEditorOpen(false);
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    })().catch(() => {
      // let useFetch surface errors on refresh; keep UI stable
    });
  };

  const remove = (id: string) => {
    deleteAdminAuthor(id)
      .then(() => setRefreshKey((k) => k + 1))
      .catch(() => {});
  };

  return (
    <AdminLayout active="authors">
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-booknest-navy">Manage Authors</div>
              <div className="mt-1 text-sm text-booknest-muted">
                Update profiles and statuses.
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
                Add author
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-xl border bg-booknest-lilac p-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by author name or bio"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-booknest-navy">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showActive}
                  onChange={(e) => setShowActive(e.target.checked)}
                  className="h-4 w-4"
                />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showDraft}
                  onChange={(e) => setShowDraft(e.target.checked)}
                  className="h-4 w-4"
                />
                Draft
              </label>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
              <div className="col-span-5">Author</div>
              <div className="col-span-2">Books</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Actions</div>
            </div>
            <div className="divide-y bg-white">
              {loading ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">Loading...</div>
              ) : error ? (
                <div className="px-4 py-6 text-sm text-rose-700">
                  {(error as any)?.message || "Failed to load authors"}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">No authors found.</div>
              ) : (
                filtered.map((a) => (
                  <div key={a.id} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm">
                    <div className="col-span-5">
                      <div className="font-semibold text-booknest-navy">{a.name}</div>
                      {a.bio ? (
                        <div className="mt-1 line-clamp-2 text-xs text-booknest-muted">{a.bio}</div>
                      ) : (
                        <div className="mt-1 text-xs text-booknest-muted">No bio</div>
                      )}
                    </div>
                    <div className="col-span-2 text-booknest-navy">
                      {bookCountByAuthor.get(a.name.toLowerCase()) ?? 0}
                    </div>
                    <div className="col-span-2 font-semibold text-booknest-navy">{a.status}</div>
                    <div className="col-span-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(a.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-booknest-navy"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewing(a)}
                        className="rounded-lg bg-booknest-lilac px-3 py-1.5 text-xs font-semibold text-booknest-navy"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(a)}
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
        </div>
      </div>

      <Modal isOpen={editorOpen} onClose={() => setEditorOpen(false)} panelClassName="max-w-2xl">
        <div className="flex items-center justify-between border-b border-booknest-border px-6 py-4">
          <div className="text-sm font-semibold text-booknest-navy">
            {editingId ? "Edit author" : "Add author"}
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
          <label className="block">
            <div className="text-xs font-semibold text-booknest-muted">Name</div>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-booknest-muted">Bio</div>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm outline-none"
              rows={4}
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-booknest-muted">Status</div>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as AdminAuthor["status"] }))
              }
              className="mt-2 w-full rounded-lg border border-booknest-border bg-white px-3 py-2 text-sm font-semibold text-booknest-navy outline-none"
            >
              <option value="active">active</option>
              <option value="draft">draft</option>
            </select>
          </label>
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

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} panelClassName="max-w-2xl">
        {viewing ? (
          <>
            <div className="flex items-center justify-between border-b border-booknest-border px-6 py-4">
              <div className="text-sm font-semibold text-booknest-navy">{viewing.name}</div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-lg border border-booknest-border px-3 py-1 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-xl bg-booknest-lilac p-4">
                <div className="text-sm font-semibold text-booknest-navy">Status</div>
                <div className="mt-1 text-sm text-booknest-navy">{viewing.status}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-booknest-navy">Bio</div>
                <div className="mt-2 text-sm leading-relaxed text-booknest-muted">
                  {viewing.bio || "No bio"}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-booknest-navy">Books</div>
                <div className="mt-2 text-sm text-booknest-muted">
                  {bookCountByAuthor.get(viewing.name.toLowerCase()) ?? 0} linked titles
                </div>
              </div>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        {deleteTarget ? (
          <>
            <div className="flex items-center justify-between border-b border-booknest-border px-6 py-4">
              <div className="text-sm font-semibold text-booknest-navy">
                Remove author
              </div>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-booknest-muted">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-booknest-navy">
                  {deleteTarget.name}
                </span>
                ? Books linked to this author will be reassigned to{" "}
                <span className="font-semibold">Unknown</span>.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-booknest-navy"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    remove(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Delete author
                </button>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </AdminLayout>
  );
};

export default ManageAuthors;
