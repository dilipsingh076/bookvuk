/** Types local to the profile page. */

/** Who you are, as shown on receipts and order updates. */
export type ProfileFields = { name: string; email: string };

/** The three password boxes. Grouped because they are only ever validated
 *  together: a new password with no current one, or one that does not match its
 *  confirmation, is not half a change — it is no change. */
export type PasswordFields = { current: string; next: string; confirm: string };

export const EMPTY_PASSWORDS: PasswordFields = { current: "", next: "", confirm: "" };

/** The minimum the server will accept, repeated here so the form can say so
 *  before making the request. */
export const MIN_PASSWORD_LENGTH = 8;

export const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-bookvuk-border bg-white px-4 py-3 text-sm text-bookvuk-navy shadow-sm outline-none transition placeholder:text-bookvuk-muted/70 focus:border-bookvuk-purple/40 focus:ring-2 focus:ring-bookvuk-purple/20";
