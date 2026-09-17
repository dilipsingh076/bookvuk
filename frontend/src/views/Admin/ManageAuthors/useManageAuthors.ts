"use client";

/** The author list, and the three dialogs over it: edit, view, delete. */

import { useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  createAdminAuthor,
  deleteAdminAuthor,
  listAdminAuthors,
  updateAdminAuthor,
  type AdminAuthor,
} from "../../../api/admin";
import { EMPTY_FORM, UNNAMED, type AuthorForm } from "./types";

export const useManageAuthors = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [q, setQ] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [showDraft, setShowDraft] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminAuthor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAuthor | null>(null);
  const [form, setForm] = useState<AuthorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    data: authorsData,
    loading,
    error,
  } = useFetch<AdminAuthor[]>(
    () =>
      listAdminAuthors({
        q,
        status: showActive && showDraft ? undefined : showActive ? "active" : "draft",
      }),
    [refreshKey, q, showActive, showDraft],
  );
  /* Memoised so the fallback is one array, not a new one per render: `?? []` fed
     the memos below a fresh identity on every render while the data was still
     loading, so they recomputed each time for nothing. */
  const authors = useMemo(() => authorsData ?? [], [authorsData]);

  /* Books are counted against the author's *name*, because a book carries its
     author as text as well as by id — a title typed in before the author row
     existed still belongs to them. */
  const bookCountByAuthor = useMemo(() => {
    const map = new Map<string, number>();
    authors.forEach((a) => {
      const row = a as AdminAuthor & { bookCount?: unknown; book_count?: unknown };
      const count = Number(row.bookCount ?? row.book_count ?? 0);
      map.set(a.name.toLowerCase(), Number.isFinite(count) ? count : 0);
    });
    return map;
  }, [authors]);

  /* Filtered here as well as on the server: the status tick-boxes can ask for
     both at once, which the endpoint expresses by sending no filter at all. */
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return authors.filter((a) => {
      const statusOk = (showActive && a.status === "active") || (showDraft && a.status === "draft");
      if (!statusOk) return false;
      if (!query) return true;
      return `${a.name} ${a.bio} ${a.status}`.toLowerCase().includes(query);
    });
  }, [authors, q, showActive, showDraft]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const core = {
      name: form.name.trim() || UNNAMED,
      bio: form.bio.trim(),
      status: form.status,
    };
    try {
      if (editingId === null) await createAdminAuthor(core);
      else await updateAdminAuthor(editingId, core);
      setEditorOpen(false);
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      /* Said out loud. The failure used to be swallowed, so a duplicate name
         left the dialog open with nothing to explain it. */
      setSaveError(e instanceof Error ? e.message : "Could not save that author.");
    } finally {
      setSaving(false);
    }
  };

  return {
    q,
    setQ,
    showActive,
    setShowActive,
    showDraft,
    setShowDraft,
    rows: filtered,
    loading,
    error,
    bookCountFor: (name: string) => bookCountByAuthor.get(name.toLowerCase()) ?? 0,
    refresh: () => setRefreshKey((k) => k + 1),
    // The editor
    editorOpen,
    editingId,
    form,
    setFormField: (key: keyof AuthorForm, value: string) =>
      setForm((f) => ({ ...f, [key]: value })),
    saving,
    saveError,
    openAdd: () => {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSaveError(null);
      setEditorOpen(true);
    },
    openEdit: (id: string) => {
      const a = authors.find((x) => x.id === id);
      if (!a) return;
      setEditingId(id);
      setForm({ name: a.name, bio: a.bio, status: a.status });
      setSaveError(null);
      setEditorOpen(true);
    },
    closeEditor: () => setEditorOpen(false),
    save,
    // Viewing and deleting
    viewing,
    view: setViewing,
    closeView: () => setViewing(null),
    deleteTarget,
    askDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete: () => {
      const target = deleteTarget;
      if (!target) return;
      setDeleteTarget(null);
      deleteAdminAuthor(target.id)
        .then(() => setRefreshKey((k) => k + 1))
        .catch(() => {
          /* The list refreshes either way; a failed delete simply leaves the
             author there, which is the honest outcome. */
        });
    },
  };
};

export type UseManageAuthors = ReturnType<typeof useManageAuthors>;
