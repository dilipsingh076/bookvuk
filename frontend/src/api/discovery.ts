/**
 * The gaps between what somebody wanted and what the shop could sell them.
 *
 * The used-book machine works and is nearly always empty — 2 of 200 titles have
 * a copy — so on almost every product page the used block correctly shows
 * nothing and the visitor leaves. These four calls are about recording that
 * visitor instead of losing them, and about asking the people who already own
 * the books for them.
 */

import { getBaseUrl } from "./index";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const authHeaders = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

const readError = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg.replace(/^Value error, /, "");
  }
  return fallback;
};

// ----- used-copy alerts -----

export type UsedAlert = {
  bookId: string;
  title: string;
  author: string | null;
  newPrice: number | null;
  maxPrice: number | null;
  createdAt: string;
  notifiedAt: string | null;
  /** How many others want the same title — the reason the shop will go and find
   *  one, and worth telling the person who asked. */
  waiting: number;
};

export const fetchUsedAlerts = async (token: string | null): Promise<UsedAlert[]> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/used-alerts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not load your alerts"));
  const raw = await res.json();
  return (Array.isArray(raw) ? raw : []).map((a: any) => ({
    bookId: String(a.book_id),
    title: String(a.title ?? ""),
    author: a.author ?? null,
    newPrice: a.new_price == null ? null : num(a.new_price),
    maxPrice: a.max_price == null ? null : num(a.max_price),
    createdAt: String(a.created_at ?? ""),
    notifiedAt: a.notified_at ?? null,
    waiting: num(a.waiting),
  }));
};

/** Ask to be told when a second-hand copy appears.
 *
 * `PUT`, because asking twice is the same ask — a second tap should move the
 * price ceiling rather than fail.
 */
export const setUsedAlert = async (
  token: string | null,
  bookId: string,
  maxPrice?: number,
): Promise<{ waiting: number }> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/used-alerts/${bookId}`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(maxPrice ? { max_price: maxPrice } : {}),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not set that alert"));
  return res.json();
};

export const clearUsedAlert = async (token: string | null, bookId: string): Promise<void> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/used-alerts/${bookId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not remove that alert"));
};

// ----- sell it back -----

export type SellBackOffer = {
  bookId: string;
  title: string;
  paid: number;
  listedPrice: number;
  /** What the shop would pay at the middle grade — the real figure depends on
   *  condition, which only the seller knows. */
  offer: number;
  orderedAt: string;
  alreadyOffered: boolean;
};

export const fetchSellBackOffers = async (token: string | null): Promise<SellBackOffer[]> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/sell-back-offers`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not load offers"));
  const raw = await res.json();
  return (Array.isArray(raw) ? raw : []).map((o: any) => ({
    bookId: String(o.book_id),
    title: String(o.title ?? ""),
    paid: num(o.paid),
    listedPrice: num(o.listed_price),
    offer: num(o.offer),
    orderedAt: String(o.ordered_at ?? ""),
    alreadyOffered: Boolean(o.already_offered),
  }));
};

// ----- cart savings -----

export type CartSaving = {
  cartBookId: string;
  usedBookId: string;
  title: string;
  condition: string;
  newPrice: number;
  usedPrice: number;
  saving: number;
  stock: number;
};

export const fetchCartUsedSavings = async (token: string | null): Promise<CartSaving[]> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/cart/used-savings`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return [];
  const raw = await res.json();
  return (Array.isArray(raw) ? raw : []).map((s: any) => ({
    cartBookId: String(s.cart_book_id),
    usedBookId: String(s.used_book_id),
    title: String(s.title ?? ""),
    condition: String(s.condition ?? "good"),
    newPrice: num(s.new_price),
    usedPrice: num(s.used_price),
    saving: num(s.saving),
    stock: num(s.stock),
  }));
};
