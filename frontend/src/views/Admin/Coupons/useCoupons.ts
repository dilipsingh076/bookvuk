"use client";

/** The code list, creating one, and deleting one. */

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  listAdminCoupons,
  type AdminCoupon,
  type AdminCouponInput,
} from "../../../api/admin";
import { BLANK } from "./types";

export const useCoupons = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState<AdminCouponInput>(BLANK);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminCoupon | null>(null);

  const { data, loading, error } = useFetch<AdminCoupon[]>(() => listAdminCoupons(), [refreshKey]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    createAdminCoupon({
      ...form,
      // The server upper-cases it anyway; doing it here means the list and the
      // thing you just typed agree immediately.
      code: form.code.trim().toUpperCase(),
      description: form.description?.trim() || undefined,
      value: Number(form.value),
      min_subtotal: form.min_subtotal ? Number(form.min_subtotal) : undefined,
      max_discount: form.max_discount ? Number(form.max_discount) : undefined,
      max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : undefined,
    })
      .then(() => {
        setForm(BLANK);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => setFormError(err?.message || "Could not create the code."))
      .finally(() => setBusy(false));
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setBusy(true);
    deleteAdminCoupon(pendingDelete.id)
      .then(() => {
        setPendingDelete(null);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => setFormError(err?.message || "Could not delete the code."))
      .finally(() => setBusy(false));
  };

  return {
    rows: useMemo(() => data ?? [], [data]),
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
    form,
    set: <K extends keyof AdminCouponInput>(key: K, value: AdminCouponInput[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    busy,
    formError,
    submit,
    pendingDelete,
    askDelete: setPendingDelete,
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
  };
};

export type UseCoupons = ReturnType<typeof useCoupons>;
