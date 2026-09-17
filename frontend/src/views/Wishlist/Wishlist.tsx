"use client";

/** The books you hearted. */

import BookCard from "../../components/BookCard";
import BookCardSkeleton from "../../components/BookCardSkeleton";
import EmptyWishlist from "./EmptyWishlist";
import { useWishlistPage } from "./useWishlistPage";

const CartIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5 3H2"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
  </svg>
);

const Wishlist = () => {
  const w = useWishlistPage();

  if (w.loading) {
    /* Same card placeholders as the rest of the product grids. */
    return (
      <div className="relative pb-16 pt-6">
        <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-6" aria-busy="true">
          <BookCardSkeleton count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-16 pt-6">
      <div className="mx-auto">
        <main className="relative min-w-0">
          {w.isEmpty ? (
            <div
              className="pointer-events-none absolute inset-x-0 -top-4 h-56 bg-gradient-to-b from-rose-50/80 via-bookvuk-lilac/30 to-transparent"
              aria-hidden
            />
          ) : null}

          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="bg-gradient-to-r from-bookvuk-navy to-bookvuk-purple bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                  My Wishlist
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      w.isEmpty
                        ? "bg-bookvuk-border/60 text-bookvuk-muted"
                        : "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80"
                    }`}
                  >
                    {w.wishlistCount} saved
                  </span>
                  {w.cartQty ? (
                    <span className="text-sm text-bookvuk-muted">
                      Cart · {w.cartQty} item{w.cartQty === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="text-sm text-bookvuk-muted">
                      {w.isEmpty ? "Hearts from browse appear here" : "Tap a heart to remove"}
                    </span>
                  )}
                </div>
              </div>

              {w.isAuthenticated ? (
                <button
                  type="button"
                  onClick={w.addAllToCart}
                  disabled={w.isEmpty}
                  title={
                    w.isEmpty ? "Add books to your wishlist first" : "Add every book to your cart"
                  }
                  className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-bookvuk-purple/40 disabled:cursor-not-allowed ${
                    w.isEmpty
                      ? "border border-dashed border-bookvuk-border bg-white text-bookvuk-muted shadow-none"
                      : "bg-bookvuk-purple text-white shadow-md shadow-bookvuk-purple/20 hover:bg-bookvuk-purple-hover hover:shadow-lg active:scale-[0.99]"
                  }`}
                >
                  <CartIcon className="h-4 w-4" />
                  Add all to cart
                </button>
              ) : null}
            </div>

            {w.isEmpty ? (
              <EmptyWishlist />
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {w.wishedBooks.map((b) => (
                  <BookCard key={b.id} book={b} variant="wishlist" />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Wishlist;
