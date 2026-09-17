"use client";

/** The catalogue, and adding, editing or removing a title. */

import { useMemo, useState } from "react";
import useFetch from "../../../hooks/useFetch";
import {
  createAdminBook,
  deleteAdminBook,
  listAdminAuthors,
  listAdminBooksPaged,
  listAdminCategories,
  uploadAdminBookCover,
  updateAdminBook,
} from "../../../api/admin";
import type { Book } from "../../../api";
import {
  DEFAULT_FORMAT,
  LOW_STOCK,
  PAGE_SIZE,
  UNTITLED,
  toNumber,
  type BookForm,
} from "./types";

type PagedMeta = { page?: number; pages?: number; page_size?: number; total?: number };

export const useManageBooks = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<BookForm>({
    title: "",
    authorName: "",
    categoryId: "",
    format: DEFAULT_FORMAT,
    description: "",
    price: "0",
    stock: "0",
  });

  const { data: cats } = useFetch(() => listAdminCategories(), [refreshKey]);
  const { data: authors } = useFetch(() => listAdminAuthors(), [refreshKey]);
  const {
    data: booksPaged,
    loading,
    error,
  } = useFetch<{ items: Book[]; meta?: unknown }>(
    () => listAdminBooksPaged({ q, page, page_size: PAGE_SIZE }),
    [refreshKey, q, page],
  );

  /* Memoised so the fallback is one array, not a new one per render: `?? []` fed
     the memos below a fresh identity on every render while the data was still
     loading, so they recomputed each time for nothing. */
  const books = useMemo(() => booksPaged?.items ?? [], [booksPaged]);
  /* The endpoint types `meta` loosely; this screen needs the four fields it
     actually sends. */
  const meta = booksPaged?.meta as PagedMeta | undefined;

  const categoryById = useMemo(() => {
    const map = new Map<string, string>();
    cats?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [cats]);

  /* Filtered in the browser, on top of the server's page. The three tick-boxes
     are a view of *this* page rather than a query — which is why "Showing" and
     "Total" are separate figures on screen. */
  const filtered = useMemo(() => {
    const any = onlyInStock || onlyLowStock || onlyOutOfStock;
    if (!any) return books;
    return books.filter((b) => {
      const stock = b.stock ?? 0;
      return (
        (onlyInStock && stock > LOW_STOCK) ||
        (onlyLowStock && stock > 0 && stock <= LOW_STOCK) ||
        (onlyOutOfStock && stock === 0)
      );
    });
  }, [books, onlyInStock, onlyLowStock, onlyOutOfStock]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      title: form.title.trim() || UNTITLED,
      author: form.authorName.trim() || null,
      description: form.description.trim() || null,
      price: Math.max(0, toNumber(form.price)),
      stock: Math.max(0, Math.floor(toNumber(form.stock))),
      format: form.format.trim() || DEFAULT_FORMAT,
      category_id: form.categoryId,
    };

    try {
      // The cover is a second request either way: the upload needs the book's id.
      const saved =
        editingId === null
          ? await createAdminBook(payload)
          : await updateAdminBook(editingId, payload);
      if (coverFile) await uploadAdminBookCover(saved.id, coverFile);
      setEditorOpen(false);
      setEditingId(null);
      setCoverFile(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      /* Said out loud. The failure used to be swallowed, so a rejected save left
         the dialog open with no explanation. */
      setSaveError(e instanceof Error ? e.message : "Could not save that book.");
    } finally {
      setSaving(false);
    }
  };

  /* Behind a confirm, and the failure is not swallowed.
   *
   * Deleting a book is not a local act: `order_items` references it, so the
   * server can refuse, and a click that silently did nothing was
   * indistinguishable from one that worked. */
  const confirmRemove = () => {
    if (!deleteTarget) return;
    setRemoving(true);
    setRemoveError(null);
    deleteAdminBook(deleteTarget.id)
      .then(() => {
        setDeleteTarget(null);
        setRefreshKey((k) => k + 1);
      })
      .catch((err) => setRemoveError(err?.message || "Could not delete this book."))
      .finally(() => setRemoving(false));
  };

  return {
    // The list
    rows: filtered,
    loading,
    error,
    categoryFor: (id: string | null | undefined) => categoryById.get(id ?? "-"),
    q,
    setQ,
    totalCount: meta?.total ?? books.length,
    shownCount: filtered.length,
    currentPage: meta?.page ?? page,
    pageCount: meta?.pages ?? 1,
    pageSize: PAGE_SIZE,
    rangeEnd: meta?.total != null ? Math.min((meta.page ?? page) * PAGE_SIZE, meta.total) : null,
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
    nextPage: () => setPage((p) => p + 1),
    refresh: () => setRefreshKey((k) => k + 1),
    // Stock filters
    onlyInStock,
    setOnlyInStock,
    onlyLowStock,
    setOnlyLowStock,
    onlyOutOfStock,
    setOnlyOutOfStock,
    // The editor
    authors: authors ?? [],
    cats: cats ?? [],
    editorOpen,
    editingId,
    form,
    setFormField: (key: keyof BookForm, value: string) =>
      setForm((f) => ({ ...f, [key]: value })),
    coverFile,
    setCoverFile,
    saving,
    saveError,
    openAdd: () => {
      setEditingId(null);
      setCoverFile(null);
      setSaveError(null);
      setForm({
        title: "",
        authorName: authors?.[0]?.name ?? "",
        categoryId: cats?.[0]?.id ?? "",
        format: DEFAULT_FORMAT,
        description: "",
        price: "0",
        stock: "0",
      });
      setEditorOpen(true);
    },
    openEdit: (id: string) => {
      const b = books.find((x) => x.id === id);
      if (!b) return;
      setEditingId(id);
      setCoverFile(null);
      setSaveError(null);
      setForm({
        title: b.title,
        authorName: b.author ?? "",
        categoryId: String(b.category_id ?? ""),
        format: b.format ?? DEFAULT_FORMAT,
        description: b.description ?? "",
        price: String(b.price),
        stock: String(b.stock),
      });
      setEditorOpen(true);
    },
    closeEditor: () => setEditorOpen(false),
    save,
    // Deleting
    deleteTarget,
    askDelete: setDeleteTarget,
    cancelDelete: () => {
      setRemoveError(null);
      setDeleteTarget(null);
    },
    removing,
    removeError,
    confirmRemove,
  };
};

export type UseManageBooks = ReturnType<typeof useManageBooks>;
