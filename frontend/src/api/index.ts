export const getBaseUrl = (): string => {
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  const base = (envBase && envBase.trim()) || "http://127.0.0.1:8000";
  return base.replace(/\/+$/, "");
};

const isAbsoluteUrl = (url: string): boolean => /^https?:\/\//i.test(url);

export type Category = { id: string; name: string };

export type Book = {
  bookId: string;
  id: string;
  title: string;
  author: string;
  category: string;
  category_id?: string;
  rating: number;
  ratingCount: number;
  price: number;
  format: string;
  stockStatus: string;
  description: string;
  stock: number;
  /** Public URL under `public/` e.g. `/assets/books/en-001.jpg` */
  coverImage?: string;
  language?: "en" | "hi";
  /** Romanized / alternate spelling for cover search (Hindi titles). */
  titleSearch?: string;
  authorSearch?: string;
};

export const bookCoverSrc = (book: Pick<Book, "id" | "bookId" | "coverImage">): string => {
  const raw = (book.coverImage ?? `/static/books/${book.bookId || book.id}.jpg`).trim();
  if (!raw) return `${getBaseUrl()}/static/books/${book.bookId || book.id}.jpg`;
  if (isAbsoluteUrl(raw)) return raw;
  // If backend returns just a filename like `en-001.jpg`, treat it as a book cover in `/static/books/`.
  if (!raw.includes("/") && !raw.includes("\\")) {
    return `${getBaseUrl()}/static/books/${raw}`;
  }
  // Ensure relative `/static/...` paths load from backend, not Vite dev server.
  return `${getBaseUrl()}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

let categoriesCache: { at: number; value: Category[] } | null = null;
const CATEGORIES_TTL_MS = 60_000;

export const fetchCategories = async (): Promise<Category[]> => {
  if (categoriesCache && Date.now() - categoriesCache.at < CATEGORIES_TTL_MS) {
    return categoriesCache.value;
  }
  const res = await fetch(`${getBaseUrl()}/api/catalog/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  const data = (await res.json()) as Category[];
  categoriesCache = { at: Date.now(), value: Array.isArray(data) ? data : [] };
  return categoriesCache.value;
};

const normalizeCatalogBook = (raw: any, categoryById: Map<string, string>): Book => {
  const id = String(raw?.id ?? "");
  const bookId = String(raw?.bookId ?? raw?.book_id ?? raw?.catalog_id ?? raw?.id ?? "");
  const categoryId = raw?.category_id ?? raw?.categoryId ?? raw?.category?.id;
  const categoryNameFromId =
    categoryId != null ? categoryById.get(String(categoryId)) : undefined;

  const ratingCount = raw?.ratingCount ?? raw?.rating_count ?? 0;
  const stock = Number(raw?.stock ?? 0);
  const stockStatus =
    raw?.stockStatus ??
    raw?.stock_status ??
    (Number.isFinite(stock) && stock > 0 ? "in stock" : "out of stock");

  return {
    id,
    bookId,
    title: String(raw?.title ?? ""),
    author: String(raw?.author ?? ""),
    category: String(raw?.category ?? raw?.category_name ?? categoryNameFromId ?? ""),
    category_id: categoryId != null ? String(categoryId) : undefined,
    rating: Number.isFinite(Number(raw?.rating)) ? Number(raw?.rating) : 0,
    ratingCount: Number.isFinite(Number(ratingCount)) ? Number(ratingCount) : 0,
    price: Number.isFinite(Number(raw?.price)) ? Number(raw?.price) : 0,
    format: String(raw?.format ?? ""),
    stockStatus: String(stockStatus ?? ""),
    description: String(raw?.description ?? ""),
    stock: Number.isFinite(stock) ? stock : 0,
    coverImage: raw?.coverImage ?? raw?.cover_image,
  };
};

export const fetchBooks = async (): Promise<Book[]> => {
  const [cats, booksRes] = await Promise.all([
    fetchCategories().catch(() => [] as Category[]),
    fetch(getBaseUrl() + "/api/catalog/books"),
  ]);

  const categoryById = new Map<string, string>();
  cats.forEach((c) => categoryById.set(String(c.id), String(c.name)));

  const res = booksRes;
  if (!res.ok) {
    throw new Error("Failed to fetch books");
  }
  const data = (await res.json()) as any[];
  return (Array.isArray(data) ? data : []).map((b) => normalizeCatalogBook(b, categoryById));
};

export type PageMeta = {
  page: number;
  page_size: number;
  total: number;
  pages: number;
};

export type PaginatedBooks = {
  items: Book[];
  meta: PageMeta;
};

export const fetchBooksPaged = async (params: {
  page?: number;
  page_size?: number;
  q?: string;
  category_id?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "rating_desc" | "title_asc";
}): Promise<PaginatedBooks> => {
  const query = new URLSearchParams();

  if (params.page) query.append("page", String(params.page));
  if (params.page_size) query.append("page_size", String(params.page_size));
  if (params.q) query.append("q", params.q);
  if (params.category_id) query.append("category_id", params.category_id);
  if (params.sort) query.append("sort", params.sort);

  const res = await fetch(
    `${getBaseUrl()}/api/catalog/books/paged?${query.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch books");
  }

  const payload = (await res.json()) as { items?: any[]; meta?: PageMeta };
  const cats = await fetchCategories().catch(() => [] as Category[]);
  const categoryById = new Map<string, string>();
  cats.forEach((c) => categoryById.set(String(c.id), String(c.name)));

  return {
    meta: payload.meta as PageMeta,
    items: (payload.items ?? []).map((b) => normalizeCatalogBook(b, categoryById)),
  };
};

export const fetchBookById = async (bookId: string): Promise<Book> => {
  const res = await fetch(
    `${getBaseUrl()}/api/catalog/books/${bookId}`
  );

  if (!res.ok) {
    throw new Error("Book not found");
  }

  const raw = await res.json();
  const cats = await fetchCategories().catch(() => [] as Category[]);
  const categoryById = new Map<string, string>();
  cats.forEach((c) => categoryById.set(String(c.id), String(c.name)));
  return normalizeCatalogBook(raw, categoryById);
};
