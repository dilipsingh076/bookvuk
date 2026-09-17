"use client";

/** Stock levels, who is waiting, and adding copies. */

import { useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  fetchInventoryDemand,
  listAdminBooksPaged,
  restockAdminBook,
  type DemandRow,
} from "../../../api/admin";
import type { Book } from "../../../api";
import { DEFAULT_RESTOCK_QTY, LOW_STOCK_THRESHOLD } from "./types";

export const useInventory = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(DEFAULT_RESTOCK_QTY);
  const [restocking, setRestocking] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);

  const { data, loading, error } = useFetch<{ items: Book[] }>(
    () => listAdminBooksPaged({ page: 1, page_size: 50 }),
    [refreshKey],
  );
  /* Memoised so the fallback is one array, not a new one per render: `?? []` fed
     the memos below a fresh identity on every render while the data was still
     loading, so they recomputed each time for nothing. */
  const books = useMemo(() => data?.items ?? [], [data]);

  // Who is waiting for what. Separate from the stock lists because it answers a
  // different question: not "what has run out" but "what to reorder first".
  const { data: demand } = useFetch<{ items: DemandRow[]; totalWaiting: number }>(
    () => fetchInventoryDemand(20),
    [refreshKey],
  );

  const applyRestock = async () => {
    if (!restockId || restocking) return;
    setRestocking(true);
    setRestockError(null);
    try {
      await restockAdminBook(restockId, restockQty);
      setRestockOpen(false);
      setRestockId(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      /* Said out loud. The failure used to be swallowed by an empty `.catch`, so
         a rejected restock left the dialog open with no explanation. */
      setRestockError(e instanceof Error ? e.message : "Could not add that stock.");
    } finally {
      setRestocking(false);
    }
  };

  return {
    loading,
    error,
    lowStock: useMemo(
      () => books.filter((b) => b.stock > 0 && b.stock <= LOW_STOCK_THRESHOLD),
      [books],
    ),
    outOfStock: useMemo(() => books.filter((b) => b.stock === 0), [books]),
    waitingRows: demand?.items ?? [],
    totalWaiting: demand?.totalWaiting ?? 0,
    refresh: () => setRefreshKey((k) => k + 1),
    restockOpen,
    restockQty,
    setRestockQty,
    restocking,
    restockError,
    openRestock: (bookId: string) => {
      setRestockId(bookId);
      setRestockQty(DEFAULT_RESTOCK_QTY);
      setRestockError(null);
      setRestockOpen(true);
    },
    closeRestock: () => setRestockOpen(false),
    applyRestock,
  };
};

type UseInventory = ReturnType<typeof useInventory>;
