import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { bookCoverSrc, fetchBookById, type Book } from "../api/index";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { formatPrice } from "../utils/formatPrice";
import Modal from "../components/ui/Modal";

type BookDetailsProps = {
  isModal?: boolean;
};

const BookDetails = ({ isModal = false }: BookDetailsProps) => {
  const navigate = useNavigate();
  const { bookId = "" } = useParams<{ bookId: string }>();
  const { isAuthenticated } = useAuth();
  const { openLoginModal } = useAuthModal();
  const { addToCart } = useCart();
  const { toggleWishlist, wishlistIds } = useWishlist();

  const { data: book, loading, error } = useFetch<Book>(
    () => fetchBookById(bookId),
    [bookId]
  );

  const wished = useMemo(() => {
    if (!book) return false;
    return wishlistIds.includes(String(book.id));
  }, [book, wishlistIds]);

  const close = () => navigate(-1);

  const content = (
    <div className="p-6">
      {loading ? (
        <div className="py-6 text-center text-sm text-booknest-muted">Loading...</div>
      ) : error ? (
        <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {(error as { message?: string } | undefined)?.message || "Could not load book"}
        </div>
      ) : !book ? null : (
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-8">
          <div className="mx-auto w-full max-w-[280px] shrink-0 rounded-2xl border border-booknest-border/80 bg-white p-3 md:mx-0">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-booknest-lilac">
              <img
                src={bookCoverSrc(book)}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  console.warn("Book details cover failed to load", {
                    bookId: book.bookId ?? book.id,
                    src: img.currentSrc || img.src,
                    coverImage: (book as any).coverImage,
                  });
                  if (img.dataset.fallbackApplied === "1") return;
                  img.dataset.fallbackApplied = "1";
                  img.src = "/assets/books/placeholder.svg";
                }}
              />
              <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
                <span className="inline-block rounded-full bg-white/95 px-4 py-1.5 text-center text-xs font-semibold text-booknest-navy shadow-sm ring-1 ring-black/5">
                  {book.format}
                </span>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-booknest-navy">{book.category}</div>
                <h2 className="mt-2 text-2xl font-extrabold text-booknest-navy md:text-3xl">
                  {book.title}
                </h2>
                <div className="mt-2 text-sm text-booknest-muted">by {book.author}</div>
              </div>

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => toggleWishlist(book)}
                  className="rounded-full border border-booknest-border px-3 py-2 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
                >
                  <span className={wished ? "text-rose-600" : ""}>♥</span>{" "}
                  {wished ? "Saved" : "Save"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openLoginModal()}
                  className="rounded-full border border-booknest-border px-3 py-2 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
                >
                  Login to save
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                <span>★</span>
                <span>{book.rating.toFixed(1)}</span>
              </div>
              <div className="text-sm text-booknest-muted">({book.ratingCount || 0})</div>
              <div className="text-sm font-semibold text-booknest-navy">{formatPrice(book.price)}</div>
            </div>

            <p className="mt-4 break-words text-sm leading-relaxed text-booknest-muted">{book.description}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => addToCart(book)}
                    className="shrink-0 rounded-lg bg-booknest-purple px-5 py-3 text-sm font-semibold text-white hover:bg-booknest-purple-hover"
                  >
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/cart")}
                    className="shrink-0 rounded-lg border border-booknest-border px-5 py-3 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
                  >
                    Go to Cart
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openLoginModal()}
                  className="rounded-lg bg-booknest-purple px-5 py-3 text-sm font-semibold text-white hover:bg-booknest-purple-hover text-center"
                >
                  Login to add to cart
                </button>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-booknest-lilac p-4 text-sm text-booknest-navy">
              <div className="font-semibold">Availability</div>
              <div className="mt-1 break-words">{book.stockStatus}</div>
              <div className="mt-3 text-xs leading-snug text-booknest-muted">
                Shipping and taxes are calculated during checkout.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <Modal isOpen={true} onClose={close} panelClassName="max-w-4xl">
        <div className="flex items-center justify-between border-b border-booknest-border px-6 py-4">
          <div className="text-sm font-semibold text-booknest-navy">Book Details</div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-booknest-border px-3 py-1 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
          >
            Close
          </button>
        </div>
        {content}
      </Modal>
    );
  }

  return (
    <div className="py-10">
      <div className="mb-6">
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-booknest-border px-4 py-2 text-sm font-semibold text-booknest-navy hover:bg-booknest-lilac"
        >
          Back
        </button>
      </div>
      <div className="rounded-2xl border border-booknest-border bg-white shadow-booknest-card">{content}</div>
    </div>
  );
};

export default BookDetails;

