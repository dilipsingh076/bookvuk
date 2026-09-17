import { getBaseUrl, normalizeCatalogBook, type Book } from "./index";

/** Selling used books to the shop, and the store credit it pays out. */

export type BookCondition = "like_new" | "good" | "fair";

export type ConditionInfo = {
  value: BookCondition;
  label: string;
  description: string;
  buybackPercent: number;
};

export type ConditionOffer = {
  condition: BookCondition;
  label: string;
  description: string;
  offer: number;
  resalePrice: number;
};

export type Quote = {
  title: string | null;
  listedPrice: number;
  quantity: number;
  options: ConditionOffer[];
  /** False when even the best grade falls under the minimum worth handling. */
  canSell: boolean;
  message: string | null;
};

export type BuybackStatus =
  | "submitted"
  | "approved"
  | "received"
  | "paid"
  | "rejected"
  | "cancelled"
  /** The offer's validity window passed before the book was sent. */
  | "expired";

export type SellPhoto = {
  id: string;
  url: string;
  /** cover | spine | damage | other — what it shows, so a set of three reads at
   *  a glance instead of being three pictures of a book. */
  kind: string;
  position: number;
};

export type SellRequest = {
  id: string;
  status: BuybackStatus;
  title: string;
  author: string | null;
  listedPrice: number;
  condition: BookCondition;
  quantity: number;
  quotedAmount: number;
  finalAmount: number | null;
  receivedCondition: BookCondition | null;
  payoutMethod: "wallet" | "bank" | null;
  rejectionReason: string | null;
  /** What the seller photographed. Without these the shop grades a book it has
   *  never seen, re-grades it on arrival, and the payout changes. */
  photos: SellPhoto[];
  /** How the seller posted it, once they did. */
  trackingCarrier: string | null;
  trackingCarrierLabel: string | null;
  trackingNumber: string | null;
  /** Null when the courier has no per-consignment page; the number still shows. */
  trackingUrl: string | null;
  dispatchedAt: string | null;
  /** When the offer stops standing. Null means it does not expire. */
  quoteExpiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type WalletEntry = {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  createdAt: string;
};

export type Wallet = {
  balance: number;
  /** How much of the subtotal that was asked about the credit may cover. */
  maxRedeemableNow: number;
  maxRedemptionPercent: number;
  entries: WalletEntry[];
};

/** Surface the API's own message: it is written to be read by the customer. */
const readError = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && (detail[0] as { msg?: string })?.msg) {
    return String((detail[0] as { msg?: string }).msg);
  }
  return fallback;
};

