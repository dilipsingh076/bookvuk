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

const storageKey = "bookvuk_auth";

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
  discount: number | string;
  couponCode: string | null;
  walletCreditUsed: number | string;

  /** Whether the money arrived, and how it was meant to. */
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "refund_pending";
  paymentMethod: "online" | "cod";
  /** "test" / "live" when a gateway took it; null for cash or no payment. */
  paymentMode: "test" | "live" | null;
  paidAt: string | null;

  shipFullName: string | null;
  shipPhone: string | null;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;

  /** Which parcel it went in. `trackingUrl` is derived by the server from the
   *  other two — null when the courier has no per-consignment page (India Post
   *  wants the number typed into a form), in which case the number alone is
   *  still worth showing. */
  trackingCarrier: string | null;
  trackingCarrierLabel: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;

  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;

  items: Array<{ id: string; bookId: string; title: string; price: number | string; qty: number }>;
};

/** The order lifecycle, in the order it actually happens. */
export const ORDER_STATUSES = [
  "processing",
  "pending",
  "paid",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

/** Delivered and cancelled are terminal — cancelling restores stock, so reviving
 *  such an order would count that stock twice. Mirrors `can_transition` on the
 *  server, which rejects the same moves with a 409. */
export const isTerminalOrder = (status: string) =>
  status === "delivered" || status === "cancelled";

/** True when the shop is still owed money it has to go and collect. */
export const awaitingCashCollection = (o: AdminOrder) =>
  o.paymentMethod === "cod" && o.paymentStatus === "pending" && o.status !== "cancelled";

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

/** The four questions the Orders screen asks. Mirrors `core/order_queue.py`,
 *  which is what the server filters and counts with. */
export type OrderLens = "todo" | "cash" | "unpaid" | "all";

export type PageMeta = { page: number; page_size: number; total: number; pages: number };

export type AdminOrderPage = {
  items: AdminOrder[];
  meta: PageMeta;
  /** How many orders each lens holds, across the whole search — *not* counts of
   *  `items`. The tabs used to derive these from the downloaded rows, which
   *  stops being possible (and stops being right) once the list is a page. */
  counts: Record<OrderLens, number>;
};

export const listAdminOrders = async (params?: {
  q?: string;
  status?: string;
  lens?: OrderLens;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminOrderPage> => {
  assertAdminRole();
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.status) query.set("status", params.status);
  if (params?.lens) query.set("lens", params.lens);
  if (params?.dateFrom) query.set("date_from", params.dateFrom);
  if (params?.dateTo) query.set("date_to", params.dateTo);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("page_size", String(params.pageSize));
  const res = await adminFetch(`/api/admin/orders${query.toString() ? `?${query.toString()}` : ""}`);
  const data = (await res.json()) as { items: any[]; meta: PageMeta; counts: Record<OrderLens, number> };
  return {
    items: (data.items ?? []).map(normalizeAdminOrder),
    meta: data.meta,
    counts: data.counts,
  };
};

/* The courier list is the same one the seller's dispatch form uses, so it is
   served publicly and imported from one place rather than fetched twice from two
   endpoints that would then have to be kept in step. */
export { listCarriers } from "./publicCarriers";
export type { Carrier } from "./publicCarriers";

export const getAdminOrderById = async (orderId: string) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
  return normalizeAdminOrder(await res.json());
};

/** Record that a cash-on-delivery order was paid for at the door.
 *
 * The half of COD no gateway can do: without it the order stays `pending`
 * forever — delivered, money in hand, and missing from every revenue figure.
 */
export const collectAdminOrderCash = async (orderId: string) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/collect-cash`, {
    method: "POST",
  });
  return normalizeAdminOrder(await res.json());
};

/** Move an order on, optionally recording the parcel it went in.
 *
 * Tracking is accepted only alongside `shipped`, and lands in the same
 * transaction: two calls would leave a window — and, if the second failed, a
 * permanent state — where the order says shipped and nothing says in what.
 */
export const updateAdminOrderStatus = async (
  orderId: string,
  status: string,
  tracking?: { carrier: string; number: string },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PUT",
    body: JSON.stringify(
      tracking
        ? { status, trackingCarrier: tracking.carrier, trackingNumber: tracking.number }
        : { status },
    ),
  });
  return normalizeAdminOrder(await res.json());
};

/** Fix or clear a shipment already recorded, without touching the status.
 *
 * Deliberately silent: the customer was already told the parcel is on its way,
 * and a second "your order has shipped" because a digit was corrected is worse
 * than the typo. Pass nothing to clear it — the parcel never actually went.
 */
export const updateAdminOrderTracking = async (
  orderId: string,
  tracking?: { carrier: string; number: string },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/tracking`, {
    method: "PUT",
    body: JSON.stringify(
      tracking ? { trackingCarrier: tracking.carrier, trackingNumber: tracking.number } : {},
    ),
  });
  return normalizeAdminOrder(await res.json());
};

