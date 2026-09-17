/** Types local to the shopfront. */

import type { ReactNode } from "react";
import type { CatalogFacets, Category, TrendingShelf } from "../../api/index";

export type Feature = {
  title: string;
  sub: string;
  icon: ReactNode;
};

/** One category worth linking to: it has stock. */
export type CategoryShelf = { id: string; name: string; count: number };

export type LandingProps = {
  /** Fetched by `app/page.tsx` so the shelf and the category row are in the HTML
   *  rather than eight skeletons. */
  initialShelf?: TrendingShelf | null;
  initialCategories?: Category[] | null;
  initialFacets?: CatalogFacets | null;
};

/* This is the only shelf a signed-out visitor ever sees: `/home` and its larger
 * spotlight are `authenticatedOnly`, so a guest is redirected here. It asked for
 * four books — one row — on a shop of 200 titles, directly under a badge
 * advertising all 200. Eight fills two whole rows at each of the grid's
 * breakpoints (1 / 2 / 4 columns), so nothing is left ragged. */
export const SHELF_SIZE = 8;
