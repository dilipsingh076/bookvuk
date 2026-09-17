/**
 * Labels and small helpers for the seller's request list.
 *
 * The status wording is deliberately about what happens next rather than the
 * internal state name: somebody who posted a book wants to know whether to wait
 * for us or for the post, and "received" on its own does not answer that.
 */

type StatusLabel = {
  text: string;
  className: string;
  /** What the seller should do, or expect, now. Empty when there is nothing. */
  next: string;
};

export const STATUS_LABELS: Record<string, StatusLabel> = {
  submitted: {
    text: "Waiting for us",
    className: "bg-amber-50 text-amber-900 ring-amber-200/80",
    next: "We are looking at it. You do not need to do anything yet.",
  },
  approved: {
    text: "Send it in",
    className: "bg-sky-50 text-sky-800 ring-sky-200/80",
    next: "We want it. Post it to us and we will confirm the condition on arrival.",
  },
  received: {
    text: "With us",
    className: "bg-bookvuk-lilac text-bookvuk-purple ring-bookvuk-purple/20",
    next: "It has arrived and been graded. Payment is next.",
  },
  paid: {
    text: "Paid",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
    next: "Done — thank you.",
  },
  rejected: {
    text: "Declined",
    className: "bg-rose-50 text-rose-700 ring-rose-200/80",
    next: "",
  },
  cancelled: {
    text: "Withdrawn",
    className: "bg-slate-100 text-slate-700 ring-slate-200/80",
    next: "",
  },
  expired: {
    text: "Offer expired",
    className: "bg-slate-100 text-slate-700 ring-slate-200/80",
    next: "Ask for a fresh quote whenever you are ready — prices may have changed.",
  },
};

/** The fallback for a status the frontend has not been taught about. */
export const UNKNOWN_STATUS = (status: string): StatusLabel => ({
  text: status,
  className: "bg-slate-100 text-slate-700 ring-slate-200/80",
  next: "",
});

export const PHOTO_LABELS: Record<string, string> = {
  cover: "Cover",
  spine: "Spine",
  damage: "Damage",
  other: "Photo",
};

export const CONDITION_LABELS: Record<string, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

/** One request's half-filled dispatch form. */
export type DispatchDraft = { carrier: string; number: string };

/** How many days are left on an offer, or null when it does not expire.
 *
 *  Rounded up, because "1 day left" on something with eleven hours to run is the
 *  honest reading — telling somebody they have 0 days left while the offer still
 *  stands reads as a bug. */
export const daysLeft = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
};

export const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
