"use client";

/**
 * Everything the dashboard reads.
 *
 * Four independent requests rather than one: each panel appears as its own
 * answer arrives, so a slow sales-trend query does not hold up the queue counts
 * that somebody opened the page to act on.
 */

import useFetch from "../../../hooks/useFetch";
import {
  fetchAdminDashboardOverview,
  fetchAdminQueue,
  fetchInventoryDemand,
  fetchSalesTrend,
  type AdminQueueCounts,
  type SalesTrend,
  type AdminDashboardOverviewCard,
} from "../../../api/admin";
import type { TodoTile } from "./types";

export const useDashboard = () => {
  const {
    data: overview,
    loading,
    error,
  } = useFetch<AdminDashboardOverviewCard[]>(() => fetchAdminDashboardOverview(), []);

  const { data: trend, loading: trendLoading } = useFetch<SalesTrend>(() => fetchSalesTrend(7), []);

  /* Counted on the server. Deriving these in the browser meant downloading every
     order and every buyback row — 96 KB for four numbers, and growing. */
  const { data: queue } = useFetch<AdminQueueCounts>(() => fetchAdminQueue(), [], {
    // Shared with the sidebar, which renders the same counts as badges.
    cacheKey: "admin-queue",
    ttlMs: 60_000,
  });

  /* Out-of-stock titles ranked by how many people are waiting for them.
     The endpoint has existed since the wishlist did and nothing showed it —
     so the one number that says what to reorder was invisible, and the
     dashboard's right-hand column was a small chart above a lot of nothing. */
  const { data: demand } = useFetch(() => fetchInventoryDemand(6), []);

  const todo: TodoTile[] = [
    { label: "Orders to fulfil", count: queue?.orders_to_fulfil ?? 0, to: "/admin/orders" },
    { label: "Cash to collect", count: queue?.cash_to_collect ?? 0, to: "/admin/orders" },
    // Returns were missing from here entirely, so a damage claim sat unanswered
    // unless somebody thought to open the screen.
    { label: "Returns to decide", count: queue?.returns_to_decide ?? 0, to: "/admin/returns" },
    { label: "Refunds to send", count: queue?.returns_to_refund ?? 0, to: "/admin/returns" },
    { label: "Buyback to review", count: queue?.buyback_to_review ?? 0, to: "/admin/buyback" },
    { label: "Books to pay for", count: queue?.buyback_to_pay ?? 0, to: "/admin/buyback" },
  ];

  return {
    overview: overview ?? [],
    loading,
    error,
    trend,
    trendLoading,
    todo,
    waiting: todo.filter((t) => t.count > 0),
    clear: todo.filter((t) => t.count === 0),
    /** Until the counts arrive, say nothing rather than "all clear" — an empty
     *  queue and an unanswered request look the same to a reader otherwise. */
    nothingWaiting: Boolean(queue) && todo.every((t) => t.count === 0),
    demand,
  };
};

export type UseDashboard = ReturnType<typeof useDashboard>;
