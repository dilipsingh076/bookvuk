import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { bookCoverSrc, type Book } from "../api/index";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { formatPrice } from "../utils/formatPrice";

type BookCardVariant = "catalog" | "trending" | "wishlist" | "dashboard";

type BookCardProps = {
  book: Book;
  variant?: BookCardVariant;
  onOpen?: (book: Book) => void;
};

const paletteForId = (id: string) => {
  const seed = id
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const palettes = [
    { bg: "from-indigo-100 via-booknest-cream to-cyan-100", fg: "text-booknest-navy" },
    { bg: "from-rose-100 via-booknest-cream to-orange-100", fg: "text-booknest-navy" },
    { bg: "from-emerald-100 via-booknest-cream to-lime-100", fg: "text-booknest-navy" },
    { bg: "from-sky-100 via-booknest-cream to-blue-100", fg: "text-booknest-navy" },
    { bg: "from-violet-100 via-booknest-cream to-fuchsia-100", fg: "text-booknest-navy" }
  ];
  return palettes[seed % palettes.length];
};

const maybeBadge = (id: string) => {
  const seed = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return seed % 5 === 0 ? "Bestseller" : null;
};

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

const BookCard = ({ book, variant = "catalog", onOpen }: BookCardProps) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { items, addToCart } = useCart();
  const { toggleWishlist, wishlistIds } = useWishlist();
  const normalizeId = (value: unknown) => String(value ?? "").trim().toLowerCase();

  const cartQty = useMemo(() => {
    return items.find((it) => String(it.bookId) === String(book.id))?.qty || 0;
  }, [items, book.id]);

  const wished = wishlistIds.some(
    (id) => normalizeId(id) === normalizeId(book.id) || normalizeId(id) === normalizeId(book.bookId)
  );

  const open = () => {
    if (onOpen) return onOpen(book);
    navigate(`/books/${book.id}`);
  };

  const palette = paletteForId(book.id);
  const badge = maybeBadge(book.id);

  const showAddText = variant !== "wishlist";
  const showFormatLabel = variant === "catalog";
  const showBadge = variant === "catalog";
  const isDashboard = variant === "dashboard";
  const categoryClass =
    variant === "dashboard"
      ? "text-xs font-semibold text-booknest-purple"
      : variant === "trending"
        ? "text-booknest-navy text-[11px] font-semibold"
        : "text-[11px] font-semibold uppercase text-booknest-muted";
  const titleClass =
    variant === "trending" || variant === "dashboard"
      ? variant === "dashboard"
        ? "text-sm font-bold leading-snug tracking-tight text-booknest-navy"
        : "text-sm font-semibold leading-snug text-booknest-navy"
      : "text-sm font-semibold leading-snug text-booknest-navy";

  return (
    <div
      className={`flex h-full flex-col bg-white ${
        isDashboard
          ? "overflow-hidden rounded-2xl shadow-booknest-card ring-1 ring-booknest-navy/[0.06]"
          : "rounded-lg"
      }`}
    >
      <div
        className={`relative overflow-hidden ${
          isDashboard ? "rounded-t-2xl" : "rounded-lg"
        }`}
      >
        <button
          type="button"
          onClick={open}
          className={`relative block w-full cursor-pointer overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-booknest-purple/40 ${
            isDashboard ? "rounded-t-2xl" : "rounded-lg"
          }`}
          aria-label={`Open details for ${book.title}`}
        >
          <div className={`relative aspect-[4/5] w-full bg-gradient-to-br ${palette.bg}`}>
          <img
            src={bookCoverSrc(book)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
                console.warn("Book cover failed to load", {
                  bookId: book.bookId ?? book.id,
                  src: img.currentSrc || img.src,
                  coverImage: (book as any).coverImage,
                });
              if (img.dataset.fallbackApplied === "1") return;
              img.dataset.fallbackApplied = "1";
              img.src = "/assets/books/placeholder.svg";
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
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-booknest-navy/[0.06]" />
            )}
            <div className="absolute left-3 top-3">
              {showBadge && badge ? (
                <div className="rounded-full bg-yellow-300/90 px-2 py-1 text-[10px] font-semibold text-booknest-navy">
                  {badge}
                </div>
              ) : null}
            </div>
          </div>
        </button>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(book);
            }}
            aria-label="Toggle wishlist"
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-booknest-navy/[0.08]"
          >
            <span
              className={wished ? "text-rose-600" : "text-booknest-muted"}
              aria-hidden
            >
              ♥
            </span>
          </button>
        ) : null}
      </div>

      <div
        className={`flex flex-1 flex-col ${isDashboard ? "gap-1.5 px-4 pb-4 pt-3.5" : "gap-2 px-2 pb-3 pt-3"}`}
      >
        <div className={categoryClass}>{book.category}</div>

        <div className={titleClass} title={book.title}>
          {book.title}
        </div>
        <div
          className={
            isDashboard ? "text-xs leading-snug text-booknest-muted" : "text-[11px] text-booknest-muted"
          }
        >
          {book.author}
        </div>

        {isDashboard ? (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-booknest-navy/[0.06] pt-3">
            <div className="text-base font-bold tabular-nums text-booknest-navy">{formatPrice(book.price)}</div>
            <div className="flex items-center gap-1.5 text-xs text-booknest-muted">
              <span className="text-amber-400">
                <StarIcon />
              </span>
              <span className="font-semibold tabular-nums text-booknest-navy">{book.rating.toFixed(1)}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-booknest-muted">
              <span className="text-amber-500">
                <StarIcon />
              </span>
              <span className="font-semibold text-booknest-navy">{book.rating.toFixed(1)}</span>
              <span className="opacity-70">({book.ratingCount || 0})</span>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <div className="text-sm font-bold text-booknest-navy">{formatPrice(book.price)}</div>

              {isAuthenticated ? (
                cartQty ? (
                  <div className="rounded-md bg-booknest-lilac px-2 py-1 text-[11px] font-semibold text-booknest-purple">
                    In Cart
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addToCart(book)}
                    className="inline-flex items-center gap-2 rounded-md bg-booknest-purple px-3 py-2 text-[12px] font-semibold text-white hover:bg-booknest-purple-hover"
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
                )
              ) : null}
            </div>
          </>
        )}

        {isDashboard && isAuthenticated ? (
          <div className="mt-3">
            {cartQty ? (
              <div className="rounded-xl bg-booknest-lilac py-2.5 text-center text-xs font-semibold text-booknest-purple">
                In cart ({cartQty})
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(book);
                }}
                className="w-full rounded-xl bg-booknest-purple py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-booknest-purple-hover"
                aria-label="Add to cart"
              >
                Add to cart
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BookCard;

