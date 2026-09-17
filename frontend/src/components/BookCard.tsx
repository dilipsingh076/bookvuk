"use client";

import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { BOOK_COVER_PLACEHOLDER, bookCoverSrc, type Book } from "../api/index";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { formatPrice } from "../utils/formatPrice";
import { Button, QuantityStepper } from "../components/ui";
import Link from "next/link";
import Img from "./ui/Img";

type BookCardVariant = "catalog" | "trending" | "wishlist" | "dashboard";

type BookCardProps = {
  book: Book;
  variant?: BookCardVariant;
  onOpen?: (book: Book) => void;
  /** In the first screenful. Loads eagerly instead of waiting for layout. */
  priority?: boolean;
};

const paletteForId = (id: string) => {
  const seed = id
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const palettes = [
    { bg: "from-indigo-100 via-bookvuk-cream to-cyan-100", fg: "text-bookvuk-navy" },
    { bg: "from-rose-100 via-bookvuk-cream to-orange-100", fg: "text-bookvuk-navy" },
    { bg: "from-emerald-100 via-bookvuk-cream to-lime-100", fg: "text-bookvuk-navy" },
    { bg: "from-sky-100 via-bookvuk-cream to-blue-100", fg: "text-bookvuk-navy" },
    { bg: "from-violet-100 via-bookvuk-cream to-fuchsia-100", fg: "text-bookvuk-navy" }
  ];
  return palettes[seed % palettes.length];
};

/** True only when the visitor used a modifier or a non-primary button.
 *
 * The card is a real link now, so these gestures must keep working: on a shop,
 * people open several books in background tabs to compare them. Calling
 * preventDefault unconditionally would silently break all of it.
 */
const isModifiedClick = (e: MouseEvent<HTMLElement>) =>
  e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

const StarIcon = () => {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M12 17.3 5.82 21l1.58-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.4 4.73L18.18 21 12 17.3Z"
        fill="currentColor"
      />
    </svg>
  );
};

