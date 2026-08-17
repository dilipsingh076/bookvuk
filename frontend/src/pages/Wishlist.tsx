import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import BookCard from "../components/BookCard";
import Loader from "../components/ui/Loader";

const CartIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5 3H2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
  </svg>
);

/** Empty wishlist hero art — heart + stacked books (rose / brand tones). */
const EmptyWishlistArt = () => (
  <svg
    viewBox="0 0 320 200"
    className="mx-auto h-40 w-full max-w-[300px] sm:h-48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <linearGradient id="wlHeart" x1="80" y1="40" x2="240" y2="180" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDA4AF" stopOpacity="0.35" />
        <stop offset="1" stopColor="#6C47FF" stopOpacity="0.12" />
      </linearGradient>
    </defs>
    <ellipse cx="160" cy="188" rx="100" ry="10" fill="#F5F3FF" opacity="0.9" />
    <path
      d="M160 36c-18-22-48-24-62-6-14 18-10 42 8 58l54 48 54-48c18-16 22-40 8-58-14-18-44-16-62 6z"
      stroke="url(#wlHeart)"
      strokeWidth="2.5"
      fill="#FFFBFC"
      strokeLinejoin="round"
    />
    <path
      d="M160 52c-12-14-32-15-42-4-10 11-7 28 6 38l36 32 36-32c13-10 16-27 6-38-10-11-30-10-42 4z"
      fill="#FDF2F4"
      opacity="0.85"
    />
    <g transform="translate(200 120)">
      <rect x="0" y="0" width="56" height="72" rx="4" fill="#F5F3FF" stroke="#C4B5FD" strokeWidth="1.2" />
      <path d="M8 12h40M8 24h28" stroke="#A78BFA" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </g>
    <g transform="translate(64 128)">
      <rect x="0" y="0" width="52" height="64" rx="4" fill="#FDF8F8" stroke="#6C47FF" strokeOpacity="0.25" strokeWidth="1.2" />
    </g>
  </svg>
);

const Wishlist = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { wishlistIds, wishlistBooks, wishlistCount, addAllToCart, loading } = useWishlist();
  const { totalQty } = useCart();
  const normalizeId = (value: unknown) => String(value ?? "").trim().toLowerCase();

  const wishedBooks = useMemo(() => {
    const idSet = new Set(wishlistIds.map(normalizeId));
    return wishlistBooks.filter(
      (b) => idSet.has(normalizeId(b.id)) || idSet.has(normalizeId(b.bookId))
    );
  }, [wishlistBooks, wishlistIds]);

  const handleAddAll = async () => {
    await addAllToCart();
    navigate("/cart");
  };

  const isEmpty = wishedBooks.length === 0;

  return (
    <div className="relative pb-16 pt-6">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : (
        <div className="mx-auto">
          <main className="relative min-w-0">
            {isEmpty ? (
              <div
                className="pointer-events-none absolute inset-x-0 -top-4 h-56 bg-gradient-to-b from-rose-50/80 via-booknest-lilac/30 to-transparent"
                aria-hidden
              />
            ) : null}

            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="bg-gradient-to-r from-booknest-navy to-booknest-purple bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                    My Wishlist
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        isEmpty
                          ? "bg-booknest-border/60 text-booknest-muted"
                          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80"
                      }`}
                    >
                      {wishlistCount} saved
                    </span>
                    {totalQty ? (
                      <span className="text-sm text-booknest-muted">
                        Cart · {totalQty} item{totalQty === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="text-sm text-booknest-muted">
                        {isEmpty ? "Hearts from browse appear here" : "Tap a heart to remove"}
                      </span>
                    )}
                  </div>
                </div>

                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={handleAddAll}
                    disabled={isEmpty}
                    title={isEmpty ? "Add books to your wishlist first" : "Add every book to your cart"}
                    className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-booknest-purple/40 disabled:cursor-not-allowed ${
                      isEmpty
                        ? "border border-dashed border-booknest-border bg-white text-booknest-muted shadow-none"
                        : "bg-booknest-purple text-white shadow-md shadow-booknest-purple/20 hover:bg-booknest-purple-hover hover:shadow-lg active:scale-[0.99]"
                    }`}
                  >
                    <CartIcon className="h-4 w-4" />
                    Add all to cart
                  </button>
                ) : null}
              </div>

              {isEmpty ? (
                <div className="relative mt-10">
                  <div
                    className="relative overflow-hidden rounded-3xl border border-booknest-border/80 bg-white/95 p-8 shadow-[0_20px_60px_-24px_rgba(26,29,46,0.15)] ring-1 ring-booknest-navy/[0.04] sm:p-12"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-100/50 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-booknest-lilac/80 blur-3xl" />

                    <div className="relative mx-auto max-w-lg text-center">
                      <EmptyWishlistArt />
                      <h2 className="mt-4 text-2xl font-bold tracking-tight text-booknest-navy sm:text-3xl">
                        No saved books yet
                      </h2>
                      <p className="mt-3 text-base leading-relaxed text-booknest-muted sm:text-[17px]">
                        Tap the heart on any book while you browse—we’ll keep your list here for when you are
                        ready to buy.
                      </p>
                      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                        <Link
                          to="/browse"
                          className="inline-flex items-center justify-center rounded-2xl bg-booknest-purple px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-booknest-purple/25 transition hover:bg-booknest-purple-hover hover:shadow-xl active:scale-[0.98]"
                        >
                          Browse the shop
                        </Link>
                        <Link
                          to="/"
                          className="inline-flex items-center justify-center rounded-2xl border border-booknest-border bg-white px-8 py-3.5 text-sm font-semibold text-booknest-navy transition hover:border-booknest-purple/30 hover:bg-booknest-lilac/50"
                        >
                          Back to home
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  {wishedBooks.map((b) => (
                    <BookCard key={b.id} book={b} variant="wishlist" />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default Wishlist;
