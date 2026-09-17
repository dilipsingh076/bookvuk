/** Types local to the book page. */

import type { Book } from "../../api/index";

export type BookDetailsProps = {
  /** Rendered as a quick-look dialog over the catalogue rather than as its own page. */
  isModal?: boolean;
  /**
   * The book, already fetched on the server.
   *
   * Passed by `app/books/[bookId]/page.tsx`, which needs it anyway to build the
   * page's title, preview image and schema.org graph. Handing it down means the
   * HTML contains the book rather than a skeleton — which is the difference
   * between a product page a crawler can read and one it cannot.
   */
  initialBook?: Book | null;
};
