import { useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import useFetch from "../../hooks/useFetch";
import { useNotifications } from "../../context/NotificationsContext";

const AdminNotifications = () => {
  const { items, loading, unreadCount, markAllRead, markAsRead } = useNotifications();
  const [refreshKey, setRefreshKey] = useState(0);

  // Reuse provider state; refreshKey is just to force rerender if needed.
  useFetch(async () => null, [refreshKey]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items],
  );

  return (
    <AdminLayout active="notifications">
      <div className="py-8">
        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-booknest-navy">Notifications</div>
              <div className="mt-1 text-sm text-booknest-muted">
                {unreadCount} unread
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
                onClick={() => markAllRead()}
                className="rounded-lg bg-booknest-purple px-4 py-2 text-sm font-semibold text-white"
                disabled={unreadCount === 0}
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="bg-booknest-lilac px-4 py-3 text-xs font-semibold text-booknest-muted">
              Latest
            </div>
            <div className="divide-y bg-white">
              {loading ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">Loading...</div>
              ) : sorted.length === 0 ? (
                <div className="px-4 py-6 text-sm text-booknest-muted">No notifications.</div>
              ) : (
                sorted.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markAsRead(n.id)}
                    className={`w-full px-4 py-4 text-left hover:bg-booknest-lilac/40 ${
                      n.read ? "" : "bg-booknest-lilac/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-booknest-navy">{n.title}</div>
                        {n.body ? (
                          <div className="mt-1 text-xs text-booknest-muted">{n.body}</div>
                        ) : null}
                        <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-booknest-muted/80">
                          {new Date(n.createdAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </div>
                      {!n.read ? (
                        <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminNotifications;

