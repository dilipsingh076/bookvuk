/**
 * Returns — asking for a book to be taken back.
 *
 * An order could be cancelled before dispatch and nothing existed afterwards, so
 * "it arrived torn" was an e-mail. On second-hand stock that happens regularly,
 * and it is exactly the stock where a buyer most needs to believe the shop will
 * put it right.
 */

import { getBaseUrl } from "./index";
import { downscaleImage } from "./buyback";

export type ReturnReason =
  | "damaged"
  | "not_as_described"
  | "wrong_item"
  | "missing_pages"
  | "other";

export type ReturnStatus = "requested" | "approved" | "rejected" | "refunded";

/** What each reason means, in the customer's words rather than the column's. */
export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  damaged: "It arrived damaged",
  not_as_described: "Not the condition described",
  wrong_item: "The wrong book arrived",
  missing_pages: "Pages are missing or unreadable",
  other: "Something else",
};

export type ReturnPhoto = { id: string; url: string; position: number };

export type ReturnRequest = {
  id: string;
  orderId: string;
  orderItemId: string;
  reason: ReturnReason;
  detail: string | null;
  quantity: number;
  status: ReturnStatus;
  resolution: "wallet" | "source" | "replacement" | "none" | null;
  refundAmount: number | null;
  rejectionReason: string | null;
  photos: ReturnPhoto[];
  bookTitle: string | null;
  createdAt: string;
  decidedAt: string | null;
  resolvedAt: string | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const authHeaders = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

/** Surface the API's own message: it is written to be read by the customer. */
const readError = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null;
  if (typeof detail === "string") return detail;
  // A 422 arrives as a list of field errors; the first one is the useful part.
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg.replace(/^Value error, /, "");
  }
  return fallback;
};

const normalize = (raw: any): ReturnRequest => ({
  id: String(raw?.id ?? ""),
  orderId: String(raw?.order_id ?? ""),
  orderItemId: String(raw?.order_item_id ?? ""),
  reason: raw?.reason ?? "other",
  detail: raw?.detail ?? null,
  quantity: num(raw?.quantity) || 1,
  status: raw?.status ?? "requested",
  resolution: raw?.resolution ?? null,
  refundAmount: raw?.refund_amount == null ? null : num(raw.refund_amount),
  rejectionReason: raw?.rejection_reason ?? null,
  photos: Array.isArray(raw?.photos)
    ? raw.photos.map((p: any) => ({
        id: String(p?.id ?? ""),
        url: String(p?.url ?? ""),
        position: num(p?.position),
      }))
    : [],
  bookTitle: raw?.book_title ?? null,
  createdAt: String(raw?.created_at ?? ""),
  decidedAt: raw?.decided_at ?? null,
  resolvedAt: raw?.resolved_at ?? null,
});

export const fetchMyReturns = async (token: string | null): Promise<ReturnRequest[]> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/returns`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await readError(res, "Could not load your returns"));
  const raw = await res.json();
  return (Array.isArray(raw) ? raw : []).map(normalize);
};

export const openReturn = async (
  token: string | null,
  input: { orderItemId: string; reason: ReturnReason; detail?: string; quantity?: number },
): Promise<ReturnRequest> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/returns`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      order_item_id: input.orderItemId,
      reason: input.reason,
      detail: input.detail ?? null,
      quantity: input.quantity ?? 1,
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not open that return"));
  return normalize(await res.json());
};

export const uploadReturnPhoto = async (
  token: string | null,
  requestId: string,
  file: File,
): Promise<ReturnRequest> => {
  const form = new FormData();
  // Shared with the sell flow: the same phone takes the same oversized picture.
  form.append("file", await downscaleImage(file));
  const res = await fetch(`${getBaseUrl()}/api/customer/returns/${requestId}/photos`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res, "Could not upload that photo"));
  return normalize(await res.json());
};

export const withdrawReturn = async (
  token: string | null,
  requestId: string,
): Promise<ReturnRequest> => {
  const res = await fetch(`${getBaseUrl()}/api/customer/returns/${requestId}/cancel`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not withdraw that return"));
  return normalize(await res.json());
};
