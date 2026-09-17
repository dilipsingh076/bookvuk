/**
 * The settings this screen may change, and how each one is entered.
 *
 * Only six things live here, and the boundary is deliberate: what the shop
 * *charges* is a shopkeeper's decision that changes on its own clock, while keys,
 * database URLs and gateway credentials stay in the environment. An admin screen
 * that can rewrite those is an admin account that can redirect the shop's money.
 */

import type { StoreSettingsFields } from "../../../api/admin";

export type FieldKey = keyof StoreSettingsFields;

export type SettingField = {
  key: FieldKey;
  label: string;
  help: string;
  unit?: "₹" | "%";
  kind: "money" | "percent" | "toggle";
};

export const FIELDS: SettingField[] = [
  {
    key: "shipping_flat_rate",
    label: "Shipping",
    help:
      "Charged on every order unless the free-shipping threshold is met. A single " +
      "book by courier costs roughly ₹40-80, so anything below that is subsidised.",
    unit: "₹",
    kind: "money",
  },
  {
    key: "free_shipping_threshold",
    label: "Free shipping over",
    help: "0 disables it, and every order pays shipping.",
    unit: "₹",
    kind: "money",
  },
  {
    key: "tax_rate",
    label: "Tax",
    help:
      "Leave at 0 while you sell printed books: the price on a book is its MRP, " +
      "which is inclusive of all taxes, and printed books are GST-exempt anyway. " +
      "Setting this charges above MRP. It applies to the whole basket, so it is " +
      "only right once everything you sell is taxable.",
    unit: "%",
    kind: "percent",
  },
  {
    key: "cod_enabled",
    label: "Cash on delivery",
    help: "Turning it off leaves online payment as the only way to check out.",
    kind: "toggle",
  },
  {
    key: "cod_max_order_total",
    label: "Cash on delivery up to",
    help: "Above this, online payment only. An order refused at the door costs the courier fee both ways.",
    unit: "₹",
    kind: "money",
  },
  {
    key: "wallet_max_redemption_percent",
    label: "Store credit may cover",
    help: "Of one order. Without a cap, a large balance checks out for nothing and stock ships with no money arriving.",
    unit: "%",
    kind: "percent",
  },
];

/** The order the sample basket is priced against. */
export const SAMPLE_ORDER = 500;

/** The wire value as something to type into a box. Tax is stored as a fraction
 *  and shown as a percentage, because nobody thinks in 0.08. */
export const toInput = (key: FieldKey, value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (key === "tax_rate") return String(Number(value) * 100);
  return String(value);
};

export const fromInput = (key: FieldKey, raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return key === "tax_rate" ? n / 100 : n;
};
