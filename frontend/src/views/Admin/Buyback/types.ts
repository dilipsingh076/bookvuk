/** Labels, tones and arithmetic for the buyback queue. */

import { BUYBACK_RATES, type AdminBuyback, type BuybackCondition } from "../../../api/admin";

/** Each lens is a different job, not a different filter: reviewing an offer,
 *  waiting on a parcel, and paying for one that arrived happen on different days. */
export type BuybackLens = "review" | "arriving" | "intransit" | "topay" | "all";

export const LENS_LABELS: ReadonlyArray<readonly [BuybackLens, string]> = [
  ["review", "To review"],
  ["arriving", "Not posted yet"],
  ["intransit", "In the post"],
  ["topay", "To pay"],
  ["all", "All requests"],
] as const;

/** What an empty lens means, which differs by lens. */
export const EMPTY_TEXT: Record<BuybackLens, string> = {
  review: "Nothing waiting on a decision.",
  arriving: "No approved books still on their way.",
  intransit: "No approved books still on their way.",
  topay: "Nothing graded and waiting to be paid.",
  all: "No buyback requests yet.",
};

export const PAGE_SIZE = 50;

export const formatMoney = (n: unknown) => {
  const num = Number(n);
  return `₹${(Number.isFinite(num) ? num : 0).toFixed(2)}`;
};

export const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null;

export const PHOTO_LABELS: Record<string, string> = {
  cover: "Cover",
  spine: "Spine",
  damage: "Damage",
  other: "Photo",
};

export const STATUS_TONE: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  received: "bg-bookvuk-lilac text-bookvuk-navy",
  paid: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-zinc-200 text-zinc-700",
  expired: "bg-zinc-200 text-zinc-700",
};

/** The grades that can be given to a copy in hand. */
export const GRADES: readonly BuybackCondition[] = ["like_new", "good", "fair"] as const;

/** What the shop would pay at this grade. Same arithmetic as `core/buyback.py`,
 *  shown so a re-grade's cost is visible before it is committed. */
export const quoteAt = (r: AdminBuyback, condition: BuybackCondition) =>
  Number(r.listed_price) * BUYBACK_RATES[condition] * Number(r.quantity || 1);
