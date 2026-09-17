"use client";

/** The category list, and adding one. */

import { useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  createAdminCategory,
  listAdminCategories,
  type AdminCategory,
} from "../../../api/admin";

export const useCategories = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, loading, error } = useFetch<AdminCategory[]>(() => listAdminCategories(), [
    refreshKey,
  ]);

  const rows = useMemo(
    () => (data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createAdminCategory(trimmed);
      setName("");
      setOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      /* Said out loud. The failure used to be swallowed by an empty `.catch`,
         so a duplicate name closed nothing and reported nothing — the dialog
         simply sat there. */
      setSaveError(e instanceof Error ? e.message : "Could not add that category.");
    } finally {
      setSaving(false);
    }
  };

  return {
    rows,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
    open,
    openDialog: () => {
      setSaveError(null);
      setOpen(true);
    },
    closeDialog: () => setOpen(false),
    name,
    setName,
    saving,
    saveError,
    save,
  };
};

type UseCategories = ReturnType<typeof useCategories>;
