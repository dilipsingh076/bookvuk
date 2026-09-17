/** Labels, tones and formatters for the order queue. */

import type { AdminOrder, OrderLens } from "../../../api/admin";

export const PAGE_SIZE = 25;

export const formatMoney = (n: unknown) => {
  const num = Number(n);
  return `₹${(Number.isFinite(num) ? num : 0).toFixed(2)}`;
};

export const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null;

export const STATUS_TONE: Record<string, string> = {
  processing: "bg-bookvuk-lilac text-bookvuk-navy",
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-700",
  packed: "bg-sky-100 text-sky-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-bookvuk-lilac text-bookvuk-navy",
  cancelled: "bg-rose-100 text-rose-700",
};

/* The money state, which the admin screen could not show at all before: a paid
 * order and an unpaid one looked identical. Read as "what is owed", not "what
 * the column says" — a cash order that has not been collected is money still
 * outstanding, however far along the delivery is. */
export const paymentTone = (o: AdminOrder) => {
  if (o.paymentStatus === "paid") return "bg-emerald-100 text-emerald-700";
  if (o.paymentStatus === "failed") return "bg-rose-100 text-rose-700";
  if (o.paymentStatus === "refunded" || o.paymentStatus === "refund_pending")
    return "bg-zinc-200 text-zinc-700";
  return o.paymentMethod === "cod" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600";
};

export const paymentLabel = (o: AdminOrder) => {
  if (o.paymentStatus === "paid") return o.paymentMethod === "cod" ? "cash collected" : "paid";
  if (o.paymentStatus === "refund_pending") return "refund owed";
  if (o.paymentStatus === "pending") return o.paymentMethod === "cod" ? "cash due" : "unpaid";
  return o.paymentStatus;
};

/* "Everything" is the wrong default view for a screen whose job is to answer
   "what needs doing now". Each lens is a real piece of work, not a property of
   the data. */
export const LENS_LABELS: ReadonlyArray<readonly [OrderLens, string]> = [
  ["todo", "To fulfil"],
  ["cash", "Cash to collect"],
  ["unpaid", "Awaiting payment"],
  ["all", "All orders"],
] as const;

/** Which order is being shipped, and whether this is the first record of the
 *  parcel or a correction to one. */
export type ShippingTarget = { order: AdminOrder; mode: "ship" | "edit" };
