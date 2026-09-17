/** Types and tuning for the book admin. */

export type BookForm = {
  title: string;
  authorName: string;
  categoryId: string;
  format: string;
  description: string;
  /** Kept as strings: these are text boxes, and a half-typed "12." must survive
   *  being retyped. They are coerced once, on save. */
  price: string;
  stock: string;
};

export const PAGE_SIZE = 30;

/** At or below this many copies a title counts as running out. Matches the
 *  inventory screen's threshold — two different answers to "is this low" would
 *  be worse than either. */
export const LOW_STOCK = 10;

export const DEFAULT_FORMAT = "Paperback";

/** The fallback when a title is left blank: the row still has to be findable. */
export const UNTITLED = "Untitled book";

export const toNumber = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
