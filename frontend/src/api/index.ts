export const getBaseUrl = (): string => {
  /* Where the API is, which differs by side.
   *
   * On the server there is no page origin, so an absolute address is required.
   * In the browser the answer is "" — a relative URL, which Next's rewrite sends
   * on to the service. That keeps every request same-origin: no CORS preflight,
   * cookies would work if the session ever moves off localStorage, and the API's
   * address never appears in the HTML.
   *
   * The old fallback to `http://127.0.0.1:8000` in the browser was left over from
   * the Vite build, where there was no rewrite to use. It made every client
   * request cross-origin, which the Content-Security-Policy correctly blocked —
   * search and the category filters stopped fetching, and that is how this was
   * found. */
  if (typeof window === "undefined") {
    const server = process.env.API_INTERNAL_URL?.trim();
    return (server || "http://127.0.0.1:8000").replace(/\/+$/, "");
  }
  const browser = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return browser ? browser.replace(/\/+$/, "") : "";
};


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
  /** Absolute URL of the cover in object storage, or null if the book has none. */
  coverImage?: string;
  /** "new" for a catalogue listing, or the grade of a used copy. */
  condition?: string;
  /** Set on a used copy: the catalogue title it belongs to. */
  parentBookId?: string | null;
  /**
   * "Bestseller" when the server says the book has genuinely sold. Never derived
   * in the browser — this used to be `hash(id) % 5`, which badged a fifth of the
   * catalogue at random.
   */
  badge?: string | null;
  language?: "en" | "hi";
  /** Romanized / alternate spelling for cover search (Hindi titles). */
  titleSearch?: string;
  authorSearch?: string;
};

/** Where a book's cover actually lives, or the placeholder if it has none.
 *
 * The database is the only source of truth: `cover_image` holds the object's
 * full URL in Supabase Storage, keyed by the book's id. This used to *guess* —
 * falling back to `/static/books/{bookId}.jpg`, reconstructing paths from bare
 * filenames — because the column was NULL for every seeded book and the
 * filename was a convention nobody had written down. Four branches of guessing,
 * and a missing cover was something no query could find.
 *
 * Absolute by nature now, which is what `og:image` needed anyway: a scraper
 * reading that tag cannot resolve a path against this site. */
export const bookCoverSrc = (book: Pick<Book, "coverImage">): string =>
  (book.coverImage ?? "").trim() || BOOK_COVER_PLACEHOLDER;

/** Shown when a book has no cover, and when one fails to load. */
export const BOOK_COVER_PLACEHOLDER = "/assets/books/placeholder.svg";

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

/** The API sends the category name with each book, so nothing here has to look it
 *  up. The parameter is optional only so a caller with a list already in hand can
 *  still pass one. */
export const normalizeCatalogBook = (raw: any, categoryById?: Map<string, string>): Book => {
  const id = String(raw?.id ?? "");
  const bookId = String(raw?.bookId ?? raw?.book_id ?? raw?.catalog_id ?? raw?.id ?? "");
  const categoryId = raw?.category_id ?? raw?.categoryId ?? raw?.category?.id;
  const categoryNameFromId =
    categoryId != null ? categoryById?.get(String(categoryId)) : undefined;

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
    badge: raw?.badge ?? null,
    condition: raw?.condition ?? "new",
    parentBookId: raw?.parent_book_id ?? raw?.parentBookId ?? null,
  };
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

export type ServerSort =
  | "relevance"
  | "newest"
  | "popular"
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "title_asc";

export type CatalogFacets = {
  total: number;
  categories: Record<string, number>;
  /** How much stock there is of each kind. Lets the browse page offer a "used"
   *  chip with a number, and hide it when the shop has no second-hand stock
   *  rather than sending shoppers to an empty shelf. */
  conditions?: { new: number; used: number };
};

export const fetchCatalogFacets = async (): Promise<CatalogFacets> => {
  const res = await fetch(getBaseUrl() + "/api/catalog/facets");
  if (!res.ok) throw new Error("Failed to fetch catalogue facets");
  return res.json();
};