export type SalesTrendPoint = { date: string; label: string; units: number };
export type SalesTrend = { days: number; series: SalesTrendPoint[]; total: number };

export const fetchSalesTrend = async (days = 7): Promise<SalesTrend> => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/sales-trend?days=${days}`);
  return res.json();
};

export type DemandRow = {
  id: string;
  title: string;
  author: string | null;
  price: number;
  stock: number;
  /** How many people have this saved while it cannot be bought. */
  waiting: number;
};

/**
 * Out-of-stock titles ranked by how many people are waiting for them.
 *
 * Restocking without this is guesswork. Everyone counted here is already
 * subscribed to the back-in-stock notice, so the top of this list is the reorder
 * that pays for itself fastest.
 */
export const fetchInventoryDemand = async (
  limit = 20,
): Promise<{ items: DemandRow[]; totalWaiting: number }> => {
  const res = await adminFetch(`/api/admin/inventory/demand?limit=${limit}`);
  if (!res.ok) throw new Error("Could not load the waiting list");
  const raw = await res.json();
  return {
    items: (raw?.items ?? []).map((r: any) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      author: r.author ?? null,
      price: Number(r.price ?? 0),
      stock: Number(r.stock ?? 0),
      waiting: Number(r.waiting ?? 0),
    })),
    totalWaiting: Number(raw?.total_waiting ?? 0),
  };
};

// ---------------------------------------------------------------------------
// Buyback — the queue of customers offering the shop their used books
// ---------------------------------------------------------------------------

export type BuybackCondition = "like_new" | "good" | "fair";

export type BuybackStatus =
  | "submitted"
  | "approved"
  | "received"
  | "paid"
  | "rejected"
  | "cancelled"
  /** The offer lapsed before the seller posted the book. */
  | "expired";

/* Snake_case, unlike `AdminOrder` above. These schemas carry no alias generator,
 * so the wire format is the Python field name — mirrored here rather than
 * renamed in a normaliser, so a field can be traced from screen to model without
 * a translation step in between. */
export type AdminBuyback = {
  id: string;
  status: BuybackStatus;
  title: string;
  author: string | null;
  isbn: string | null;
  book_id: string | null;
  listed_price: number | string;
  condition: BuybackCondition;
  quantity: number;
  quoted_amount: number | string;
  final_amount: number | string | null;
  received_condition: BuybackCondition | null;
  payout_method: string | null;
  payout_reference: string | null;
  rejection_reason: string | null;
  seller_note: string | null;
  seller_email: string | null;
  seller_name: string | null;
  admin_note: string | null;
  payout_upi: string | null;
  payout_account_name: string | null;
  /** What the seller photographed — the reason a grade can be given to a book
   *  the shop has not yet held. */
  photos: Array<{ id: string; url: string; kind: string; position: number }>;
  /** How they posted it, once they did. `approved` alone could not tell "in the
   *  post" from "never sent". */
  seller_tracking_carrier: string | null;
  seller_tracking_carrier_label: string | null;
  seller_tracking_number: string | null;
  seller_tracking_url: string | null;
  dispatched_at: string | null;
  quote_expires_at: string | null;
  created_at: string;
  approved_at: string | null;
  received_at: string | null;
  paid_at: string | null;
};

/** What the shop pays, as a share of the printed price. Mirrors
 *  `core/buyback.py::BUYBACK_RATES` — shown so the grading step can say what a
 *  re-grade will cost before it is committed, rather than after. */
export const BUYBACK_RATES: Record<BuybackCondition, number> = {
  like_new: 0.3,
  good: 0.25,
  fair: 0.2,
};

export const CONDITION_LABELS: Record<BuybackCondition, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

/** Nothing moves on from these. */
export const isTerminalBuyback = (status: BuybackStatus) =>
  status === "paid" ||
  status === "rejected" ||
  status === "cancelled" ||
  status === "expired";

/** A hand-entered book has no catalogue row, and the payout endpoint refuses
 *  until one is chosen — a used copy with no parent is a row nothing can find. */
export const needsCatalogueParent = (r: AdminBuyback) => !r.book_id;

const normalizeBuyback = (raw: any): AdminBuyback => ({ ...raw });

export type BuybackLens = "review" | "arriving" | "intransit" | "topay" | "all";

export type AdminBuybackPage = {
  items: AdminBuyback[];
  meta: PageMeta;
  /** How much each tab holds across the whole queue — not counts of `items`. */
  counts: Record<BuybackLens, number>;
};

export const listAdminBuyback = async (params?: {
  status?: BuybackStatus;
  lens?: BuybackLens;
  page?: number;
  pageSize?: number;
}): Promise<AdminBuybackPage> => {
  assertAdminRole();
  const query = new URLSearchParams();
  if (params?.status) query.set("status_filter", params.status);
  if (params?.lens) query.set("lens", params.lens);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("page_size", String(params.pageSize));
  const res = await adminFetch(`/api/admin/buyback${query.toString() ? `?${query.toString()}` : ""}`);
  const data = await res.json();
  return {
    items: (data?.items ?? []).map(normalizeBuyback),
    meta: data?.meta ?? { page: 1, page_size: 50, total: 0, pages: 0 },
    counts: data?.counts ?? { review: 0, arriving: 0, intransit: 0, topay: 0, all: 0 },
  };
};

export const decideBuyback = async (
  id: string,
  body: { approve: boolean; admin_note?: string; rejection_reason?: string },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/buyback/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeBuyback(await res.json());
};

export const receiveBuyback = async (
  id: string,
  body: { received_condition: BuybackCondition; override_amount?: number; admin_note?: string },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/buyback/${encodeURIComponent(id)}/receive`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeBuyback(await res.json());
};

