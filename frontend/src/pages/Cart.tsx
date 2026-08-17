import { useMemo } from "react";
import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { bookCoverSrc, fetchBooks, type Book } from "../api/index";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../utils/formatPrice";
import Loader from "../components/ui/Loader";
import type { CartItem } from "../context/CartContext";

type LineItem = CartItem & { book: Book };

const TrashIcon = () => {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
    </svg>
  );
};

const HeartIcon = () => {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.4-9.5-9A5.7 5.7 0 0 1 12 6a5.7 5.7 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z" />
    </svg>
  );
};

/** Decorative empty-cart art: open book + cart outline (brand lilac / purple). */
const EmptyCartArt = () => (
  <svg
    viewBox="0 0 320 220"
    className="mx-auto h-44 w-full max-w-[320px] sm:h-52"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <defs>
      <linearGradient id="cartGrad" x1="40" y1="20" x2="280" y2="200" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F5F3FF" />
        <stop offset="1" stopColor="#EDE9FE" />
      </linearGradient>
      <linearGradient id="cartStroke" x1="0" y1="0" x2="320" y2="220" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6C47FF" stopOpacity="0.35" />
        <stop offset="1" stopColor="#6C47FF" stopOpacity="0.08" />
      </linearGradient>
    </defs>
    <ellipse cx="160" cy="200" rx="120" ry="12" fill="url(#cartGrad)" opacity="0.9" />
    <path
      d="M88 148h144v36a8 8 0 01-8 8H96a8 8 0 01-8-8v-36z"
      stroke="url(#cartStroke)"
      strokeWidth="2"
      fill="#FFFBFE"
    />
    <path
      d="M96 148V112a8 8 0 018-8h92a8 8 0 018 8v36"
      stroke="url(#cartStroke)"
      strokeWidth="2"
      fill="none"
    />
    <path d="M112 120h96M112 132h72" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <g transform="translate(118 52)">
      <path
        d="M42 8L84 28v56L42 104 0 84V28L42 8z"
        fill="#FDF8F8"
        stroke="#6C47FF"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path d="M42 8v96M0 28l42 20M84 28L42 48" stroke="#6C47FF" strokeWidth="1.2" strokeOpacity="0.35" />
    </g>
    <circle cx="248" cy="64" r="6" fill="#6C47FF" opacity="0.2" />
    <circle cx="72" cy="88" r="4" fill="#6C47FF" opacity="0.15" />
  </svg>
);