export const fetchBooksPaged = async (params: {
  page?: number;
  page_size?: number;
  q?: string;
  category_id?: string;
  min_rating?: number;
  sort?: ServerSort;
  /** "used" swaps the listing over to second-hand copies, which are otherwise
   *  excluded because they are variants of a title rather than listings of their
   *  own. Supported by the API all along and never called. */
  condition?: "new" | "used";
}): Promise<PaginatedBooks> => {
  const query = new URLSearchParams();

  if (params.page) query.append("page", String(params.page));
  if (params.page_size) query.append("page_size", String(params.page_size));
  if (params.q) query.append("q", params.q);
  if (params.min_rating !== undefined) query.append("min_rating", String(params.min_rating));
  if (params.category_id) query.append("category_id", params.category_id);
  if (params.sort) query.append("sort", params.sort);
  if (params.condition) query.append("condition", params.condition);

  const res = await fetch(
    `${getBaseUrl()}/api/catalog/books/paged?${query.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch books");
  }

  const payload = (await res.json()) as { items?: any[]; meta?: PageMeta };

  return {
    meta: payload.meta as PageMeta,
    items: (payload.items ?? []).map((b) => normalizeCatalogBook(b)),
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
  return normalizeCatalogBook(raw);
};

export type TrendingShelf = {
  /**
   * What the shelf actually is. "sales" means these genuinely sold in the window;
   * "rating" means not enough has sold and this is the top-rated fallback. The
   * heading is chosen from this, because the section used to claim "Trending this
   * week" while showing the all-time highest rated books.
   */
  basis: "sales" | "rating";
  windowDays: number;
  items: Book[];
};

export const fetchTrending = async (limit = 4, days = 7): Promise<TrendingShelf> => {
  /* Freshness stated here rather than inherited.
   *
   * A page-level `revalidate` also applies to the fetches inside it, so this
   * request was being cached for thirty minutes in `.next/cache` — which meant a
   * rebuild could serve a shelf from before the change that rebuilt it. Five
   * minutes matches the `Cache-Control` the endpoint already sends, so the two
   * layers now agree on how stale this is allowed to be. */
  const res = await fetch(
    `${getBaseUrl()}/api/catalog/trending?limit=${limit}&days=${days}`,
    { next: { revalidate: 300 } } as RequestInit,
  );
  if (!res.ok) throw new Error("Failed to fetch trending books");

  const raw = await res.json();
  return {
    basis: raw?.basis === "sales" ? "sales" : "rating",
    windowDays: Number(raw?.window_days ?? days),
    items: (Array.isArray(raw?.items) ? raw.items : []).map((b: any) =>
      normalizeCatalogBook(b),
    ),
  };
};

/** Books to suggest alongside `bookId`. The ordering rule lives on the server. */
export const fetchRelatedBooks = async (bookId: string, limit = 6): Promise<Book[]> => {
  const res = await fetch(
    `${getBaseUrl()}/api/catalog/books/${bookId}/related?limit=${limit}`
  );

  // A dead cross-sell strip must never break the product page around it.
  if (!res.ok) return [];

  const raw = await res.json();
  return (Array.isArray(raw) ? raw : []).map((b) => normalizeCatalogBook(b));
};


export type CatalogAuthor = { name: string; slug: string; books: number; topRating: number };

/** Every author the shop stocks, most-stocked first. */
export const fetchAuthors = async (): Promise<CatalogAuthor[]> => {
  const res = await fetch(`${getBaseUrl()}/api/catalog/authors`);
  if (!res.ok) throw new Error("Could not load the authors");
  const raw = await res.json();
  return (raw?.authors ?? []).map((a: any) => ({
    name: String(a.name ?? ""),
    slug: String(a.slug ?? ""),
    books: Number(a.books ?? 0),
    topRating: Number(a.top_rating ?? 0),
  }));
};

/** Every listed book, for the sitemap.
 *
 * Second-hand copies are excluded by the endpoint: each carries its parent's
 * title and description and is reached through the parent's page, so listing it
 * would ask a search engine to index the same book twice.
 */
type SitemapBook = { id: string; updatedAt: string | null };

export const fetchSitemapBooks = async (): Promise<SitemapBook[]> => {
  // page_size is capped at 50 server-side, so this walks the catalogue.
  const out: SitemapBook[] = [];
  for (let page = 1; page <= 40; page += 1) {
    const res = await fetch(
      `${getBaseUrl()}/api/catalog/books/paged?page=${page}&page_size=50`,
      { next: { revalidate: 1800 } } as RequestInit,
    );
    if (!res.ok) throw new Error("Failed to fetch the catalogue for the sitemap");
    const body = await res.json();
    const items: Array<Record<string, unknown>> = body.items ?? [];
    for (const item of items) {
      const id = String(item.id ?? item.bookId ?? "");
      if (id) out.push({ id, updatedAt: (item.created_at as string | null) ?? null });
    }
    const pages = Number(body.meta?.pages ?? 1);
    if (page >= pages) break;
  }
  return out;
};

/** One author and everything the shop stocks by them. */
export type AuthorPage = { name: string; slug: string; total: number; items: Book[] };

export const fetchAuthorBySlug = async (slug: string): Promise<AuthorPage> => {
  const res = await fetch(
    `${getBaseUrl()}/api/catalog/authors/${encodeURIComponent(slug)}`,
    { next: { revalidate: 1800 } } as RequestInit,
  );
  if (!res.ok) throw new Error("Author not found");
  const raw = await res.json();
  return {
    name: String(raw?.name ?? ""),
    slug: String(raw?.slug ?? slug),
    total: Number(raw?.total ?? 0),
    items: (Array.isArray(raw?.items) ? raw.items : []).map((b: any) =>
      normalizeCatalogBook(b),
    ),
  };
};