export const payBuyback = async (
  id: string,
  body: { payout_reference?: string; parent_book_id?: string; resale_price?: number },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/buyback/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeBuyback(await res.json());
};

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export type AdminCoupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  value: number | string;
  min_subtotal: number | string;
  max_discount: number | string | null;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  max_redemptions_per_user: number | null;
  times_redeemed: number;
  /** What the code cost, on paid orders only. `times_redeemed` says a code was
   *  popular, which is not the question — a code used forty times that gave away
   *  more than it earned is a loss the counter reports as a success. */
  discount_given: number | string;
  /** Revenue on those same paid orders. The order total, not the margin: the
   *  shop knows its own margin and the server does not. */
  revenue: number | string;
};

export type AdminCouponInput = {
  code: string;
  description?: string;
  discount_type: "percent" | "fixed";
  value: number;
  min_subtotal?: number;
  max_discount?: number;
  is_active?: boolean;
  starts_at?: string;
  expires_at?: string;
  max_redemptions?: number;
  max_redemptions_per_user?: number;
};

/** Live *right now* — not just `is_active`, which says nothing about the window
 *  or the cap. A code can be active and still refuse every customer. */
export const couponIsLive = (c: AdminCoupon, now = new Date()) => {
  if (!c.is_active) return false;
  if (c.starts_at && new Date(c.starts_at) > now) return false;
  if (c.expires_at && new Date(c.expires_at) < now) return false;
  if (c.max_redemptions != null && c.times_redeemed >= c.max_redemptions) return false;
  return true;
};