const BookCard = ({ book, variant = "catalog", onOpen, priority = false }: BookCardProps) => {
  /* The cover falls back to a placeholder when it 404s. Held as state rather
     than mutating `img.src`: React owns the element's src, so a manual
     assignment is undone on the next render. */
  const [coverFailed, setCoverFailed] = useState(false);
  const coverSrc = coverFailed ? BOOK_COVER_PLACEHOLDER : bookCoverSrc(book);
  /* Driven by the count, not the score: a genuine 0.0 average is impossible
     (ratings are 1-5), so a zero score only ever means "no reviews". */
  const rated = (book.ratingCount ?? 0) > 0;
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useAuthModal();
  const { items, addToCart, adjustQty } = useCart();
  const { toggleWishlist, wishlistIds } = useWishlist();
  const normalizeId = (value: unknown) => String(value ?? "").trim().toLowerCase();

  const cartQty = useMemo(() => {
    return items.find((it) => String(it.bookId) === String(book.id))?.qty || 0;
  }, [items, book.id]);

  const wished = wishlistIds.some(
    (id) => normalizeId(id) === normalizeId(book.id) || normalizeId(id) === normalizeId(book.bookId)
  );

  const href = `/books/${book.id}`;

  /** Let the browser handle cmd/middle-click; intercept only a plain click. */
  const handleOpen = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isModifiedClick(e)) return;
    if (!onOpen) return; // plain navigation is what the link already does
    e.preventDefault();
    onOpen(book);
  };

  // Out of stock is a different offer, not a disabled version of the same one:
  // wishlisting it subscribes the visitor to the back-in-stock notice and tells the
  // shop somebody is waiting. An "Add to cart" that the checkout then refuses is
  // worse than no button.
  const soldOut = Number(book.stock ?? 0) <= 0;

  /** Ask to be told, and hold the book while waiting.
   *
   * Both, because they do different jobs: the wishlist entry is what triggers the
   * back-in-stock notice and what tells the shop somebody is waiting, and the cart
   * line means the book is already there to buy when the notice arrives. The cart
   * keeps it out of the total and the checkout skips it until it is in stock.
   */
  const notifyMe = () =>
    requireAuth(() => {
      if (!wished) toggleWishlist(book);
      if (!cartQty) void addToCart(book);
    });

  const palette = paletteForId(book.id);
  // Sent by the server and earned from real sales; see core/merchandising.py.
  const badge = book.badge ?? null;

  const showAddText = variant !== "wishlist";
  const showFormatLabel = variant === "catalog";
  const showBadge = variant === "catalog";
  const isDashboard = variant === "dashboard";
  const categoryClass =
    variant === "dashboard"
      ? "text-xs font-semibold text-bookvuk-purple"
      : variant === "trending"
        ? "text-bookvuk-navy text-[11px] font-semibold"
        : "text-[11px] font-semibold uppercase text-bookvuk-muted";
  const titleClass =
    variant === "trending" || variant === "dashboard"
      ? variant === "dashboard"
        ? "text-sm font-bold leading-snug tracking-tight text-bookvuk-navy"
        : "text-sm font-semibold leading-snug text-bookvuk-navy"
      : "text-sm font-semibold leading-snug text-bookvuk-navy";

  return (
    <div
      className={`flex h-full flex-col bg-white ${
        isDashboard
          ? "overflow-hidden rounded-2xl shadow-bookvuk-card ring-1 ring-bookvuk-navy/[0.06]"
          : "rounded-lg"
      }`}
    >
      <div
        className={`relative overflow-hidden ${
          isDashboard ? "rounded-t-2xl" : "rounded-lg"
        }`}
      >
        {/* A real <a>, not a button: this is how a crawler reaches a product page
            and how a shopper opens three books in tabs to compare them. */}
        <Link
          href={href}
          onClick={handleOpen}
          className={`relative block w-full cursor-pointer overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-bookvuk-purple/40 ${
            isDashboard ? "rounded-t-2xl" : "rounded-lg"
          }`}
          aria-label={`Open details for ${book.title}`}
        >
          <div className={`relative aspect-[4/5] w-full bg-gradient-to-br ${palette.bg}`}>
          {/* `fill` because the card, not the image, sets the aspect ratio.

              This is the grid that paid most for dropping the optimiser: there
              is no srcset any more, so a phone downloads the same ~34KB JPEG a
              desktop does. Lazy loading is what keeps that affordable — the
              default in `Img`, because a bare <img> is eager and this grid is
              long. */}
          <Img
            src={coverSrc}
            alt={`Cover of ${book.title}${book.author ? ` by ${book.author}` : ""}`}
            fill
            className="object-cover"
            /* Lazy by default — the grid is long. But a lazy image *above* the
               fold is worse than no hint at all: the browser will not start the
               fetch until layout settles, so the covers a visitor is already
               looking at arrive last. The first row opts out. */
            priority={priority}
            onError={() => {
              console.warn("Book cover failed to load", {
                bookId: book.bookId ?? book.id,
                src: coverSrc,
                coverImage: (book as any).coverImage,
              });
              setCoverFailed(true);
            }}
          />
            {!isDashboard ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute inset-0 opacity-95">
                  <div className="flex h-full items-end justify-center pb-4">
                    <div className="px-3 text-center">
                      {showFormatLabel ? (
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white drop-shadow">
                          {book.format}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-bookvuk-navy/[0.06]" />
            )}
            {soldOut ? (
              <div className="absolute inset-x-0 bottom-0 bg-bookvuk-navy/80 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-white">
                out of stock
              </div>
            ) : null}
            <div className="absolute left-3 top-3">
              {showBadge && badge ? (
                <div className="rounded-full bg-yellow-300/90 px-2 py-1 text-[10px] font-semibold text-bookvuk-navy">
                  {badge}
                </div>
              ) : null}
            </div>
          </div>
        </Link>

        {/* Shown to guests too: the prompt to sign in comes from using it. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            requireAuth(() => toggleWishlist(book));
          }}
          aria-label={isAuthenticated ? "Toggle wishlist" : "Sign in to save to wishlist"}
          title={isAuthenticated ? undefined : "Sign in to save this book"}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-bookvuk-navy/[0.08]"
        >
          <span
            className={wished ? "text-rose-600" : "text-bookvuk-muted"}
            aria-hidden
          >
            ♥
          </span>
        </button>
      </div>

      <div
        className={`flex flex-1 flex-col ${isDashboard ? "gap-1.5 px-4 pb-4 pt-3.5" : "gap-2 px-2 pb-3 pt-3"}`}
      >
        <div className={categoryClass}>{book.category}</div>

        {/* A heading, so a screen reader can jump between results and a crawler
            can see the title as the card's subject rather than loose text. */}
        <h3 className={titleClass} title={book.title}>
          <Link
            href={href}
            onClick={handleOpen}
            className="hover:text-bookvuk-purple focus:outline-none focus-visible:underline"
          >
            {book.title}
          </Link>
        </h3>
        <div
          className={
            isDashboard ? "text-xs leading-snug text-bookvuk-muted" : "text-[11px] text-bookvuk-muted"
          }
        >
          {book.author}
        </div>

        {isDashboard ? (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-bookvuk-navy/[0.06] pt-3">
            <div className="text-base font-bold tabular-nums text-bookvuk-navy">{formatPrice(book.price)}</div>
            {/* An unrated book must not render as `0.0`. A zero-star score reads
                as "everyone disliked this", which is the opposite of "nobody has
                said yet" — and the catalogue is mostly unrated. */}
            {rated ? (
              <div className="flex items-center gap-1.5 text-xs text-bookvuk-muted">
                <span className="text-amber-400">
                  <StarIcon />
                </span>
                <span className="font-semibold tabular-nums text-bookvuk-navy">
                  {book.rating.toFixed(1)}
                </span>
              </div>
            ) : (
              <div className="text-xs text-bookvuk-muted">No ratings yet</div>
            )}
          </div>
        ) : (
          <>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-bookvuk-muted">
              {rated ? (
                <>
                  <span className="text-amber-500">
                    <StarIcon />
                  </span>
                  <span className="font-semibold text-bookvuk-navy">{book.rating.toFixed(1)}</span>
                  <span className="opacity-70">({book.ratingCount})</span>
                </>
              ) : (
                <span>No ratings yet</span>
              )}
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <div className="text-sm font-bold text-bookvuk-navy">{formatPrice(book.price)}</div>

              {soldOut ? (
                <button
                  type="button"
                  onClick={notifyMe}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    wished
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      : "bg-bookvuk-lilac text-bookvuk-purple hover:bg-bookvuk-lilac/70"
                  }`}
                >
                  {wished ? "We'll tell you" : "Notify me"}
                </button>
              ) : cartQty ? (
                /* Was a flat "In Cart" label, so changing the amount meant
                   leaving the catalogue for the cart page and coming back. */
                <QuantityStepper
                  qty={cartQty}
                  onAdjust={(d) => void adjustQty(String(book.id), d)}
                  stock={Number(book.stock ?? 0)}
                  label={book.title}
                  size="sm"
                />
              ) : (
                  <button
                    type="button"
                    onClick={() => addToCart(book)}
                    className="inline-flex items-center gap-2 rounded-md bg-bookvuk-purple px-3 py-2 text-[12px] font-semibold text-white hover:bg-bookvuk-purple-hover"
                    aria-label="Add to cart"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                      <path
                        d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.1a2 2 0 0 1-2-1.6L5 3H2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {showAddText ? <span>Add</span> : null}
                  </button>
              )}
            </div>
          </>
        )}

        {isDashboard ? (
          <div className="mt-3">
            {soldOut ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  notifyMe();
                }}
                className={`w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                  wished
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                    : "bg-bookvuk-lilac text-bookvuk-purple hover:bg-bookvuk-lilac/70"
                }`}
              >
                {wished ? "We'll tell you when it's back" : "Notify me when it's back"}
              </button>
            ) : cartQty ? (
              <div className="flex justify-center">
                <QuantityStepper
                  qty={cartQty}
                  onAdjust={(d) => void adjustQty(String(book.id), d)}
                  stock={Number(book.stock ?? 0)}
                  label={book.title}
                />
              </div>
            ) : (
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(book);
                }}
                variant="primary" radius="xl" block className="px-0 py-2.5 shadow-sm"
                aria-label="Add to cart"
              >
                Add to cart
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BookCard;

