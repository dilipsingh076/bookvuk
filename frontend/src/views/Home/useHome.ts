"use client";

/**
 * The home page's data: a small highly-rated shelf, the catalogue's real size,
 * and the visitor's own two counts.
 *
 * Everything here is cached, so returning to the home page does not refetch —
 * and the facets request shares Browse's and Landing's key, making it one
 * request across the three pages rather than three.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useFetch from "../../hooks/useFetch";
import { fetchBooksPaged, fetchCatalogFacets, type Book, type CatalogFacets } from "../../api/index";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { MAX_SPOTLIGHT_SLIDES, SPOTLIGHT_PER_SLIDE } from "./types";

export const useHome = () => {
  const router = useRouter();

  const { data: page, loading } = useFetch(
    () => fetchBooksPaged({ page: 1, page_size: 8, sort: "rating_desc" }),
    [],
    { cacheKey: "home-spotlight", ttlMs: 5 * 60_000 },
  );
  const { data: facets } = useFetch<CatalogFacets>(() => fetchCatalogFacets(), [], {
    cacheKey: "catalog-facets",
    ttlMs: 5 * 60_000,
  });

  const { totalQty } = useCart();
  const { wishlistCount } = useWishlist();

  /* Memoised so the fallback is one array, not a new one per render: `?? []`
     fed the spotlight memo below a fresh identity on every render while the
     catalogue was still loading. */
  const books = useMemo(() => page?.items ?? [], [page]);

  /** Spotlight carousel: chunks of highly rated books (Browse has the full grid). */
  const spotlightSlides = useMemo(() => {
    const sorted = [...books].sort((a, b) => b.rating - a.rating);
    const slides: Book[][] = [];
    for (
      let i = 0;
      i < sorted.length && slides.length < MAX_SPOTLIGHT_SLIDES;
      i += SPOTLIGHT_PER_SLIDE
    ) {
      const chunk = sorted.slice(i, i + SPOTLIGHT_PER_SLIDE);
      if (chunk.length > 0) slides.push(chunk);
    }
    return slides;
  }, [books]);

  return {
    loading,
    spotlightSlides,
    /** The real catalogue total, or null while it is unknown — "0" would be a claim. */
    titlesInStore: facets ? facets.total : null,
    totalQty,
    wishlistCount,
    openBook: (book: Book) => router.push(`/books/${book.id}`),
    go: (path: string) => router.push(path),
  };
};

type UseHome = ReturnType<typeof useHome>;
