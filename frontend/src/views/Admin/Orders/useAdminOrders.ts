"use client";

/**
 * The order queue.
 *
 * Every filter is applied by the *server*, because the screen only holds one
 * page and cannot filter what it has not fetched — which is also why the lens
 * counts come down with the page rather than being counted here.
 */

import { useEffect, useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  collectAdminOrderCash,
  getAdminOrderById,
  listAdminOrders,
  updateAdminOrderStatus,
  updateAdminOrderTracking,
  type AdminOrder,
  type AdminOrderPage,
  type OrderLens,
} from "../../../api/admin";
import { PAGE_SIZE, type ShippingTarget } from "./types";

export const useAdminOrders = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [q, setQ] = useState("");
  /* Debounced, because each keystroke is now a request to the server rather than
     a filter over rows already in the browser. */
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<AdminOrder | null>(null);
  const [lens, setLens] = useState<OrderLens>("todo");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /* Which order is being shipped or corrected. Null when the dialog is shut. */
  const [shipping, setShipping] = useState<ShippingTarget | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* Any change to what is being asked for starts again at page one. Staying on
     page 4 of a narrower result set shows an empty list and looks like a bug. */
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, lens, dateFrom, dateTo]);

  const { data, loading, error } = useFetch<AdminOrderPage>(
    () =>
      listAdminOrders({
        q: debouncedQ,
        lens,
        page,
        pageSize: PAGE_SIZE,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [refreshKey, debouncedQ, lens, page, dateFrom, dateTo],
  );

  const rows = useMemo(() => data?.items ?? [], [data]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const run = (work: Promise<AdminOrder>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    work
      .then((updated) => {
        setDetail(updated);
        setShipping(null);
        refresh();
      })
      .catch((err) => setActionError(err?.message || fallback))
      .finally(() => setBusy(false));
  };

  return {
    // The search
    q,
    setQ,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    lens,
    setLens,
    // The page
    rows,
    /* The counts describe the whole search, not this page — the server computes
       them because a page cannot know what it is a page of. */
    counts: data?.counts,
    meta: data?.meta,
    loading,
    error,
    refresh,
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
    nextPage: () => setPage((p) => p + 1),
    // The detail dialog
    detail,
    /** Opens with the full record; the row is the fallback if that request
     *  fails, since a partial view beats no view. */
    open: (o: AdminOrder) => {
      getAdminOrderById(o.id)
        .then(setDetail)
        .catch(() => setDetail(o));
    },
    close: () => setDetail(null),
    busy,
    actionError,
    // Actions
    collectCash: (orderId: string) =>
      run(collectAdminOrderCash(orderId), "Could not record the cash."),
    updateStatus: (orderId: string, status: AdminOrder["status"]) => {
      // Shipping is not a status change on its own — it is a status change plus
      // a parcel. Intercepted here so the consignment number is asked for while
      // whoever packed it still has the label, rather than never.
      const order = rows.find((o) => o.id === orderId) ?? detail;
      if (status === "shipped" && order) {
        setActionError(null);
        setShipping({ order, mode: "ship" });
        return;
      }
      run(updateAdminOrderStatus(orderId, status), "Could not update the status.");
    },
    // The ship dialog
    shipping,
    editShipment: (order: AdminOrder) => {
      setActionError(null);
      setShipping({ order, mode: "edit" });
    },
    cancelShipping: () => {
      setShipping(null);
      setActionError(null);
    },
    saveShipment: (tracking: { carrier: string; number: string }) => {
      if (!shipping) return;
      run(
        shipping.mode === "ship"
          ? // One request, so the status and the parcel land together: two calls
            // could leave an order permanently marked shipped with nothing
            // recording what it went in.
            updateAdminOrderStatus(shipping.order.id, "shipped", tracking)
          : updateAdminOrderTracking(shipping.order.id, tracking),
        "Could not save the shipment.",
      );
    },
    clearShipment: () => {
      if (!shipping) return;
      run(updateAdminOrderTracking(shipping.order.id), "Could not clear the shipment.");
    },
  };
};

export type UseAdminOrders = ReturnType<typeof useAdminOrders>;