const authHeaders = (token: string | null) => {
  if (!token) throw new Error("Please sign in to continue.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ----- quoting (public) -----

export const fetchConditions = async (): Promise<{
  conditions: ConditionInfo[];
  minimumAmount: number;
  /** How many open requests one seller may have. Reported so it is not copied here. */
  maxOpenRequests: number;
  /** Where to post an approved book, as address lines. Null until configured. */
  shipTo: string[] | null;
}> => {
  const res = await fetch(`${getBaseUrl()}/api/buyback/conditions`);
  if (!res.ok) throw new Error("Could not load the condition guide");
  const raw = await res.json();
  return {
    conditions: (raw?.conditions ?? []).map((c: any) => ({
      value: c.value,
      label: c.label,
      description: c.description,
      buybackPercent: num(c.buyback_percent),
    })),
    minimumAmount: num(raw?.minimum_amount),
    maxOpenRequests: num(raw?.max_open_requests) || 0,
    shipTo: Array.isArray(raw?.ship_to) && raw.ship_to.length ? raw.ship_to : null,
  };
};

export const fetchQuote = async (params: {
  bookId?: string;
  listedPrice?: number | string;
  quantity?: number;
}): Promise<Quote> => {
  const res = await fetch(`${getBaseUrl()}/api/buyback/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      book_id: params.bookId ?? null,
      listed_price: params.listedPrice ?? null,
      quantity: params.quantity ?? 1,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not price that book"));

  const raw = await res.json();
  return {
    title: raw?.title ?? null,
    listedPrice: num(raw?.listed_price),
    quantity: num(raw?.quantity) || 1,
    options: (raw?.options ?? []).map((o: any) => ({
      condition: o.condition,
      label: o.label,
      description: o.description,
      offer: num(o.offer),
      resalePrice: num(o.resale_price),
    })),
    canSell: Boolean(raw?.can_sell),
    message: raw?.message ?? null,
  };
};

// ----- submitting and tracking -----

const normalizeRequest = (raw: any): SellRequest => ({
  id: String(raw?.id ?? ""),
  status: raw?.status ?? "submitted",
  title: String(raw?.title ?? ""),
  author: raw?.author ?? null,
  listedPrice: num(raw?.listed_price),
  condition: raw?.condition ?? "good",
  quantity: num(raw?.quantity) || 1,
  quotedAmount: num(raw?.quoted_amount),
  finalAmount: raw?.final_amount == null ? null : num(raw.final_amount),
  receivedCondition: raw?.received_condition ?? null,
  payoutMethod: raw?.payout_method ?? null,
  rejectionReason: raw?.rejection_reason ?? null,
  photos: Array.isArray(raw?.photos)
    ? raw.photos.map((p: any) => ({
        id: String(p?.id ?? ""),
        url: String(p?.url ?? ""),
        kind: String(p?.kind ?? "other"),
        position: num(p?.position),
      }))
    : [],
  trackingCarrier: raw?.seller_tracking_carrier ?? null,
  trackingCarrierLabel: raw?.seller_tracking_carrier_label ?? null,
  trackingNumber: raw?.seller_tracking_number ?? null,
  trackingUrl: raw?.seller_tracking_url ?? null,
  dispatchedAt: raw?.dispatched_at ?? null,
  quoteExpiresAt: raw?.quote_expires_at ?? null,
  createdAt: String(raw?.created_at ?? ""),
  paidAt: raw?.paid_at ?? null,
});

type SubmitSellRequest = {
  bookId?: string;
  title?: string;
  author?: string;
  isbn?: string;
  listedPrice?: number | string;
  condition: BookCondition;
  quantity: number;
  payoutMethod: "wallet" | "bank";
  payoutUpi?: string;
  payoutAccountName?: string;
  sellerNote?: string;
};

export const submitSellRequest = async (
  token: string | null,
  input: SubmitSellRequest,
): Promise<SellRequest> => {
  const res = await fetch(`${getBaseUrl()}/api/buyback`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      book_id: input.bookId ?? null,
      title: input.title ?? null,
      author: input.author ?? null,
      isbn: input.isbn ?? null,
      listed_price: input.listedPrice ?? null,
      condition: input.condition,
      quantity: input.quantity,
      payout_method: input.payoutMethod,
      payout_upi: input.payoutUpi ?? null,
      payout_account_name: input.payoutAccountName ?? null,
      seller_note: input.sellerNote ?? null,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not submit your book"));
  return normalizeRequest(await res.json());
};

type SellRequestPage = {
  items: SellRequest[];
  meta: { page: number; page_size: number; total: number; pages: number };
  /** How many are still with the shop, across the whole list — the sell form
   *  warns against the per-seller cap with this. Not a count of `items`. */
  openCount: number;
};

/** This seller's requests, newest first.
 *
 * Paginated because nothing ever leaves the list — a cancelled or rejected
 * request stays — and one real account already carries 148 of them, which was
 * 95 KB on every visit.
 */
export const fetchMySellRequests = async (
  token: string | null,
  params?: { page?: number; pageSize?: number },
): Promise<SellRequestPage> => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("page_size", String(params.pageSize));
  const res = await fetch(
    `${getBaseUrl()}/api/buyback${query.toString() ? `?${query.toString()}` : ""}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(await readError(res, "Could not load your sell requests"));
  const raw = await res.json();
  return {
    items: (raw?.items ?? []).map(normalizeRequest),
    meta: raw?.meta ?? { page: 1, page_size: 20, total: 0, pages: 0 },
    openCount: num(raw?.open_count),
  };
};

export const cancelSellRequest = async (
  token: string | null,
  requestId: string,
): Promise<SellRequest> => {
  const res = await fetch(`${getBaseUrl()}/api/buyback/${requestId}/cancel`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not cancel that request"));
  return normalizeRequest(await res.json());
};

// ----- store credit -----

export const fetchWallet = async (
  token: string | null,
  subtotal = 0,
): Promise<Wallet> => {
  const res = await fetch(
    `${getBaseUrl()}/api/buyback/wallet?subtotal=${encodeURIComponent(subtotal)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(await readError(res, "Could not load your credit"));

  const raw = await res.json();
  return {
    balance: num(raw?.balance),
    maxRedeemableNow: num(raw?.max_redeemable_now),
    maxRedemptionPercent: num(raw?.max_redemption_percent),
    entries: (raw?.entries ?? []).map((e: any) => ({
      id: String(e.id),
      amount: num(e.amount),
      kind: String(e.kind ?? ""),
      note: e.note ?? null,
      createdAt: String(e.created_at ?? ""),
    })),
  };
};

// ----- used copies of a title -----

export const fetchUsedCopies = async (bookId: string): Promise<Book[]> => {
  const res = await fetch(`${getBaseUrl()}/api/catalog/books/${bookId}/used`);
  // A missing used-copies strip must never break the product page around it.
  if (!res.ok) return [];

  const raw = await res.json();
  return (Array.isArray(raw) ? raw : []).map((b) => normalizeCatalogBook(b));
};

/** How a wallet ledger `kind` reads to the customer. */
export const WALLET_KIND_LABELS: Record<string, string> = {
  buyback_payout: "Sold a book",
  order_redemption: "Used on an order",
  order_refund: "Returned from a cancelled order",
  adjustment: "Adjustment",
};

// ---------------------------------------------------------------------------
// Photographs
// ---------------------------------------------------------------------------

/**
 * Shrink a photograph before it leaves the phone.
 *
 * A modern phone camera produces 4–8 MB per shot and the server's ceiling is
 * 5 MB, so without this a seller's first upload fails and they have no idea why.
 * 1600px on the long edge is more than enough to judge a crease or a cracked
 * spine, and it turns a 6 MB upload over patchy mobile data into ~300 KB.
 *
 * Falls back to the original file if anything in the canvas path fails: a photo
 * that uploads slowly is better than one that does not upload.
 */
export const downscaleImage = async (file: File, maxEdge = 1600): Promise<File> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1_500_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;
    // The server decides what it accepts from the *extension*, so the name has
    // to match the type the canvas just produced.
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
};

export const uploadSellPhoto = async (
  token: string | null,
  requestId: string,
  file: File,
  kind: "cover" | "spine" | "damage" | "other",
): Promise<SellRequest> => {
  const form = new FormData();
  form.append("file", await downscaleImage(file));
  form.append("kind", kind);
  const res = await fetch(`${getBaseUrl()}/api/buyback/${requestId}/photos`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res, "Could not upload that photo"));
  return normalizeRequest(await res.json());
};

export const deleteSellPhoto = async (
  token: string | null,
  requestId: string,
  photoId: string,
): Promise<SellRequest> => {
  const res = await fetch(`${getBaseUrl()}/api/buyback/${requestId}/photos/${photoId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not remove that photo"));
  return normalizeRequest(await res.json());
};

/** Tell the shop the book is in the post.
 *
 * The consignment number is optional: plenty of sellers hand a parcel over a
 * counter and get no docket, and refusing their "I have posted it" because of
 * that would leave the shop blinder than before.
 */
export const markSellDispatched = async (
  token: string | null,
  requestId: string,
  tracking?: { carrier: string; trackingNumber: string },
): Promise<SellRequest> => {
  const res = await fetch(`${getBaseUrl()}/api/buyback/${requestId}/dispatch`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(
      tracking ? { carrier: tracking.carrier, tracking_number: tracking.trackingNumber } : {},
    ),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not record the dispatch"));
  return normalizeRequest(await res.json());
};
