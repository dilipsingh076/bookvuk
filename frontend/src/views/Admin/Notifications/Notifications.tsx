"use client";

/** Everything the shop has been told about, newest first. */

import { Button, LoaderBlock } from "../../../components/ui";
import { useAdminNotifications } from "./useAdminNotifications";

const AdminNotifications = () => {
  const n = useAdminNotifications();

  return (
    <div className="py-8">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-extrabold text-bookvuk-navy">Notifications</div>
            <div className="mt-1 text-sm text-bookvuk-muted">{n.unreadCount} unread</div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={n.refresh}
              disabled={n.refreshing}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy disabled:opacity-60"
            >
              {n.refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Button
              type="button"
              onClick={() => n.markAllRead()}
              variant="primary-flat"
              disabled={n.unreadCount === 0}
            >
              Mark all read
            </Button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border">
          <div className="bg-bookvuk-lilac px-4 py-3 text-xs font-semibold text-bookvuk-muted">
            Latest
          </div>
          <div className="divide-y bg-white">
            {n.loading ? (
              <LoaderBlock size="md" height="panel" caption="Loading notifications…" />
            ) : n.items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-bookvuk-muted">No notifications.</div>
            ) : (
              n.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => n.markAsRead(item.id)}
                  className={`w-full px-4 py-4 text-left hover:bg-bookvuk-lilac/40 ${
                    item.read ? "" : "bg-bookvuk-lilac/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-bookvuk-navy">{item.title}</div>
                      {item.body ? (
                        <div className="mt-1 text-xs text-bookvuk-muted">{item.body}</div>
                      ) : null}
                      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-bookvuk-muted/80">
                        {new Date(item.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    {!item.read ? (
                      <span
                        className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-rose-500"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;
