"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Book } from "../api/index";
import { useCart } from "./CartContext";
import { WishlistContext, type WishlistContextValue } from "./WishlistContext";
import { reportLoadError } from "@/lib/loadError";
import { getBaseUrl } from "../api/index";
import { useAuth } from "./AuthContext";

type WishlistProviderProps = {
  children: ReactNode;
};

const WishlistProvider = ({ children }: WishlistProviderProps) => {
  const { getToken, isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const cart = useCart();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishlistBooks, setWishlistBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizeId = (value: unknown) => String(value ?? "").trim().toLowerCase();

  const fetchWishlistApi = useCallback(async (
    signal?: AbortSignal,
  ): Promise<{ ids: string[]; books: Book[] }> => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/wishlist`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (res.status === 401) {
      logout();
      throw new Error("Session expired. Please sign in again.");
    }

    if (!res.ok) throw new Error("Failed to fetch wishlist");
    const data = await res.json();
    if (!Array.isArray(data.items)) return { ids: [], books: [] };
    const books = data.items
      .map((item: any) => item.book)
      .filter((book: unknown) => !!book) as Book[];

    // Backend response may not include top-level `book_id` on wishlist rows.
    // Derive ids from nested book payload first, then fallback to row fields.
    const ids = data.items
      .map((item: any) => item.book?.id ?? item.book?.bookId ?? item.book_id ?? item.id)
      .map((value: unknown) => String(value ?? "").trim())
      .filter((value: string) => value.length > 0);

    return {
      ids,
      books,
    };
    /* Memoised so the effect below can name it as a dependency instead of
       omitting it. Recreated only when the token getter or logout changes, which
       is what it actually reads. */
  }, [getToken, logout]);

  const toggleWishlistApi = async (bookId: string): Promise<boolean> => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/wishlist/wishlistToggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ book_id: bookId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to toggle wishlist");
    }

    const result = await res.json();
    return result.in_wishlist;
  };

  const removeFromWishlistApi = async (bookId: string) => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/wishlist/${bookId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to remove from wishlist");
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const isAdmin = user?.role === "admin";
    if (!isAuthenticated || isAdmin) {
      setWishlistIds([]);
      setWishlistBooks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const data = await fetchWishlistApi(controller.signal);
        if (!cancelled) {
          setWishlistIds(data.ids);
          setWishlistBooks(data.books);
        }
      } catch (e) {
        reportLoadError("Wishlist fetch error:", e, controller.signal);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authLoading, isAuthenticated, user?.role, fetchWishlistApi]);

  const toggleWishlist = async (book: Book) => {
    const id = String(book?.id ?? book?.bookId);
    if (!id) return;
    const normalizedId = normalizeId(id);

    const exists = wishlistIds.some((x) => normalizeId(x) === normalizedId);
    setWishlistIds((prev) =>
      exists ? prev.filter((x) => normalizeId(x) !== normalizedId) : [...prev, id]
    );
    setWishlistBooks((prev) =>
      exists
        ? prev.filter(
            (b) =>
              normalizeId(b.id) !== normalizedId &&
              normalizeId(b.bookId) !== normalizedId
          )
        : [...prev, book]
    );

    try {
      const inWishlist = await toggleWishlistApi(id);
      setWishlistIds((prev) =>
        inWishlist
          ? [...prev.filter((x) => normalizeId(x) !== normalizedId), id]
          : prev.filter((x) => normalizeId(x) !== normalizedId)
      );
      setWishlistBooks((prev) =>
        inWishlist
          ? [...prev.filter((b) => normalizeId(b.id) !== normalizedId), book]
          : prev.filter(
              (b) =>
                normalizeId(b.id) !== normalizedId &&
                normalizeId(b.bookId) !== normalizedId
            )
      );
    } catch (e) {
      reportLoadError("Wishlist toggle error:", e);
      setWishlistIds((prev) =>
        exists
          ? [...prev.filter((x) => normalizeId(x) !== normalizedId), id]
          : prev.filter((x) => normalizeId(x) !== normalizedId)
      );
      setWishlistBooks((prev) =>
        exists
          ? [...prev.filter((b) => normalizeId(b.id) !== normalizedId), book]
          : prev.filter(
              (b) =>
                normalizeId(b.id) !== normalizedId &&
                normalizeId(b.bookId) !== normalizedId
            )
      );
    }
  };

  const removeFromWishlist = async (bookId: string) => {
    const normalizedId = normalizeId(bookId);
    const prevIds = wishlistIds;
    const prevBooks = wishlistBooks;
    setWishlistIds((prev) => prev.filter((id) => normalizeId(id) !== normalizedId));
    setWishlistBooks((prev) =>
      prev.filter(
        (b) =>
          normalizeId(b.id) !== normalizedId &&
          normalizeId(b.bookId) !== normalizedId
      )
    );

    try {
      await removeFromWishlistApi(bookId);
    } catch (e) {
      reportLoadError("Remove wishlist error:", e);
      setWishlistIds(prevIds);
      setWishlistBooks(prevBooks);
    }
  };

  const addAllToCart = async () => {
    try {
      // The wishlist response already embeds each book, so there is nothing to
      // look up — this used to download the entire catalogue to find them.
      const toAdd = wishlistBooks;
      toAdd.forEach((book) => cart.addToCart(book));
      return toAdd;
    } catch (e) {
      reportLoadError("Add all to cart error:", e);
      return [];
    }
  };

  const value = useMemo<WishlistContextValue>(() => ({
    wishlistIds,
    wishlistBooks,
    wishlistCount: wishlistIds.length,
    toggleWishlist,
    removeFromWishlist,
    addAllToCart,
    loading,
  }),
    /* The handlers are deliberately absent: they are plain functions rebuilt on
       every render, so listing them would make this memo return a new object
       every render and re-render every consumer — the opposite of its purpose.
       Sound because their only meaningful dependency is already listed, so the
       memo recomputes and re-captures them whenever that state moves. Fixing it
       "properly" means useCallback on each handler with hand-written dependency
       lists, which is a real refactor rather than a lint cleanup. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [wishlistIds, wishlistBooks, cart, loading]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export { WishlistProvider };