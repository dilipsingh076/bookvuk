/** Formatters local to the buying list. */

export const formatMoney = (n: unknown) => {
  const v = Number(n);
  return `₹${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
};

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";
