import type { Book } from "./index";
import { getBaseUrl } from "./index";

export type AdminDashboardOverviewCard = {
  title: string;
  value: string;
  sub: string;
};

type StoredAuth = {
  user?: {
    role?: string;
  };
};

const storageKey = "booknest_auth";

const getStoredRole = (): string | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth | null;
    return parsed?.user?.role ? String(parsed.user.role) : null;
  } catch {
    return null;
  }
};

const assertAdminRole = () => {
  const role = getStoredRole();
  if (role !== "admin") {
    throw new Error("Forbidden: admin role required");
  }
};

type StoredAuthWithToken = {
  token?: string;
};

const getStoredToken = (): string | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthWithToken | null;
    return parsed?.token ? String(parsed.token) : null;
  } catch {
    return null;
  }
};

const adminFetch = async (path: string, init?: RequestInit) => {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!headers["Content-Type"] && init?.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(getBaseUrl() + path, { ...init, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res;
};

export const fetchAdminDashboardOverview = async (): Promise<
  AdminDashboardOverviewCard[]
> => {
  assertAdminRole();

  const res = await adminFetch("/api/admin/overview");
  return (await res.json()) as AdminDashboardOverviewCard[];
};

export const fetchAdminBookById = async (bookId: string): Promise<Book> => {
  assertAdminRole();
  const res = await adminFetch(`/api/catalog/books/${encodeURIComponent(bookId)}`);
  return normalizeAdminBook(await res.json());
};

export type AdminCategory = { id: string; name: string };

export const listAdminCategories = async (): Promise<AdminCategory[]> => {
  assertAdminRole();
  const res = await adminFetch("/api/catalog/categories");
  return (await res.json()) as AdminCategory[];
};

export const listAdminBooksPaged = async (params?: {
  q?: string;
  category_id?: string;
  page?: number;
  page_size?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "rating_desc" | "title_asc";
}) => {
  assertAdminRole();
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.category_id) query.set("category_id", params.category_id);
  if (params?.page) query.set("page", String(params.page));
  if (params?.page_size) query.set("page_size", String(params.page_size));
  if (params?.sort) query.set("sort", params.sort);
  const res = await adminFetch(
    `/api/catalog/books/paged${query.toString() ? `?${query.toString()}` : ""}`,
  );
  const data = (await res.json()) as { items: any[]; meta?: unknown };
  return { ...data, items: (data.items ?? []).map(normalizeAdminBook) } as {
    items: Book[];
    meta?: unknown;
  };
};

export const createAdminBook = async (payload: {
  title: string;
  author?: string | null;
  description?: string | null;
  price: number;
  stock: number;
  format: string;
  category_id: string;
}) => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/books", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeAdminBook(await res.json());
};

export const uploadAdminBookCover = async (bookId: string, file: File): Promise<Book> => {
  assertAdminRole();
  const fd = new FormData();
  fd.append("file", file);
  const res = await adminFetch(`/api/admin/books/${encodeURIComponent(bookId)}/cover`, {
    method: "POST",
    body: fd,
  });
  return normalizeAdminBook(await res.json());
};

