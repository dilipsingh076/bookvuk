"use client";

/**
 * The returns queue.
 *
 * Shaped like the buyback queue, because it is the same kind of work: each lens
 * is a stage, and each stage offers only the action that stage allows. Deciding
 * and paying are separate events that can be days apart — which is why
 * "approved but unpaid" is its own lens, and the one a customer chases.
 */

import { useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  decideAdminReturn,
  listAdminReturns,
  resolveAdminReturn,
  type AdminReturn,
} from "../../../api/admin";
import type { ReturnLens, Resolution } from "./types";

export const useReturns = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lens, setLens] = useState<ReturnLens>("todo");
  const [detail, setDetail] = useState<AdminReturn | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resolution, setResolution] = useState<Resolution>("wallet");
  const [amount, setAmount] = useState("");

  const { data, loading, error } = useFetch<AdminReturn[]>(() => listAdminReturns(), [refreshKey]);
  const rows = useMemo(() => data ?? [], [data]);

  const lenses = useMemo(
    () => ({
      todo: rows.filter((r) => r.status === "requested"),
      topay: rows.filter((r) => r.status === "approved"),
      all: rows,
    }),
    [rows],
  );

  const run = (work: Promise<AdminReturn>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    work
      .then((updated) => {
        setDetail(updated);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => setActionError(err?.message || fallback))
      .finally(() => setBusy(false));
  };

  return {
    lens,
    setLens,
    lenses,
    rows: lenses[lens],
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
    detail,
    open: (r: AdminReturn) => {
      setActionError(null);
      setRejectReason("");
      // Not always "wallet": on an unpaid order the money options are not
      // offered, and defaulting to one the dropdown does not list would leave
      // the state holding a value the admin never chose — the same mismatch the
      // customer's return form had.
      setResolution(r.order_payment_status === "paid" ? "wallet" : "replacement");
      // Defaults to the full line. Almost every claim is refunded in full, and
      // pre-filling it makes a *partial* refund the deliberate act.
      setAmount(r.line_total != null ? String(Number(r.line_total)) : "");
      setDetail(r);
    },
    close: () => setDetail(null),
    busy,
    actionError,
    rejectReason,
    setRejectReason,
    resolution,
    setResolution,
    amount,
    setAmount,
    accept: (id: string) => run(decideAdminReturn(id, { approve: true }), "Could not accept it."),
    decline: (id: string) =>
      run(
        decideAdminReturn(id, { approve: false, rejection_reason: rejectReason.trim() }),
        "Could not decline it.",
      ),
    resolve: (id: string) =>
      run(
        resolveAdminReturn(id, {
          resolution,
          amount:
            resolution === "wallet" || resolution === "source" ? Number(amount) : undefined,
        }),
        "Could not resolve it.",
      ),
  };
};

export type UseReturns = ReturnType<typeof useReturns>;
