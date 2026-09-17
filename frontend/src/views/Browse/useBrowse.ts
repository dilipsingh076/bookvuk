"use client";

/**
 * The catalogue's state, which is really the URL's state.
 *
 * Every filter lives in the query string rather than in component state. It used
 * to be state only, which meant a filtered catalogue could not be shared or
 * bookmarked, the back button lost the filters, and there was no per-category URL
 * for a search engine to rank. The one exception is the search box, which is
 * local so typing is not throttled by the router; a debounced copy is what
 * reaches the URL and the API.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useFetch from "../../hooks/useFetch";
import {
  fetchBooksPaged,
  fetchCatalogFacets,
  fetchCategories,
  type Book,
  type CatalogFacets,
  type Category,
  type ServerSort,
} from "../../api/index";
import type { BrowseCategoryKey, BrowseProps, CategoryRow } from "./types";

/* 8 turned a 200-title catalogue into 25 pages, so clicking "Fiction (56)"
 * showed eight books and hid the rest behind six more clicks. 24 divides
 * evenly by the grid's 2 and 4 columns, so no row is left short, and brings
 * the same catalogue down to 9 pages. The endpoint caps page_size at 50. */
const PAGE_SIZE = 24;

export const useBrowse = ({
  initialPage = null,
  initialCategories = null,
  initialFacets = null,
}: BrowseProps) => {
  const router = useRouter();
  const pathname = usePathname();

  /* Next's `useSearchParams` is read-only — there is no setter to pair with it,
   * because the URL is owned by the router. Writing goes through `router.push`
   * / `router.replace` in `updateParams` below instead.
   *
   * The old code also accepted a search term handed over through
   * `location.state`, which React Router allowed and Next has no equivalent for.
   * Nothing needed it: every caller that navigates here already puts the term in
   * the query string (`/browse?q=…`), which is the shareable, crawlable form and
   * the reason the filters were moved into the URL in the first place. */
  const params = useSearchParams();

  const search0 = params.get("q") ?? "";
  const category: BrowseCategoryKey = params.get("category") || "all";
  const minRating = params.get("rating") ? Number(params.get("rating")) : null;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const sort = (params.get("sort") as ServerSort | null) ?? null;
  /* Second-hand copies are variants of a title, so the catalogue hides them by
     default and shows them on the parent's page. `condition=used` is the other
     view: a shelf of nothing but used stock, which is the entry point a
     price-led buyer actually arrives with — and which had no way in at all. */
  const condition: "used" | null = params.get("condition") === "used" ? "used" : null;

  const [search, setSearch] = useState(search0);
  const [debouncedSearch, setDebouncedSearch] = useState(search0);

  /** Write one or more params, dropping any that are back to their default.
   *
   * `replace` for the debounced search box so typing does not fill the history
   * with a stack of half-typed words the back button then has to walk through.
   */
  const updateParams = (
    changes: Record<string, string | number | null>,
    opts: { replace?: boolean; resetPage?: boolean } = {},
  ) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "" || value === "all") next.delete(key);
      else next.set(key, String(value));
    }
    // Any change to what is being filtered invalidates the page number: page 4 of
    // a different result set is not where the visitor was.
    if (opts.resetPage !== false && !("page" in changes)) next.delete("page");
    const query = next.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (opts.replace ?? false) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  const setCategory = (key: BrowseCategoryKey) => updateParams({ category: key });
  const setMinRating = (value: number | null) => updateParams({ rating: value });
  const setPage = (value: number) =>
    updateParams({ page: value <= 1 ? null : value }, { resetPage: false });
  const setSort = (value: ServerSort | null) => updateParams({ sort: value });
  const setCondition = (value: "used" | null) => updateParams({ condition: value });

  const { data: categoriesData } = useFetch<Category[]>(() => fetchCategories(), [], {
    cacheKey: "categories",
    ttlMs: 5 * 60_000,
    initialData: initialCategories,
  });
  /* Memoised so the fallback is one array, not a new one per render:
     `?? []` fed the memos below a fresh identity on every render while
     the data was still loading, so they recomputed each time for nothing. */
  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);

  // Counts for the sidebar come from a facets endpoint rather than from counting
  // a fully-downloaded catalogue.
  const { data: facets } = useFetch<CatalogFacets>(() => fetchCatalogFacets(), [], {
    cacheKey: "catalog-facets",
    ttlMs: 5 * 60_000,
    initialData: initialFacets,
  });

  // Searching, filtering, sorting and paging all happen on the server. Doing it
  // in the browser meant downloading every book on every visit — fine at 200
  // titles, unusable at a few thousand.
  //
  // One sort value, not two. The chips and the dropdown used to hold separate
  // state, so the page could show "Popular" highlighted while the dropdown read
  // "Sort by relevance" — two controls disagreeing about the same list.
  const searching = debouncedSearch.trim().length > 0;
  const serverSort = useMemo<ServerSort>(() => {
    // `relevance` is only meaningful with a query, and the API rejects it without
    // one, so it cannot be allowed to survive the search box being cleared.
    if (sort === "relevance") return searching ? "relevance" : "newest";
    if (sort) return sort;
    return searching ? "relevance" : "newest";
  }, [sort, searching]);

  const { data: pageData, loading } = useFetch(
    () =>
      fetchBooksPaged({
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch.trim() || undefined,
        category_id: category === "all" ? undefined : String(category),
        min_rating: minRating ?? undefined,
        sort: serverSort,
        condition: condition ?? undefined,
      }),
    [page, debouncedSearch, category, minRating, serverSort, condition],
    { initialData: initialPage },
  );

  const pagedRows = pageData?.items ?? [];
  const totalItems = pageData?.meta?.total ?? 0;
  const totalPages = Math.max(1, pageData?.meta?.pages ?? 1);
  const safePage = Math.min(Math.max(1, page), totalPages);

  /* How much second-hand stock exists, so the chip can carry a number and can be
     hidden entirely when there is none. */
  const usedCount = facets?.conditions?.used ?? 0;

  const categoryRows = useMemo<CategoryRow[]>(() => {
    const rows = categories
      .map((c) => ({ key: String(c.id), label: String(c.name) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ key: "all" as const, label: "All categories" }, ...rows];
  }, [categories]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch === (params.get("q") ?? "")) return;
    // `replace` so each keystroke does not become a history entry to back through.
    updateParams({ q: debouncedSearch || null }, { replace: true });
    /* `params` and `updateParams` are deliberately absent. This effect writes the
       search box into the URL; listing the URL it writes would make it re-run on
       its own output, and the pair of effects here would push each other back and
       forth. The guard on the first line is what makes that safe. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // A URL arrived at from elsewhere (a shared link, the back button) is the source
  // of truth for the box, not the other way round.
  //
  // Read out into a variable rather than called inside the dependency array: the
  // rule cannot check an expression it has to evaluate, so it could not tell
  // whether this effect watched the right thing.
  const searchFromUrl = params.get("q") ?? "";
  useEffect(() => {
    if (searchFromUrl !== debouncedSearch) {
      setSearch(searchFromUrl);
      setDebouncedSearch(searchFromUrl);
    }
    // `debouncedSearch` is deliberately absent: this effect exists to push the
    // URL *into* the box, and re-running it when the box changes would undo
    // whatever the visitor just typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFromUrl]);

  const openDetails = (book: Book) => {
    /* No background location to pass any more: the intercepting route at
     * `@modal/(.)books/[bookId]` decides whether this renders as a dialog over
     * the catalogue (client navigation) or as the full page (fresh load, shared
     * link, crawler). */
    router.push(`/books/${book.id}`);
  };

  /** Null until the counts are known, so nothing renders a confident "0".
   *
   * This used to return 0 while the facets request was in flight, which put a
   * column of zeros next to every category — reading as "empty shop" rather than
   * "not counted yet". A genuine zero still renders as 0. */
  const countFor = (key: BrowseCategoryKey): number | null => {
    if (!facets) return null;
    if (key === "all") return facets.total;
    return facets.categories[String(key)] ?? 0;
  };

  return {
    // Filters, as they stand in the URL
    category,
    setCategory,
    minRating,
    setMinRating,
    sort: serverSort,
    setSort,
    condition,
    setCondition,
    searching,
    // The search box
    search,
    setSearch,
    searchTrimmed: search.trim(),
    // Results
    pageSize: PAGE_SIZE,
    pagedRows,
    totalItems,
    totalPages,
    safePage,
    setPage,
    showPagination: totalPages > 1,
    loading,
    /** Nothing to show yet — placeholders. */
    isInitialLoad: loading && pageData == null,
    /** Loading a *replacement* set of results. Kept separate from the first load
     *  because the two need opposite treatments: nothing to show yet versus
     *  something to show that is about to be wrong. */
    isRefreshing: loading && pageData != null,
    noResults: !loading && pagedRows.length === 0,
    // Sidebar
    categoryRows,
    countFor,
    usedCount,
    openDetails,
  };
};

type UseBrowse = ReturnType<typeof useBrowse>;
