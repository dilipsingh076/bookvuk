"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { getBaseUrl } from "../api/index";
import { reportLoadError } from "@/lib/loadError";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

type NotificationsContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Re-read the list from the server.
   *
   *  The provider polls once on mount, which is right for the bell — but the
   *  admin notifications page has a Refresh button, and without this it had
   *  nothing to call: it bumped a local key that re-rendered the same cached
   *  items, so pressing it looked like "there is genuinely nothing new". */
  refresh: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { getToken, isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const isAdmin = user?.role === "admin";
      const url = isAdmin
        ? `${getBaseUrl()}/api/admin/notifications`
        : `${getBaseUrl()}/api/customer/notifications`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please sign in again.");
      }
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();

      setItems(
        data.map((n: any) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          createdAt: n.created_at,
          read: n.is_read,
          href: n.href ?? undefined,
        }))
      );
    } catch (e) {
      reportLoadError("Notifications fetch error:", e, signal);
    } finally {
      setLoading(false);
    }
  }, [getToken, isAuthenticated, user?.role, logout]);

  useEffect(() => {
    if (authLoading) return;
    /* The bell polls on mount from every page, so it is the loudest of the three
       providers when a visitor clicks through quickly. Same reasoning as the
       cart: cancel on teardown, and do not report our own cancellation. */
    const controller = new AbortController();
    fetchNotifications(controller.signal);
    return () => controller.abort();
  }, [authLoading, fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) return;

      try {
        const isAdmin = user?.role === "admin";
        const url = isAdmin
          ? `${getBaseUrl()}/api/admin/notifications/${id}/read`
          : `${getBaseUrl()}/api/customer/notifications/${id}/read`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to mark notification as read");

        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      } catch (e) {
        reportLoadError("Mark notification read failed:", e);
      }
    },
    [getToken, user?.role]
  );

  const markAllRead = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const isAdmin = user?.role === "admin";
      const url = isAdmin
        ? `${getBaseUrl()}/api/admin/notifications/read-all`
        : `${getBaseUrl()}/api/customer/notifications/read-all`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to mark all notifications as read");

      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      reportLoadError("Mark all notifications read failed:", e);
    }
  }, [getToken, user?.role]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  /* No AbortSignal: this one is asked for explicitly by a button press, so it
     should finish even if something else re-renders underneath it. */
  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ items, unreadCount, loading, markAsRead, markAllRead, refresh }),
    [items, unreadCount, loading, markAsRead, markAllRead, refresh]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};