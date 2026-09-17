/** Types local to the author index. */

import type { CatalogAuthor } from "../../api/index";

export type AuthorsProps = {
  /** Fetched by `app/authors/page.tsx`. Without it this page serves nine
   *  skeletons to a crawler — and it exists precisely to be the one page that
   *  links to every author, so an unreadable version is worthless. */
  initialAuthors?: CatalogAuthor[] | null;
};
