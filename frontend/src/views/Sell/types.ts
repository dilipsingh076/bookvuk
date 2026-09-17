/** Types local to the sell flow. */

/** Which way the seller is naming the book.
 *
 * `search` looks it up in the catalogue, where the shop already knows the
 * printed price. `manual` is for a title the shop does not stock, where the
 * seller reads the MRP off the cover — the only price basis available, which is
 * why an admin re-checks it against the physical book before paying.
 */
export type Mode = "search" | "manual";

/** One request offered in this sitting. */
export type BasketEntry = {
  id: string;
  title: string;
  amount: number;
};

/** The request just submitted, for the confirmation screen. */
export type SubmittedRequest = BasketEntry;
