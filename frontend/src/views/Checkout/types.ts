/** Types local to checkout. */

import type { Book } from "../../api/index";
import type { AddressInput } from "../../api/commerce";
import type { CartItem } from "../../context/CartContext";

/** A cart line that has its book, so the summary can name and price it. */
export type CheckoutLine = CartItem & { book: Book };

/**
 * The order once it exists on the server.
 *
 * `paid` and `cod` are separate because "not paid" means two different things:
 * a cash order is *meant* to be unpaid, while an online order that ends up
 * unpaid needs the customer to try again. The confirmation screen says
 * something different for each.
 */
export type PlacedOrder = { id: string; paid: boolean; cod: boolean };

/** The empty delivery address. India is the only country served, so it is
 *  pre-filled rather than asked for. */
export const EMPTY_ADDRESS: AddressInput = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "IN",
};
