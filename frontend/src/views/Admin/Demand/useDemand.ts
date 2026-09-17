"use client";

/** The two demand lists, and clearing a search term off the second one. */

import { useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  fetchSearchMisses,
  fetchUsedDemand,
  resolveSearchMiss,
  type SearchMiss,
  type UsedDemand,
} from "../../../api/admin";

export const useDemand = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: used, loading: usedLoading } = useFetch<UsedDemand>(() => fetchUsedDemand(20), [
    refreshKey,
  ]);
  const { data: misses, loading: missLoading } = useFetch<SearchMiss[]>(
    () => fetchSearchMisses(30),
    [refreshKey],
  );

  return {
    usedRows: useMemo(() => used?.items ?? [], [used]),
    usedLoading,
    missRows: useMemo(() => misses ?? [], [misses]),
    missLoading,
    busy,
    refresh: () => setRefreshKey((k) => k + 1),
    resolve: (id: string) => {
      setBusy(id);
      resolveSearchMiss(id)
        .then(() => setRefreshKey((k) => k + 1))
        .finally(() => setBusy(null));
    },
  };
};

export type UseDemand = ReturnType<typeof useDemand>;