/** Why it is not live, in the customer's terms. */
export const couponStateLabel = (c: AdminCoupon, now = new Date()) => {
  if (!c.is_active) return "switched off";
  if (c.starts_at && new Date(c.starts_at) > now) return "not started";
  if (c.expires_at && new Date(c.expires_at) < now) return "expired";
  if (c.max_redemptions != null && c.times_redeemed >= c.max_redemptions) return "used up";
  return "live";
};

export const listAdminCoupons = async () => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/coupons");
  const data = await res.json();
  return (Array.isArray(data) ? data : []) as AdminCoupon[];
};

export const createAdminCoupon = async (body: AdminCouponInput) => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/coupons", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await res.json()) as AdminCoupon;
};

export const deleteAdminCoupon = async (id: string) => {
  assertAdminRole();
  await adminFetch(`/api/admin/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
};

// ---------------------------------------------------------------------------
// Store settings — the commerce rules, editable without a deploy
// ---------------------------------------------------------------------------

export type StoreSettingsFields = {
  shipping_flat_rate: number | string;
  free_shipping_threshold: number | string;
  /** A fraction, not a percentage: 0.05 is 5%. */
  tax_rate: number | string;
  cod_enabled: boolean;
  cod_max_order_total: number | string;
  wallet_max_redemption_percent: number;
};

export type StoreSettings = {
  /** What the shop actually charges right now. */
  effective: StoreSettingsFields;
  /** Only the values somebody set here. Anything missing comes from the
   *  deployment's environment — the screen says which, because a default nobody
   *  chose and a decision somebody made should not look the same. */
  overrides: Partial<StoreSettingsFields>;
  updated_at: string | null;
  updated_by: string | null;
};

export const fetchStoreSettings = async () => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/settings");
  return (await res.json()) as StoreSettings;
};

/** Send only what changed. `null` clears an override and hands that setting back
 *  to the environment; a field left out is untouched. */
export const updateStoreSettings = async (
  changes: Partial<Record<keyof StoreSettingsFields, number | boolean | null>>,
) => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(changes),
  });
  return (await res.json()) as StoreSettings;
};

/** How much work is waiting, counted on the server.
 *
 * The dashboard used to derive these by downloading every order and every
 * buyback request — 96 KB to render four numbers, growing with the shop. The
 * screens still judge rows with the predicates above, because they already hold
 * the rows; the dashboard holds none and should not fetch them to count.
 */
export type AdminQueueCounts = {
  orders_to_fulfil: number;
  cash_to_collect: number;
  buyback_to_review: number;
  buyback_to_pay: number;
  /** Returns were the one queue neither the dashboard nor the sidebar could
   *  see, so a damage claim sat unanswered unless somebody opened the screen. */
  returns_to_decide: number;
  returns_to_refund: number;
};

export const fetchAdminQueue = async () => {
  assertAdminRole();
  const res = await adminFetch("/api/admin/queue");
  return (await res.json()) as AdminQueueCounts;
};

// ---------------------------------------------------------------------------
// Customers — the people, not their orders
// ---------------------------------------------------------------------------

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  ordersCount: number;
  paidOrdersCount: number;
  /** Paid orders only. Counting placed orders would report an abandoned
   *  checkout as revenue, and this is the figure most likely to be read out. */
  totalSpent: number | string;
  lastOrderAt: string | null;
  /** Store credit they are holding — money the shop owes. */
  walletBalance: number | string;
};

export type AdminWalletEntry = {
  id: string;
  amount: number | string;
  kind: string;
  note: string | null;
  createdAt: string;
};

export type AdminCustomerDetail = AdminCustomer & {
  orders: AdminOrder[];
  walletEntries: AdminWalletEntry[];
  buybackCount: number;
};

export const listAdminCustomers = async (params?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AdminCustomer[]; meta: PageMeta }> => {
  assertAdminRole();
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("page_size", String(params.pageSize));
  const res = await adminFetch(
    `/api/admin/customers${query.toString() ? `?${query.toString()}` : ""}`,
  );
  return (await res.json()) as { items: AdminCustomer[]; meta: PageMeta };
};

export const getAdminCustomer = async (userId: string): Promise<AdminCustomerDetail> => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/customers/${encodeURIComponent(userId)}`);
  const raw = (await res.json()) as any;
  return { ...raw, orders: (raw.orders ?? []).map(normalizeAdminOrder) };
};

