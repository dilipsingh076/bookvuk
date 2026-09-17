"use client";

/**
 * The buyback queue.
 *
 * Each stage offers exactly the action that stage allows. Grading is deliberately
 * its own step: the condition claimed and the condition that turns up are often
 * different, and the re-quote has to happen before any money moves — so the
 * receive form shows what the new grade is worth *before* it is committed,
 * rather than reporting it afterwards.
 */

import { useEffect, useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  decideBuyback,
  listAdminBuyback,
  payBuyback,
  receiveBuyback,
  type AdminBuyback,
  type AdminBuybackPage,
  type BuybackCondition,
} from "../../../api/admin";
import { PAGE_SIZE, type BuybackLens } from "./types";

export const useBuyback = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lens, setLens] = useState<BuybackLens>("review");
  const [detail, setDetail] = useState<AdminBuyback | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state for the step-specific actions.
  const [rejectReason, setRejectReason] = useState("");
  const [grade, setGrade] = useState<BuybackCondition>("good");
  const [payoutRef, setPayoutRef] = useState("");
  const [parentBookId, setParentBookId] = useState("");

  const [page, setPage] = useState(1);

  const { data, loading, error } = useFetch<AdminBuybackPage>(
    () => listAdminBuyback({ lens, page, pageSize: PAGE_SIZE }),
    [refreshKey, lens, page],
  );

  /* Any change of lens starts again at page one: page 3 of a different tab is
     not where the admin was. */
  useEffect(() => {
    setPage(1);
  }, [lens]);

  const run = (work: Promise<AdminBuyback>, fallback: string) => {
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
    rows: useMemo(() => data?.items ?? [], [data]),
    /* The tab counts come from the server. They describe the whole queue, which a
       single page cannot see — and the lens filtering moved there with them, so
       the screen no longer holds every request the shop has ever had. */
    counts: data?.counts,
    meta: data?.meta,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
    nextPage: () => setPage((p) => p + 1),
    detail,
    open: (r: AdminBuyback) => {
      setActionError(null);
      setRejectReason("");
      // Default the grade to what the seller claimed: most arrive as described,
      // and pre-selecting it makes the *difference* the thing you have to act on.
      setGrade(r.received_condition ?? r.condition);
      setPayoutRef(r.payout_reference ?? "");
      setParentBookId("");
      setDetail(r);
    },
    close: () => setDetail(null),
    busy,
    actionError,
    // The stage forms
    rejectReason,
    setRejectReason,
    grade,
    setGrade,
    payoutRef,
    setPayoutRef,
    parentBookId,
    setParentBookId,
    approve: (id: string) => run(decideBuyback(id, { approve: true }), "Could not approve."),
    reject: (id: string) =>
      run(
        decideBuyback(id, { approve: false, rejection_reason: rejectReason.trim() }),
        "Could not reject.",
      ),
    receive: (id: string) =>
      run(receiveBuyback(id, { received_condition: grade }), "Could not record the grading."),
    pay: (id: string) =>
      run(
        payBuyback(id, {
          payout_reference: payoutRef.trim() || undefined,
          parent_book_id: parentBookId.trim() || undefined,
        }),
        "Could not record the payout.",
      ),
  };
};

export type UseBuyback = ReturnType<typeof useBuyback>;
