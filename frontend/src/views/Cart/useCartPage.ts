"use client";

/**
 * What the cart page keeps track of.
 *
 * Lifted out of `Cart.tsx`, which carried the coupon state, the server-priced
 * totals and the in-stock/waiting split above 400 lines of markup. Most of the
 * decisions here are about *whose* number to believe — the local snapshot or the
 * server's — and that argument is much easier to follow with the markup out of
 * the way.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "../../context/AuthModalContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import type { LineItem } from "./types";

export const useCartPage = () => {
  const {
    items, syncing, adjustQty, removeFromCart, clearCart, loading, isGuestCart,
    coupon, setCoupon, serverTotals,
  } = useCart();
  const { requireAuth } = useAuthModal();
  const { toggleWishlist, wishlistIds } = useWishlist();
  const router = useRouter();

  const [couponInput, setCouponInput] = useState(coupon ?? "");
  const [couponError, setCouponError] = useState<string | null>(null);

  // Each line already carries its book — embedded by the API when signed in, or
  // snapshotted locally for a guest. No catalogue download needed.
  const allLines = useMemo<LineItem[]>(
    () => items.filter((it): it is LineItem => Boolean(it.book)),
    [items],
  );

  // A cart can hold a book that is out of stock: "Notify me" puts it here so it is
  // already waiting when the restock lands. It is kept apart from the rest because
  // it is not part of this order — the checkout skips it and it stays in the cart.
  const lineItems = useMemo(
    () => allLines.filter((it) => Number(it.book.stock ?? 0) >= it.qty),
    [allLines],
  );
  const waitingLines = useMemo(
    () => allLines.filter((it) => Number(it.book.stock ?? 0) < it.qty),
    [allLines],
  );

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, it) => sum + it.book.price * it.qty, 0);
  }, [lineItems]);


  /* Priced by the server, and the price comes with the cart.
   *
   * The cart used to work its own total out with `shipping = 5` and `tax = 8%`
   * written into the component. They happen to match the backend today, which is
   * the dangerous kind of correct: change a rate in one place and the cart quietly
   * quotes a figure the checkout will not honour. A discount cannot be computed
   * here at all — only the server knows whether a code is valid, still in date,
   * and not already used by this customer.
   *
   * This page used to fetch that itself, on load and after every press. It no
   * longer fetches anything: the cart context carries the applied code on every
   * cart request, so the figures — discount included — arrive with the lines.
   *
   * A guest has no account to price against, so they keep the local estimate;
   * every label already says "estimated", and the checkout is where a real number
   * arrives.
   *
   * The one thing left to react to is a code that stopped working — it can
   * expire between being applied and the next request. The server reports that
   * rather than failing the cart over it, so the code is dropped here and the
   * reason shown; the code-free totals in the same response still stand. */
  const couponError_ = serverTotals?.coupon_error ?? null;
  useEffect(() => {
    if (!couponError_) return;
    setCoupon(null);
    setCouponError(couponError_);
  }, [couponError_, setCoupon]);

  const num = (v: unknown) => Number(v ?? 0);
  const priced = serverTotals !== null;
  /* Applying a code is a round trip, so the button says so until the answer is
     back. Derived rather than held: it is true exactly while the code the page
     has applied is not yet the code the server has priced, which ends either
     way — the good code arrives in `coupon_code`, and a bad one clears
     `coupon` through the effect above. A held flag had to be cleared by hand on
     both paths, and was left permanently false when the validating fetch it
     wrapped was removed. */
  const couponBusy = Boolean(coupon) && serverTotals?.coupon_code !== coupon;
  const shippingEstimate = priced ? num(serverTotals.shipping) : subtotal > 0 ? 5.0 : 0;
  const estimatedTax = priced ? num(serverTotals.tax) : subtotal > 0 ? subtotal * 0.08 : 0;
  const discount = priced ? num(serverTotals.discount) : 0;
  /* The server has not caught up yet: either a write is in flight, or one has
     landed and the figures it priced still describe a different subtotal. */
  const settling =
    syncing || (priced && Math.abs(num(serverTotals.subtotal) - subtotal) > 0.5);
  const behind = settling ? "opacity-50 transition-opacity" : "transition-opacity";

  const total = priced
    ? num(serverTotals.total)
    : subtotal + shippingEstimate + estimatedTax;

  /** Validate a code against the server before letting the cart claim it. */
  const applyCoupon = async () => {
    const code = couponInput.trim();
    setCouponError(null);
    if (!code) {
      setCoupon(null);
      return;
    }
    /* Codes are checked per account — some are one-per-customer — so there is
       nothing to validate against until the visitor is signed in. Asking here is
       better than accepting the code and losing it at the sign-in. */
    if (isGuestCart) {
      requireAuth(() => setCoupon(code));
      return;
    }
    /* Applying the code *is* the request: the cart is re-read with it, which
       prices it and validates it in the same breath. This used to ask
       `/cart/totals` first and then set the code — two requests to answer one
       question. A code the server will not take comes back as
       `totals.coupon_error`, which the effect above acts on. */
    setCoupon(code);
  };
  // Nothing at all — a cart holding only a waiting book is not empty, it just has
  // nothing to check out yet.
  const isEmpty = allLines.length === 0;
  const nothingToBuy = lineItems.length === 0;

  /** Take the code off this cart.
   *
   * An action rather than three setters in an `onClick`: removing a code means
   * the applied code, the typed text and any error all go, and that rule belongs
   * with the state it clears — not copied into the markup. */
  const clearCoupon = () => {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  /** Typing in the code box clears the last complaint about it. */
  const typeCoupon = (value: string) => {
    setCouponInput(value);
    setCouponError(null);
  };

  return {
    router,
    clearCoupon,
    typeCoupon,
    items,
    syncing,
    adjustQty,
    removeFromCart,
    clearCart,
    loading,
    isGuestCart,
    coupon,
    requireAuth,
    toggleWishlist,
    wishlistIds,
    couponInput,
    setCouponInput,
    couponBusy,
    couponError,
    applyCoupon,
    allLines,
    lineItems,
    waitingLines,
    subtotal,
    priced,
    shippingEstimate,
    estimatedTax,
    discount,
    total,
    settling,
    behind,
    isEmpty,
    nothingToBuy,
  };
};

export type UseCartPage = ReturnType<typeof useCartPage>;
