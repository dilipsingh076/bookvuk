/** Formatters and tuning local to the customer screen. */

export const PAGE_SIZE = 25;

export const formatMoney = (n: unknown) => {
  const num = Number(n);
  return `₹${(Number.isFinite(num) ? num : 0).toFixed(2)}`;
};

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";

/** Order-status colours. Shipped and packed share one because from a support
 *  call's point of view they are the same answer: it has left. */
export const STATUS_TONE: Record<string, string> = {
  processing: "bg-bookvuk-lilac text-bookvuk-navy",
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-700",
  packed: "bg-sky-100 text-sky-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-bookvuk-lilac text-bookvuk-navy",
  cancelled: "bg-rose-100 text-rose-700",
};
