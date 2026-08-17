import { createContext, useContext } from "react";
import type { Book } from "../api/index";

type WishlistContextValue = {
  wishlistIds: string[];
  wishlistBooks: Book[];
  wishlistCount: number;
  toggleWishlist: (book: Book) => void;
  removeFromWishlist: (bookId: string) => void;
  addAllToCart: () => Promise<Book[]>;
  loading: boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
};

export type { WishlistContextValue };
export { WishlistContext, useWishlist };

