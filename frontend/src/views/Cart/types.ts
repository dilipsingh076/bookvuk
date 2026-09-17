/** Types local to the cart. */

import type { Book } from "../../api/index";
import type { CartItem } from "../../context/CartContext";

/** A cart line that has its book.
 *
 * Every line *should* have one — embedded by the API when signed in, snapshotted
 * locally for a guest — but a line added by id alone has none until the next
 * read, so the page narrows to the ones it can actually render.
 */
export type LineItem = CartItem & { book: Book };