const Cart = () => {
  const { items, setQty, removeFromCart, clearCart } = useCart();
  const { data: books, loading } = useFetch<Book[]>(() => fetchBooks(), []);

  const lineItems = useMemo<LineItem[]>(() => {
    return items
      .map((it) => {
        const book = (books || []).find((b) => b.id === it.bookId);
        return book ? ({ ...it, book } as LineItem) : null;
      })
      .filter((x): x is LineItem => x !== null);
  }, [items, books]);

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, it) => sum + it.book.price * it.qty, 0);
  }, [lineItems]);

  const shippingEstimate = subtotal > 0 ? 5.0 : 0;
  const estimatedTax = subtotal > 0 ? subtotal * 0.08 : 0;
  const total = subtotal + shippingEstimate + estimatedTax;

  if (loading) {
    return (
      <div className="py-10">
        <Loader />
      </div>
    );
  }

  const isEmpty = lineItems.length === 0;

  return (
    <div className="relative pb-16 pt-6">
      <div className="mx-auto">
        <main className="relative min-w-0">
          {isEmpty ? (
            <div
              className="pointer-events-none absolute inset-x-0 -top-4 h-56 bg-gradient-to-b from-rose-50/80 via-booknest-lilac/30 to-transparent"
              aria-hidden
            />
          ) : null}

          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="bg-gradient-to-r from-booknest-navy to-booknest-purple bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                  Shopping Cart
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      isEmpty
                        ? "bg-booknest-border/60 text-booknest-muted"
                        : "bg-booknest-lilac text-booknest-purple ring-1 ring-booknest-purple/15"
                    }`}
                  >
                    {lineItems.length} item{lineItems.length === 1 ? "" : "s"}
                  </span>
                  {!isEmpty ? (
                    <span className="text-sm text-booknest-muted">Review before checkout</span>
                  ) : (
                    <span className="text-sm text-booknest-muted">Add books from the shop to checkout</span>
                  )}
                </div>
              </div>
              {!isEmpty ? (
                <button
                  type="button"
                  onClick={() => clearCart()}
                  className="self-start rounded-xl border border-booknest-border bg-white px-4 py-2.5 text-sm font-semibold text-booknest-purple shadow-sm transition hover:border-rose-200  hover:bg-rose-50/80 hover:text-rose-700"
                >
                  Clear cart
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
                    <EmptyCartArt />
                    <h2 className="mt-4 text-2xl font-bold tracking-tight text-booknest-navy sm:text-3xl">
                      Nothing in your cart yet
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-booknest-muted sm:text-[17px]">
                      Browse the shop and add titles—your bag stays here until you are ready to pay.
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
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-start">
            <div className="rounded-3xl bg-white p-5 shadow-booknest-card ring-1 ring-booknest-navy/[0.06] sm:p-7">
              <div className="divide-y divide-booknest-border">
                {lineItems.map((it) => (
                  <div key={it.bookId} className="py-6 first:pt-0 last:pb-0">
                    <div className="grid grid-cols-[100px_1fr_auto] items-start gap-4 sm:grid-cols-[120px_1fr_auto] sm:gap-5">
                      <div className="h-28 w-24 overflow-hidden rounded-xl bg-booknest-lilac shadow-inner ring-1 ring-booknest-border/60">
                        <img
                          src={bookCoverSrc(it.book)}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget;
                            console.warn("Cart cover failed to load", {
                              bookId: it.book.bookId ?? it.book.id,
                              src: img.currentSrc || img.src,
                              coverImage: (it.book as any).coverImage,
                            });
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-snug text-booknest-navy">
                          {it.book.title}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-booknest-muted">{it.book.author}</div>
                        <div className="mt-2 text-xs text-booknest-muted">
                          {it.book.format} • {it.book.stockStatus}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center overflow-hidden rounded-xl border border-booknest-border bg-booknest-cream/50">
                            <button
                              type="button"
                              onClick={() => setQty(it.bookId, it.qty - 1)}
                              className="px-3.5 py-2 text-sm font-semibold text-booknest-navy transition hover:bg-booknest-lilac"
                            >
                              −
                            </button>
                            <div className="min-w-[2.25rem] px-2 py-2 text-center text-sm font-semibold tabular-nums text-booknest-navy">
                              {it.qty}
                            </div>
                            <button
                              type="button"
                              onClick={() => setQty(it.bookId, it.qty + 1)}
                              className="px-3.5 py-2 text-sm font-semibold text-booknest-navy transition hover:bg-booknest-lilac"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(it.bookId)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-booknest-muted transition hover:text-rose-600"
                          >
                            <TrashIcon /> Remove
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-booknest-muted transition hover:text-booknest-navy"
                          >
                            <HeartIcon /> Save for later
                          </button>
                        </div>
                      </div>

                      <div className="text-right text-sm font-bold tabular-nums text-booknest-navy">
                        {formatPrice(it.book.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="lg:sticky lg:top-24">
              <div className="rounded-3xl bg-white p-6 shadow-[0_12px_40px_-18px_rgba(26,29,46,0.12)] ring-1 ring-booknest-navy/[0.06]">
                <div className="text-lg font-extrabold text-booknest-navy">Order summary</div>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-booknest-muted">Subtotal</span>
                    <span className="font-semibold tabular-nums text-booknest-navy">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-booknest-muted">Shipping estimate</span>
                    <span className="font-semibold tabular-nums text-booknest-navy">
                      {formatPrice(shippingEstimate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-booknest-muted">Estimated tax</span>
                    <span className="font-semibold tabular-nums text-booknest-navy">
                      {formatPrice(estimatedTax)}
                    </span>
                  </div>
                  <div className="border-t border-booknest-border/80 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-booknest-navy">Total</span>
                      <span className="text-xl font-extrabold tabular-nums text-booknest-navy">
                        {formatPrice(total)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-gradient-to-br from-booknest-lilac to-booknest-lilac/70 p-4 text-sm ring-1 ring-booknest-purple/10">
                  <div className="font-semibold text-booknest-navy">Gift card or discount code</div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                    <input
                      placeholder="Enter code"
                      className="w-full rounded-xl border border-booknest-border bg-white px-3 py-2.5 text-sm outline-none ring-booknest-purple/0 transition focus:border-booknest-purple/40 focus:ring-2 focus:ring-booknest-purple/20"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-xl bg-booknest-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-booknest-purple-hover active:scale-[0.98]"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                <Link
                  to="/checkout"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-booknest-purple py-3.5 text-sm font-semibold text-white shadow-md shadow-booknest-purple/20 transition hover:bg-booknest-purple-hover hover:shadow-lg hover:shadow-booknest-purple/25 active:scale-[0.99]"
                >
                  Proceed to checkout
                  <span aria-hidden>→</span>
                </Link>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-booknest-muted">
                  <span
                    className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]"
                    aria-hidden
                  />
                  Secure checkout guarantee
                </div>

                <div className="mt-6 border-t border-booknest-border/80 pt-5 text-center">
                  <Link
                    to="/browse"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-booknest-purple transition hover:underline"
                  >
                    ← Continue shopping
                  </Link>
                </div>
              </div>
            </aside>
          </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Cart;
