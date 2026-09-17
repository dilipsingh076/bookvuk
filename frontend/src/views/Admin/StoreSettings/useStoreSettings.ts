"use client";

/**
 * Editing the commerce rules.
 *
 * The screen distinguishes a **default** from a **decision**. A value coming from
 * the environment is shown as "from deployment" and a value somebody set here is
 * shown as an override with a way to clear it. That difference is the whole
 * point: 8% tax inherited from a template and 8% tax somebody chose look
 * identical in a plain form, and only one of them has been thought about.
 *
 * Only what actually changed is sent, so saving one field cannot silently pin
 * the other five as overrides.
 */

import { useEffect, useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  fetchStoreSettings,
  updateStoreSettings,
  type StoreSettings as Settings,
} from "../../../api/admin";
import { FIELDS, SAMPLE_ORDER, fromInput, toInput, type FieldKey } from "./types";

export const useStoreSettings = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [cod, setCod] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, loading, error: loadError } = useFetch<Settings>(() => fetchStoreSettings(), [
    refreshKey,
  ]);

  // Seed the form from whatever is in force, once the values arrive.
  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const f of FIELDS) {
      if (f.kind === "toggle") continue;
      next[f.key] = toInput(f.key, data.effective[f.key]);
    }
    setDraft(next);
    setCod(Boolean(data.effective.cod_enabled));
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return false;
    if (cod !== null && cod !== Boolean(data.effective.cod_enabled)) return true;
    return FIELDS.some(
      (f) => f.kind !== "toggle" && (draft[f.key] ?? "") !== toInput(f.key, data.effective[f.key]),
    );
  }, [data, draft, cod]);

  /** What the next customer would be charged, from what is on screen rather than
   *  from what is saved — so the figures are not abstract while being edited. */
  const preview = useMemo(() => {
    const threshold = Number(fromInput("free_shipping_threshold", draft.free_shipping_threshold ?? "") ?? 0);
    const flat = Number(fromInput("shipping_flat_rate", draft.shipping_flat_rate ?? "") ?? 0);
    const shipping = threshold > 0 && SAMPLE_ORDER >= threshold ? 0 : flat;
    const tax = SAMPLE_ORDER * Number(fromInput("tax_rate", draft.tax_rate ?? "") ?? 0);
    return { books: SAMPLE_ORDER, shipping, tax, total: SAMPLE_ORDER + shipping + tax };
  }, [draft]);

  const save = () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const changes: Record<string, number | boolean | null> = {};
    for (const f of FIELDS) {
      if (f.kind === "toggle") {
        if (cod !== null && cod !== Boolean(data.effective.cod_enabled)) changes[f.key] = cod;
        continue;
      }
      const current = toInput(f.key, data.effective[f.key]);
      if ((draft[f.key] ?? "") !== current) changes[f.key] = fromInput(f.key, draft[f.key] ?? "");
    }
    updateStoreSettings(changes)
      .then(() => {
        setSaved(true);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => setError(err?.message || "Could not save."))
      .finally(() => setBusy(false));
  };

  const clearOverride = (key: FieldKey) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    updateStoreSettings({ [key]: null })
      .then(() => setRefreshKey((k) => k + 1))
      .catch((err) => setError(err?.message || "Could not reset."))
      .finally(() => setBusy(false));
  };

  return {
    data,
    loading,
    loadError,
    draft,
    setDraftField: (key: FieldKey, value: string) =>
      setDraft((d) => ({ ...d, [key]: value })),
    cod,
    setCod,
    /** Whether somebody set this here, as opposed to it coming from deployment. */
    isOverridden: (key: FieldKey) =>
      Boolean(data && Object.prototype.hasOwnProperty.call(data.overrides, key)),
    dirty,
    preview,
    busy,
    error,
    saved,
    save,
    clearOverride,
  };
};

export type UseStoreSettings = ReturnType<typeof useStoreSettings>;
