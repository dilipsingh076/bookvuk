"use client";

/**
 * The staff notification list.
 *
 * The items themselves come from the provider that also feeds the bell, so this
 * page and the bell can never disagree about the unread count. Sorting happens
 * here rather than on the server because the list is small and the provider's
 * order is whatever the endpoint returned.
 */

import { useMemo, useState } from "react";
import { useNotifications } from "../../../context/NotificationsContext";

export const useAdminNotifications = () => {
  const { items, loading, unreadCount, markAllRead, markAsRead, refresh } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items],
  );

  return {
    items: sorted,
    loading,
    unreadCount,
    markAsRead,
    markAllRead,
    refreshing,
    /* Really re-reads from the server. It used to bump a local key feeding a
       `useFetch(async () => null)` — a no-op — so the button re-rendered the same
       cached items and looked like "nothing new". */
    refresh: async () => {
      setRefreshing(true);
      try {
        await refresh();
      } finally {
        setRefreshing(false);
      }
    },
  };
};

type UseAdminNotifications = ReturnType<typeof useAdminNotifications>;