export const updateAdminBook = async (
  bookId: string,
  payload: {
    title: string;
    author?: string | null;
    description?: string | null;
    price: number;
    stock: number;
    format: string;
    category_id: string;
  },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/books/${encodeURIComponent(bookId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeAdminBook(await res.json());
};

export const deleteAdminBook = async (bookId: string) => {
  assertAdminRole();
  await adminFetch(`/api/admin/books/${encodeURIComponent(bookId)}`, { method: "DELETE" });
};

/**
 * Example integration pattern (do not auto-wire UI):
 *
 * ```ts
 * import { listAdminOrders } from "./admin";
 *
 * const orders = await listAdminOrders({ q: "isha", status: "paid" });
 * ```
 */

export type AdminAuthor = { id: string; name: string; bio: string; status: "active" | "draft"; created_at?: string };

export const listAdminAuthors = async (params?: { q?: string; status?: string }) => {
  assertAdminRole();
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  const res = await adminFetch(`/api/admin/authors${query.toString() ? `?${query.toString()}` : ""}`);
  return (await res.json()) as AdminAuthor[];
};

export const createAdminAuthor = async (payload: { name: string; bio?: string; status?: "active" | "draft" }) => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/authors", { method: "POST", body: JSON.stringify({ bio: "", status: "active", ...payload }) });
  return (await res.json()) as AdminAuthor;
};

export const updateAdminAuthor = async (authorId: string, payload: Partial<{ name: string; bio: string; status: "active" | "draft" }>) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/authors/${encodeURIComponent(authorId)}`, { method: "PUT", body: JSON.stringify(payload) });
  return (await res.json()) as AdminAuthor;
};

export const deleteAdminAuthor = async (authorId: string) => {
  assertAdminRole();
  await adminFetch(`/api/admin/authors/${encodeURIComponent(authorId)}`, { method: "DELETE" });
};

export const restockAdminBook = async (bookId: string, addStock: number) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/inventory/books/${encodeURIComponent(bookId)}/restock`, {
    method: "POST",
    body: JSON.stringify({ addStock }),
  });
  return normalizeAdminBook(await res.json());
};

const normalizeAdminBook = (raw: any): Book => {
  const price = raw?.price;
  const rating = raw?.rating;
  const ratingCount = raw?.ratingCount ?? raw?.rating_count;

  return {
    // frontend Book shape
    id: String(raw?.id ?? ""),
    bookId: String(raw?.bookId ?? raw?.book_id ?? raw?.catalog_id ?? raw?.id ?? ""),
    title: String(raw?.title ?? ""),
    author: String(raw?.author ?? ""),
    category: String(raw?.category ?? raw?.category_name ?? ""),
    category_id: raw.category_id ?? raw.category?.id,
    rating: Number.isFinite(Number(rating)) ? Number(rating) : 0,
    ratingCount: Number.isFinite(Number(ratingCount)) ? Number(ratingCount) : 0,
    price: Number.isFinite(Number(price)) ? Number(price) : 0,
    format: String(raw?.format ?? ""),
    stockStatus: String(raw?.stockStatus ?? raw?.stock_status ?? ""),
    stock: Number.isFinite(Number(raw?.stock)) ? Number(raw?.stock) : 0,
    description: String(raw?.description ?? ""),
    coverImage: raw?.coverImage ?? raw?.cover_image,
  } as unknown as Book;
};

export const createAdminCategory = async (name: string): Promise<AdminCategory> => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return (await res.json()) as AdminCategory;
};

export type AdminOrder = {
  id: string;
  createdAt: string;
  status: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  subtotal: number | string;
  shipping: number | string;
  tax: number | string;
  total: number | string;
  items: Array<{ id: string; bookId: string; title: string; price: number | string; qty: number }>;
};

const normalizeAdminOrder = (raw: any): AdminOrder => ({
  ...raw,
  items: Array.isArray(raw?.items)
    ? raw.items.map((it: any) => ({
        id: String(it?.id ?? ""),
        bookId: String(it?.bookId ?? it?.book_id ?? ""),
        title: String(it?.title ?? it?.title_snapshot ?? ""),
        price: it?.price ?? it?.unit_price_snapshot ?? 0,
        qty: Number(it?.qty ?? it?.quantity ?? 0),
      }))
    : [],
});

export const listAdminOrders = async (params?: { q?: string; status?: string }) => {
  assertAdminRole();
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  const res = await adminFetch(`/api/admin/orders${query.toString() ? `?${query.toString()}` : ""}`);
  const data = (await res.json()) as any[];
  return (data ?? []).map(normalizeAdminOrder) as AdminOrder[];
};

export const getAdminOrderById = async (orderId: string) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
  return normalizeAdminOrder(await res.json());
};

export const updateAdminOrderStatus = async (orderId: string, status: string) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
  return normalizeAdminOrder(await res.json());
};
