"use client";

/**
 * What the book page knows.
 *
 * Most of it is about the *shopper's* relationship to this book rather than the
 * book itself: how many are already in their cart, whether it is saved, and
 * whether it can be bought at all. The page only ever imported `addToCart`, so
 * it had no idea about the first of those: the button read "Add to Cart" whether
 * the cart held none or five.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useFetch from "../../hooks/useFetch";
import { BOOK_COVER_PLACEHOLDER, bookCoverSrc, fetchBookById, type Book } from "../../api/index";
import { rememberBook } from "../../components/RecentlyViewed";
import { useAuthModal } from "../../context/AuthModalContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import type { BookDetailsProps } from "./types";

export const useBookDetails = ({ initialBook = null }: Pick<BookDetailsProps, "initialBook">) => {
  const router = useRouter();
  const { bookId = "" } = useParams<{ bookId: string }>();
  const { requireAuth } = useAuthModal();
  const { items, addToCart, adjustQty } = useCart();
  const { toggleWishlist, wishlistIds } = useWishlist();

  const {
    data: book,
    loading,
    error,
  } = useFetch<Book>(() => fetchBookById(bookId), [bookId], { initialData: initialBook });

  /* Remember the visit, for the strip at the bottom of the next book they open.
     In an effect rather than during render: it writes to `localStorage`, which
     does not exist on the server and must not run twice under strict mode's
     double render. */
  useEffect(() => {
    if (book) rememberBook(book);
  }, [book]);

  /* Held as state rather than by rewriting `img.src`: React owns the element's
     src, so a manual assignment is undone on the next render. */
  const [coverFailed, setCoverFailed] = useState(false);
  const coverSrc = book && !coverFailed ? bookCoverSrc(book) : BOOK_COVER_PLACEHOLDER;

  const cartQty = useMemo(
    () => items.find((it) => String(it.bookId) === String(book?.id))?.qty || 0,
    [items, book?.id],
  );

  const wished = useMemo(
    () => (book ? wishlistIds.includes(String(book.id)) : false),
    [book, wishlistIds],
  );

  // One place decides whether this book can be bought.
  const soldOut = Number(book?.stock ?? 0) <= 0;

  /** Ask to be told, and hold it in the cart meanwhile. See BookCard for why both. */
  const notifyMe = () =>
    requireAuth(() => {
      if (!book) return;
      if (!wished) toggleWishlist(book);
      void addToCart(book);
    });

  return {
    book,
    loading,
    error,
    coverSrc,
    onCoverError: () => setCoverFailed(true),
    cartQty,
    wished,
    soldOut,
    notifyMe,
    /** One control for everyone: guests get the sign-in prompt, and the save is
     *  applied once they are in. */
    toggleSaved: () => book && requireAuth(() => toggleWishlist(book)),
    addToCart: () => book && void addToCart(book),
    adjust: (delta: number) => book && void adjustQty(String(book.id), delta),
    goToCart: () => router.push("/cart"),
    close: () => router.back(),
  };
};

export type UseBookDetails = ReturnType<typeof useBookDetails>;
