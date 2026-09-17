"use client";

/**
 * What the shopfront shows a visitor who may not have an account.
 *
 * The catalogue is public, so browsing never needs one: sign-in is asked for at
 * the point it is actually required (cart, wishlist, checkout). Every figure on
 * the page comes from the facets endpoint rather than being written into the
 * markup — the hero used to read "10k+ Consumer" on a shop with a handful of
 * accounts.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useAuthModal } from "../../context/AuthModalContext";
import useFetch from "../../hooks/useFetch";
import {
  fetchCategories,
  fetchCatalogFacets,
  fetchTrending,
  type Book,
  type CatalogFacets,
  type Category,
} from "../../api/index";
import { SHELF_SIZE, type CategoryShelf, type LandingProps } from "./types";

export const useLanding = ({
  initialShelf = null,
  initialCategories = null,
  initialFacets = null,
}: LandingProps) => {
  const { isAuthenticated } = useAuth();
  const { openLoginModal, openRegisterModal } = useAuthModal();
  const router = useRouter();

  /* The hero's fallback, held as state: React owns the element's `src`, so the
     old trick of reassigning `img.src` in `onError` is undone on the next
     render. */
  const [heroFailed, setHeroFailed] = useState(false);

  // Cached, so coming back to the landing page does not pay for this again.
  const { data: shelf, loading } = useFetch(() => fetchTrending(SHELF_SIZE, 7), [], {
    cacheKey: `trending:${SHELF_SIZE}:7`,
    ttlMs: 5 * 60_000,
    initialData: initialShelf,
  });

  // Same cacheKey as Browse, so the two pages share one request for these.
  const { data: categoriesData } = useFetch<Category[]>(() => fetchCategories(), [], {
    cacheKey: "categories",
    ttlMs: 10 * 60_000,
    initialData: initialCategories,
  });
  const { data: facets } = useFetch<CatalogFacets>(() => fetchCatalogFacets(), [], {
    cacheKey: "catalog-facets",
    ttlMs: 5 * 60_000,
    initialData: initialFacets,
  });

  /* Names come from /categories, counts from /facets — one keyed by id, the
   * other a map of id -> count. Empty shelves are dropped rather than shown as
   * "0": a link that leads to nothing is worse than one fewer link. Largest
   * first, so the shelves worth opening are the ones read first. */
  const shelves = useMemo<CategoryShelf[]>(() => {
    if (!categoriesData || !facets) return [];
    return categoriesData
      .map((c) => ({ id: String(c.id), name: String(c.name), count: facets.categories[c.id] ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [categoriesData, facets]);

  return {
    loading,
    trending: shelf?.items ?? [],
    // Titled from what the data actually is. The heading claimed "Trending this
    // week" while the query was `sort=rating_desc` — the all-time highest rated
    // books, with no time window anywhere in it.
    trendingHeading: shelf?.basis === "sales" ? "Trending this week" : "Highly rated right now",
    shelves,
    facets,
    heroSrc: heroFailed ? "/assets/landingpage.jpg" : "/assets/Homepage.jpg",
    onHeroError: () => setHeroFailed(true),
    goBrowse: () => router.push("/browse"),
    /** The primary call to action: nothing to sign up for if they already have. */
    goBrowseOrRegister: () => {
      if (isAuthenticated) router.push("/browse");
      else openRegisterModal();
    },
    openRegisterModal,
    openLoginModal,
    openTrendingBook: (book: Book) => router.push(`/books/${book.id}`),
  };
};

type UseLanding = ReturnType<typeof useLanding>;
