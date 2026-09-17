"use client";

/**
 * Finding a customer, and opening one.
 *
 * The search box is debounced and the page resets whenever the term changes —
 * page 4 of a different result set is not where anybody was.
 */

import { useEffect, useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  getAdminCustomer,
  listAdminCustomers,
  type AdminCustomer,
  type AdminCustomerDetail,
  type PageMeta,
} from "../../../api/admin";
import { PAGE_SIZE } from "./types";

export const useCustomers = () => {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { data, loading, error } = useFetch<{ items: AdminCustomer[]; meta: PageMeta }>(
    () => listAdminCustomers({ q: debouncedQ, page, pageSize: PAGE_SIZE }),
    [debouncedQ, page],
  );

  return {
    q,
    setQ,
    rows: useMemo(() => data?.items ?? [], [data]),
    meta: data?.meta,
    loading,
    error,
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
    nextPage: () => setPage((p) => p + 1),
    openId,
    detail,
    detailError,
    /** The whole history in one request rather than three. */
    open: (id: string) => {
      setOpenId(id);
      setDetail(null);
      setDetailError(null);
      getAdminCustomer(id)
        .then(setDetail)
        .catch((err) => setDetailError(err?.message || "Could not load this customer."));
    },
    close: () => {
      setOpenId(null);
      setDetail(null);
    },
  };
};

type UseCustomers = ReturnType<typeof useCustomers>;
