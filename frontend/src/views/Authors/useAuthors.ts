"use client";

/** Every author we stock, and the box that narrows the list. */

import { useMemo, useState } from "react";
import useFetch from "../../hooks/useFetch";
import { fetchAuthors, type CatalogAuthor } from "../../api/index";
import type { AuthorsProps } from "./types";

export const useAuthors = ({ initialAuthors = null }: AuthorsProps) => {
  const [filter, setFilter] = useState("");
  const { data, loading, error } = useFetch<CatalogAuthor[]>(() => fetchAuthors(), [], {
    cacheKey: "catalog-authors",
    ttlMs: 10 * 60_000,
    initialData: initialAuthors,
  });

  /* Memoised so the fallback is one array, not a new one per render: `?? []` fed
     the memo below a fresh identity on every render while the data was still
     loading, so it recomputed each time for nothing. */
  const authors = useMemo(() => data ?? [], [data]);

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return authors;
    return authors.filter((a) => a.name.toLowerCase().includes(term));
  }, [authors, filter]);

  return {
    loading,
    error,
    filter,
    setFilter,
    clearFilter: () => setFilter(""),
    total: authors.length,
    shown,
  };
};

type UseAuthors = ReturnType<typeof useAuthors>;
