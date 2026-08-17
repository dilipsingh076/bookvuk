import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { getBaseUrl } from "../api/index";

export type NotificationItem = {
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
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { getToken, isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
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
      console.error("Notifications fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [getToken, isAuthenticated, user?.role, logout]);

  useEffect(() => {
    if (!authLoading) fetchNotifications();
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
        console.error(e);
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
      console.error(e);
    }
  }, [getToken, user?.role]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ items, unreadCount, loading, markAsRead, markAllRead }),
    [items, unreadCount, loading, markAsRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};