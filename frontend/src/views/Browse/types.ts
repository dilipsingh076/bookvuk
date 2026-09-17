/** Types and option lists local to the catalogue page. */

import type { CatalogFacets, PaginatedBooks, Category, ServerSort } from "../../api/index";

/** A category id, or `"all"` for the unfiltered catalogue. */
export type BrowseCategoryKey = "all" | string;

/** One row of the category sidebar. */
export type CategoryRow = { key: BrowseCategoryKey; label: string };

export type BrowseProps = {
  /* Fetched by `app/browse/page.tsx` for the exact query in the URL, so the
   * catalogue is in the HTML rather than a grid of skeletons. This is the page a
   * search engine reaches first and the one every category link points at; served
   * empty it taught crawlers the shop had no books. */
  initialPage?: PaginatedBooks | null;
  initialCategories?: Category[] | null;
  initialFacets?: CatalogFacets | null;
};

/** Every order the catalogue can be shown in. One list, used by both controls.
 *
 * There were two sort controls with separate state, so the page could highlight
 * "Popular" while the dropdown read "Sort by relevance" at the same time.
 */
export const SORT_OPTIONS: Array<{ value: ServerSort; label: string }> = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest arrivals" },
  { value: "rating_desc", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "title_asc", label: "Title: A to Z" },
];

/** The four worth a one-tap shortcut. "Popular" is how many rated it, "Highest
 *  rated" is how highly — they used to both send `rating_desc`, so one did nothing. */
export const SORT_CHIPS = SORT_OPTIONS.filter((o) =>
  ["popular", "newest", "price_asc", "rating_desc"].includes(o.value),
);

/** The rating filters offered, coarsest first. */
export const RATING_FILTERS = [
  { label: "4.5 and above", v: 4.5 },
  { label: "4.0 and above", v: 4.0 },
  { label: "3.5 and above", v: 3.5 },
];

export const formatCount = (n: number) => n.toLocaleString("en-IN");
