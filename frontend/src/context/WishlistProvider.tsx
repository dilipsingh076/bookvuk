import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Book } from "../api/index";
import { useCart } from "./CartContext";
import { WishlistContext, type WishlistContextValue } from "./WishlistContext";
import { fetchBooks, getBaseUrl } from "../api/index";
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

  const fetchWishlistApi = async (): Promise<{ ids: string[]; books: Book[] }> => {
    const token = getToken();
    if (!token) throw new Error("User not authenticated");

    const res = await fetch(`${getBaseUrl()}/api/customer/wishlist`, {
      headers: { Authorization: `Bearer ${token}` },
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
  };

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
    setLoading(true);

    (async () => {
      try {
        const data = await fetchWishlistApi();
        if (!cancelled) {
          setWishlistIds(data.ids);
          setWishlistBooks(data.books);
        }
      } catch (e) {
        console.error("Wishlist fetch error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user?.role]);

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
      console.error("Wishlist toggle error:", e);
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
      console.error("Remove wishlist error:", e);
      setWishlistIds(prevIds);
      setWishlistBooks(prevBooks);
    }
  };

  const addAllToCart = async () => {
    try {
      const books = await fetchBooks();
      const idSet = new Set(wishlistIds.map(normalizeId));
      const toAdd = books.filter(
        (b) => idSet.has(normalizeId(b.id)) || idSet.has(normalizeId(b.bookId))
      );
      toAdd.forEach((book) => cart.addToCart(book));
      return toAdd;
    } catch (e) {
      console.error("Add all to cart error:", e);
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
  }), [wishlistIds, wishlistBooks, cart, loading]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export { WishlistProvider };