/** Formatters and the blank form for the discount-code screen. */

import type { AdminCouponInput } from "../../../api/admin";

export const formatMoney = (n: unknown) => `₹${Number(n ?? 0).toFixed(2)}`;

/** A date, or null when there isn't one — the caller decides what "no date" reads as. */
export const formatDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : null;

/** 10% is a plausible default that still has to be looked at before it is live. */
export const BLANK: AdminCouponInput = {
  code: "",
  description: "",
  discount_type: "percent",
  value: 10,
};
