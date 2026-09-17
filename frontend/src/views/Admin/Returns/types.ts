/** Labels, tones and formatters for the returns queue. */

export type ReturnLens = "todo" | "topay" | "all";

export type Resolution = "wallet" | "source" | "replacement" | "none";

export const formatMoney = (n: unknown) => {
  const num = Number(n);
  return `₹${(Number.isFinite(num) ? num : 0).toFixed(2)}`;
};

export const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null;

export const STATUS_TONE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  rejected: "bg-rose-100 text-rose-700",
  refunded: "bg-emerald-100 text-emerald-700",
};

/** What each resolution actually does, said plainly at the point of choosing. */
export const RESOLUTION_HELP: Record<Resolution, string> = {
  wallet: "Credits their account now. Instant, and the money stays in the shop.",
  source: "Records that you sent it back the way they paid. Do the transfer in Razorpay.",
  replacement: "Records that another copy is going out. No money moves.",
  none: "Accepted, nothing owed — a goodwill close.",
};

/** What an empty lens means, which differs by lens. */
export const EMPTY_TEXT: Record<ReturnLens, string> = {
  todo: "Nothing waiting on a decision.",
  topay: "Nothing accepted and waiting to be refunded.",
  all: "No returns yet.",
};
