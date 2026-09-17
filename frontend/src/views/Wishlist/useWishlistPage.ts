"use client";

/**
 * The saved-books page.
 *
 * Named `useWishlistPage` rather than `useWishlist` because the context hook
 * already owns that name — this is the page's view of it: the books whose ids
 * are still on the list, and the one bulk action the page offers.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";

const normalizeId = (value: unknown) => String(value ?? "").trim().toLowerCase();

export const useWishlistPage = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { wishlistIds, wishlistBooks, wishlistCount, addAllToCart, loading } = useWishlist();
  const { totalQty } = useCart();

  /* Intersected rather than trusted: the ids are the list, and the books are a
     cache of what those ids resolved to. Removing one updates the ids first, so
     rendering `wishlistBooks` alone would leave the removed book on screen. */
  const wishedBooks = useMemo(() => {
    const idSet = new Set(wishlistIds.map(normalizeId));
    return wishlistBooks.filter(
      (b) => idSet.has(normalizeId(b.id)) || idSet.has(normalizeId(b.bookId)),
    );
  }, [wishlistBooks, wishlistIds]);

  return {
    loading,
    isAuthenticated,
    wishedBooks,
    wishlistCount,
    cartQty: totalQty,
    isEmpty: wishedBooks.length === 0,
    /** Everything into the cart, then straight to it — the point of the button is
     *  to stop deciding and start buying. */
    addAllToCart: async () => {
      await addAllToCart();
      router.push("/cart");
    },
  };
};

type UseWishlistPage = ReturnType<typeof useWishlistPage>;