// ---------------------------------------------------------------------------
// Returns — "it arrived damaged"
// ---------------------------------------------------------------------------

export type AdminReturnStatus = "requested" | "approved" | "rejected" | "refunded";

export type AdminReturn = {
  id: string;
  order_id: string;
  order_item_id: string;
  reason: string;
  detail: string | null;
  quantity: number;
  status: AdminReturnStatus;
  resolution: "wallet" | "source" | "replacement" | "none" | null;
  refund_amount: number | string | null;
  rejection_reason: string | null;
  admin_note: string | null;
  photos: Array<{ id: string; url: string; position: number }>;
  book_title: string | null;
  /** What the line was charged — what a full refund means, without opening the
   *  order to work it out. */
  line_total: number | string | null;
  customer_name: string | null;
  customer_email: string | null;
  /** Whether the order was ever paid for. An order can reach `delivered` unpaid
   *  — cash nobody collected, or a gateway that never confirmed — and refunding
   *  one pays out money that never came in. */
  order_payment_status: string | null;
  order_payment_method: string | null;
  created_at: string;
  decided_at: string | null;
  resolved_at: string | null;
};

export const listAdminReturns = async (status?: AdminReturnStatus) => {
  assertAdminRole();
  const query = status ? `?status_filter=${encodeURIComponent(status)}` : "";
  const res = await adminFetch(`/api/admin/returns${query}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []) as AdminReturn[];
};

/** Accept or refuse. Deliberately moves no money — that is `resolveAdminReturn`,
 *  because accepting and paying can be hours apart and "approved, not yet
 *  refunded" is precisely the state a customer chases. */
export const decideAdminReturn = async (
  id: string,
  body: { approve: boolean; admin_note?: string; rejection_reason?: string },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/returns/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await res.json()) as AdminReturn;
};

export const resolveAdminReturn = async (
  id: string,
  body: { resolution: "wallet" | "source" | "replacement" | "none"; amount?: number; admin_note?: string },
) => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/returns/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await res.json()) as AdminReturn;
};

// ---------------------------------------------------------------------------
// Demand — what people wanted and the shop could not sell them
// ---------------------------------------------------------------------------

export type UsedDemandRow = {
  id: string;
  title: string;
  author: string | null;
  new_price: number | string | null;
  waiting: number;
  /** What the keenest buyer capped themselves at — what the shop can pay a
   *  seller and still sell. Null when somebody said "any price". */
  lowest_ceiling: number | string | null;
};

export type UsedDemand = { items: UsedDemandRow[]; total_waiting: number };

export const fetchUsedDemand = async (limit = 20): Promise<UsedDemand> => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/demand/used?limit=${limit}`);
  return (await res.json()) as UsedDemand;
};

export type SearchMiss = {
  id: string;
  term: string;
  hits: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
};

export const fetchSearchMisses = async (limit = 30): Promise<SearchMiss[]> => {
  assertAdminRole();
  const res = await adminFetch(`/api/admin/demand/searches?limit=${limit}`);
  const data = await res.json();
  return (data?.items ?? []) as SearchMiss[];
};

export const resolveSearchMiss = async (id: string): Promise<void> => {
  assertAdminRole();
  await adminFetch(`/api/admin/demand/searches/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
  });
};
